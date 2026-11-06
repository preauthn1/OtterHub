import { client } from "./client";
import { API_URL, unwrap } from "./config";
import {
  ApiResponse,
  ChunkUploadCompletePayload,
  ChunkUploadInitPayload,
  FileMetadata,
  FileTag,
  FileType,
  ListFilesResponse,
  SingleUploadPayload,
  UploadedChunkResult,
  UrlUploadPayload,
} from "@shared/types";
import { ListFilesRequest } from "@/lib/types";

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type ChunkProcessingProgress = {
  uploadedIndices: number[];
  uploaded: number;
  total: number;
  complete: boolean;
};

export type ChunkCompleteResponse = {
  key: string;
  fileType: FileType;
  uploaded: number;
  total: number;
  complete: boolean;
  metadata: FileMetadata;
};

function redirectToLoginIfNeeded() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  const currentUrl = window.location.href;
  const redirectUrl = `/login?redirect=${encodeURIComponent(currentUrl)}`;
  window.location.href = redirectUrl;
}

async function parseApiResponse<T>(raw: string): Promise<T> {
  let body: ApiResponse<T>;
  try {
    body = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    throw new Error(raw || "请求失败");
  }

  if (!body.success) {
    throw new Error(body.message || "请求失败");
  }

  return body.data as T;
}

export class UploadAbortedError extends Error {
  constructor(message = "上传已暂停或取消") {
    super(message);
    this.name = "UploadAbortedError";
  }
}

function xhrPostForm<T>(
  url: string,
  form: FormData,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;

    const onAbortSignal = () => {
      try {
        xhr.abort();
      } catch {
        // ignore
      }
    };

    if (signal) {
      signal.addEventListener("abort", onAbortSignal, { once: true });
    }

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener("abort", onAbortSignal);
      }
    };

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      const total = e.total || 0;
      const loaded = e.loaded || 0;
      const percent =
        total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress({ loaded, total, percent });
    };

    xhr.onload = async () => {
      cleanup();
      if (xhr.status === 401) {
        redirectToLoginIfNeeded();
        reject(new Error("登录状态已失效，请重新登录"));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          reject(new Error(parsed?.message || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
        }
        return;
      }

      try {
        const data = await parseApiResponse<T>(xhr.responseText);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("网络连接异常"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new UploadAbortedError());
    };

    xhr.send(form);
  });
}

/**
 * 上传文件
 */
export async function uploadFile(file: File, nsfw?: boolean): Promise<string> {
  return unwrap<string>(
    client.upload.$post({
      form: {
        file: file,
        nsfw: nsfw ? "true" : "false",
      },
    })
  );
}

export async function uploadFileWithProgress(
  file: File,
  options: SingleUploadPayload,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("nsfw", options.nsfw ? "true" : "false");
  form.append("tags", JSON.stringify(options.tags ?? []));

  const url = `${API_URL}/upload`;
  return xhrPostForm<string>(url, form, onProgress, signal);
}

/**
 * 通过远程 URL 直链拉取上传
 */
export async function uploadFileByUrl(
  payload: UrlUploadPayload,
): Promise<{ key: string; fileSize: number }> {
  const res = await fetch(`${API_URL}/upload/by-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    redirectToLoginIfNeeded();
    throw new Error("登录状态已失效");
  }
  return unwrap<{ key: string; fileSize: number }>(res);
}

/**
 * 初始化分片上传
 */
export async function uploadChunkInit(
  payload: ChunkUploadInitPayload,
): Promise<string> {
  const res = await fetch(`${API_URL}/upload/chunk/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    redirectToLoginIfNeeded();
    throw new Error("登录状态已失效");
  }
  return unwrap<string>(res);
}

/**
 * 上传分片（旧版兼容）
 */
export async function uploadChunk(
  key: string,
  chunkIndex: number,
  chunkFile: File | Blob,
): Promise<string> {
  const res = await unwrap<string | number>(
    client.upload.chunk.$post({
      form: {
        key,
        chunkIndex: chunkIndex.toString(),
        chunkFile: chunkFile,
      },
    })
  );
  return res.toString();
}

