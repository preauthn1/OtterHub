import { Chunk, FileTag, FileType } from "@shared/types";

/**
 * 更新上传进度
 */
export function updateProgress(
  map: Record<string, number>,
  key: string,
  uploaded: number,
  total: number,
  setProgress: (v: Record<string, number>) => void,
) {
  map[key] = Math.round((uploaded / total) * 100);
  setProgress({ ...map });
}

/**
 * 计算需要上传的分片索引
 */
export function getMissingChunkIndices(
  totalChunks: number,
  uploadedIndices: number[] = [],
): number[] {
  const uploadedSet = new Set(uploadedIndices);
  const result: number[] = [];

  for (let i = 0; i < totalChunks; i++) {
    if (!uploadedSet.has(i)) result.push(i);
  }

  return result;
}

/**
 * 真正的滑动窗口并发池（任意槽位完成后立即调度下一个分片，避免批次队头阻塞）
 */
export async function runConcurrentPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldStop?: () => boolean,
): Promise<void> {
  if (!items.length) return;
  const maxWorkers = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;
  let firstError: unknown = null;

  const runners = Array.from({ length: maxWorkers }, async () => {
    while (cursor < items.length) {
      if (shouldStop?.() || firstError) return;
      const currentIndex = cursor++;
      if (currentIndex >= items.length) return;
      try {
        await worker(items[currentIndex], currentIndex);
      } catch (err) {
        if (!firstError) {
          firstError = err;
        }
        return;
      }
    }
  });

  await Promise.all(runners);
  if (firstError) {
    throw firstError;
  }
}

export interface ResumableChunkRecord extends Chunk {
  thumbUrl?: string;
}

export interface ResumableUploadSession {
  fingerprint: string;
  key: string;
  fileType: FileType;
  fileName: string;
  fileSize: number;
  lastModified: number;
  totalChunks: number;
  tags: FileTag[];
  thumbUrl?: string;
  uploadedChunks: Record<number, ResumableChunkRecord>;
  createdAt: number;
  updatedAt: number;
}

const SESSION_STORAGE_KEY = "otterhub:resumable-upload-sessions:v2";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function buildFileFingerprint(file: {
  name: string;
  size: number;
  lastModified?: number;
}): string {
  return `${file.name}::${file.size}::${file.lastModified || 0}`;
}

export function loadUploadSessions(): Record<string, ResumableUploadSession> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ResumableUploadSession>;
    const now = Date.now();
    const cleaned: Record<string, ResumableUploadSession> = {};
    let mutated = false;

    for (const [fp, session] of Object.entries(parsed)) {
      if (
        session &&
        session.key &&
        session.totalChunks > 0 &&
        now - (session.updatedAt || 0) < SESSION_TTL_MS
      ) {
        cleaned[fp] = session;
      } else {
        mutated = true;
      }
    }

    if (mutated) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function getUploadSession(
  fingerprint: string,
): ResumableUploadSession | null {
  const all = loadUploadSessions();
  return all[fingerprint] || null;
}

export function saveUploadSession(session: ResumableUploadSession): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadUploadSessions();
    all[session.fingerprint] = {
      ...session,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
}

export function removeUploadSession(fingerprint: string): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadUploadSessions();
    if (fingerprint in all) {
      delete all[fingerprint];
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(all));
    }
  } catch {
    // ignore
  }
}

export function clearAllUploadSessions(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
