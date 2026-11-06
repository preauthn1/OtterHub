import { DBAdapter } from ".";
import { Chunk, chunkPrefix, FileMetadata, trashPrefix, UploadedChunkResult } from "@shared/types";
import { extractKeyFromTrash, isUploadedChunk } from "./shared-utils";
import { getUniqueFileId } from "../file";
import { TRASH_EXPIRATION_TTL } from "@shared/types";

/**
 * 存储适配器基类
 * 提供通用的分片文件处理逻辑（已优化：去除临时 KV 双写与内存二次缓冲，直传目标存储）
 */
export abstract class BaseAdapter implements DBAdapter {
  protected env: any;
  protected kvName: string;

  constructor(env: any, kvName: string) {
    this.env = env;
    this.kvName = kvName;
  }

  abstract uploadFile(
    file: File | Blob | Uint8Array,
    metadata: FileMetadata,
    waitUntil?: (p: Promise<any>) => void,
  ): Promise<{ key: string }>;

  abstract uploadStream(
    stream: ReadableStream,
    metadata: FileMetadata,
    waitUntil?: (p: Promise<any>) => void,
    mimeType?: string,
  ): Promise<{ key: string }>;

  abstract get(key: string, req?: Request): Promise<Response>;

  abstract delete(key: string): Promise<{ isDeleted: boolean }>;

  async moveToTrash(key: string): Promise<void> {
    const kv = this.env[this.kvName];
    const item = await this.getFileMetadataWithValue(key);
    if (!item) {
      throw new Error("File not found");
    }

    const trashKey = `${trashPrefix}${key}`;
    await kv.put(trashKey, item.value || "", {
      metadata: item.metadata,
      expirationTtl: TRASH_EXPIRATION_TTL,
    });

    await kv.delete(key);
  }

  async restoreFromTrash(trashKey: string): Promise<void> {
    const kv = this.env[this.kvName];
    const { value, metadata } = await kv.getWithMetadata(trashKey);
    if (!metadata) {
      throw new Error("File not found in trash");
    }

    const originalKey = extractKeyFromTrash(trashKey);

    await kv.put(originalKey, value || "", { metadata });
    await kv.delete(trashKey);
  }

  protected abstract uploadToTarget(
    chunkFile: File | Blob | Uint8Array,
    parentKey: string,
    chunkIndex: number,
    fileName?: string,
  ): Promise<string | { chunkId: string; thumbUrl?: string }>;

  protected getTempChunkId(parentKey: string, chunkIndex: number): string {
    const shortFileId =
      parentKey.split("_")[1]?.slice(0, 16) ||
      getUniqueFileId();
    return `${chunkPrefix}${shortFileId}_${chunkIndex}`;
  }

  /**
   * 零 KV 写入的分片直传方法（推荐大文件通道）
   * 直接将分片流式上传到 R2/Telegram 并返回分片凭证，最后由 /upload/chunk/complete 一次性写入 KV
   */
  async uploadChunkDirect(
    key: string,
    chunkIndex: number,
    chunkFile: File | Blob,
    fileName?: string,
  ): Promise<UploadedChunkResult> {
    const result = await this.uploadToTarget(
      chunkFile,
      key,
      chunkIndex,
      fileName,
    );

    const chunkId = typeof result === "string" ? result : result.chunkId;
    const thumbUrl = typeof result === "string" ? undefined : result.thumbUrl;

    return {
      chunkIndex,
      chunkId,
      size: chunkFile.size,
      ...(thumbUrl ? { thumbUrl } : {}),
    };
  }

  /**
   * 兼容旧版的单分片上传（不再写临时 KV，直接上传目标存储后更新元数据）
   */
  async uploadChunk(
    key: string,
    chunkIndex: number,
    chunkFile: File | Blob,
    _waitUntil?: (promise: Promise<any>) => void,
  ): Promise<{ chunkIndex: number }> {
    const item = await this.getFileMetadataWithValue(key);
    if (!item) {
      throw new Error("File not found");
    }

    const { metadata } = item;
    if (!metadata?.chunkInfo) {
      throw new Error("Not a chunked file");
    }

    if (isUploadedChunk(metadata, chunkIndex)) {
      return { chunkIndex };
    }

    const directResult = await this.uploadChunkDirect(
      key,
      chunkIndex,
      chunkFile,
      metadata.fileName,
    );

    await this.updateChunkInfo(
      key,
      chunkIndex,
      directResult.chunkId,
      directResult.size,
      directResult.thumbUrl,
    );

    return { chunkIndex };
  }

  async getProgress(key: string): Promise<{
    uploaded: number;
    total: number;
    complete: boolean;
  } | null> {
    const item = await this.getFileMetadataWithValue(key);
    if (!item) {
      return null;
    }
    const { metadata } = item;

    if (!metadata?.chunkInfo) {
      return null;
    }

    const { chunkInfo } = metadata;
    const uploaded = chunkInfo.uploadedIndices?.length || 0;
    const total = chunkInfo.total;
    const complete = uploaded === total;

    return { uploaded, total, complete };
  }

  public async getFileMetadataWithValue(key: string): Promise<{
    metadata: FileMetadata;
    value: string | null;
  } | null> {
    try {
      const item = await this.env[this.kvName].getWithMetadata(key);
      if (!item || !item.metadata) return null;
      return { metadata: item.metadata, value: item.value };
    } catch (error) {
      console.error(`[getMetadata] Error for key ${key}:`, error);
      return null;
    }
  }

  protected async updateChunkInfo(
    key: string,
    chunkIndex: number,
    chunkId: string,
    chunkSize: number,
    thumbUrl?: string,
  ): Promise<void> {
    const kv = this.env[this.kvName];
    const maxRetries = 4;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const item = await this.getFileMetadataWithValue(key);
        if (!item) {
          throw new Error(`[updateChunkInfo] File not found: ${key}`);
        }

        const { metadata, value } = item;
        if (!metadata?.chunkInfo) {
          throw new Error(`[updateChunkInfo] No metadata/chunkInfo for key: ${key}`);
        }

        const chunks: Chunk[] = value ? JSON.parse(value) : [];

        if (metadata.chunkInfo.uploadedIndices?.includes(chunkIndex)) {
          return;
        }

        if (!metadata.chunkInfo.uploadedIndices) {
          metadata.chunkInfo.uploadedIndices = [];
        }
        metadata.chunkInfo.uploadedIndices.push(chunkIndex);
        metadata.chunkInfo.uploadedIndices.sort((a, b) => a - b);

        const filteredChunks = chunks.filter((c) => c.idx !== chunkIndex);
        filteredChunks.push({
          idx: chunkIndex,
          file_id: chunkId,
          size: chunkSize,
        });
        filteredChunks.sort((a, b) => a.idx - b.idx);

        if (thumbUrl && !metadata.thumbUrl) {
          metadata.thumbUrl = thumbUrl;
        }

        await kv.put(key, JSON.stringify(filteredChunks), { metadata });
        return;
      } catch (error) {
        console.error(`[updateChunkInfo] Attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, i) * 150),
        );
      }
    }
  }
}