export async function uploadChunkWithProgress(
  key: string,
  chunkIndex: number,
  chunkFile: File | Blob,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append("key", key);
  form.append("chunkIndex", chunkIndex.toString());
  form.append("chunkFile", chunkFile);

  const url = `${API_URL}/upload/chunk`;
  const res = await xhrPostForm<string | number>(url, form, onProgress, signal);
  return res.toString();
}

/**
 * 零 KV 竞争的大文件分片直传（带指数退避自动重试与中止信号支持）
 */
export async function uploadChunkDirectWithProgress(
  key: string,
  chunkIndex: number,
  chunkFile: File | Blob,
  fileName?: string,
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
  maxRetries = 3,
): Promise<UploadedChunkResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new UploadAbortedError();
    }

    try {
      const form = new FormData();
      form.append("key", key);
      form.append("chunkIndex", chunkIndex.toString());
      form.append("direct", "true");
      if (fileName) {
        form.append("fileName", fileName);
      }
      form.append("chunkFile", chunkFile);

      const url = `${API_URL}/upload/chunk`;
      return await xhrPostForm<UploadedChunkResult>(
        url,
        form,
        onProgress,
        signal,
      );
    } catch (err) {
      if (err instanceof UploadAbortedError || signal?.aborted) {
        throw new UploadAbortedError();
      }
      lastError = err;
      if (attempt === maxRetries) break;
      const delayMs = Math.min(8000, Math.pow(2, attempt) * 900);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("分片上传失败");
}

/**
 * 完成大文件分片上传或保存断点（单次原子写入 KV）
 */
export async function completeChunkUpload(
  payload: ChunkUploadCompletePayload,
): Promise<ChunkCompleteResponse> {
  const res = await fetch(`${API_URL}/upload/chunk/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    redirectToLoginIfNeeded();
    throw new Error("登录状态已失效");
  }
  return unwrap<ChunkCompleteResponse>(res);
}

export async function getUploadChunkProgress(
  key: string,
): Promise<ChunkProcessingProgress> {
  return unwrap<ChunkProcessingProgress>(
    client.upload.chunk.progress.$get({
      query: { key },
    })
  );
}

/**
 * 获取文件列表
 */
export async function getFileList(
  params?: ListFilesRequest
): Promise<ListFilesResponse> {
  const query: Record<string, string> = {};
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query[k] = String(v);
    });
  }

  return unwrap<ListFilesResponse>(
    client.file.list.$get({
      query: query,
    })
  );
}

/**
 * 获取文件预览/下载 URL
 */
export function getFileUrl(key: string): string {
  return `${API_URL}/file/${key}`;
}

export function getFileDownloadUrl(key: string): string {
  return `${API_URL}/file/${key}/download`;
}

/**
 * 获取回收站文件 URL
 */
export function getTrashFileUrl(key: string): string {
  return `${API_URL}/trash/${key}`;
}

/**
 * 彻底删除文件
 */
export async function deleteFile(key: string): Promise<boolean> {
  const res = await client.file[":key"].$delete({
    param: { key },
  });

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  return data.success;
}

/**
 * 移动文件到回收站
 */
export async function moveToTrash(key: string): Promise<boolean> {
  const res = await client.trash[":key"].move.$post({
    param: { key },
  });

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  return data.success;
}

/**
 * 从回收站恢复文件
 */
export async function restoreFile(key: string): Promise<boolean> {
  const res = await client.trash[":key"].restore.$post({
    param: { key },
  });

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  return data.success;
}

/**
 * 切换收藏状态
 */
export async function toggleLike(key: string): Promise<boolean> {
  const res = await client.file[":key"]["toggle-like"].$post({
    param: { key },
  });

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  return data.success;
}

/**
 * 编辑文件元数据
 */
export async function editMetadata(
  key: string,
  updates: { fileName?: string; tags?: FileTag[]; desc?: string }
): Promise<{ metadata: any }> {
  const data = await unwrap<any>(
    client.file[":key"].meta.$patch({
      param: { key },
      json: updates,
    })
  );
  return { metadata: data };
}

/**
 * AI分析图片生成描述，blob 为前端已压缩的图片
 */
export async function analyzeImage(key: string, blob: Blob): Promise<{ desc: string }> {
  const formData = new FormData();
  formData.append("image", blob, "image.jpg");
  const res = await fetch(`${API_URL}/file/${encodeURIComponent(key)}/analyze`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  return unwrap<{ desc: string }>(res);
}
