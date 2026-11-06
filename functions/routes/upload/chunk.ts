import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  Chunk,
  FileType,
  FileMetadata,
  FileTag,
  chunkPrefix,
  MAX_FILENAME_LENGTH,
  MAX_FILE_SIZE,
  MAX_CHUNK_NUM,
} from '@shared/types';
import { DBAdapterFactory } from '@utils/db-adapter';
import { getUniqueFileId, buildKeyId, getFileExt } from '@utils/file';
import { validateChunksForMerge } from '@utils/db-adapter/shared-utils';
import { TEMP_CHUNK_TTL } from 'types';
import type { Env } from '../../types/hono';
import { fail, ok } from '@utils/response';
import { normalizeUploadTags } from '@utils/upload-tags';

export const chunkUploadRoutes = new Hono<{ Bindings: Env }>();

// 初始化分片上传（支持 deferKv=true 零 KV 预写模式，彻底避免 KV 配额浪费）
chunkUploadRoutes.post(
  '/chunk/init',
  zValidator(
    'json',
    z.object({
      fileType: z.enum(FileType),
      fileName: z.string().min(1).max(MAX_FILENAME_LENGTH),
      fileSize: z.number().int().positive(),
      totalChunks: z.number().int().positive(),
      tags: z.array(z.enum(FileTag)).optional(),
      deferKv: z.boolean().optional(),
    })
  ),
  async (c) => {
    const { fileType, fileName, fileSize, totalChunks, tags, deferKv } = c.req.valid('json');

    if (fileSize > MAX_FILE_SIZE || totalChunks > MAX_CHUNK_NUM) {
      return fail(c, 'File size exceeds the limit', 400);
    }

    const fileId = getUniqueFileId();
    const key = buildKeyId(fileType, `${chunkPrefix}${fileId}`, getFileExt(fileName));

    if (!deferKv) {
      const metadata: FileMetadata = {
        fileName,
        fileSize,
        uploadedAt: Date.now(),
        liked: false,
        tags: normalizeUploadTags(tags),
        chunkInfo: {
          total: totalChunks,
          uploadedIndices: [],
        },
      };

      const kv = c.env.oh_file_url;
      await kv.put(key, '', { metadata, expirationTtl: TEMP_CHUNK_TTL });
    }

    return ok(c, key);
  }
);

chunkUploadRoutes.get(
  '/chunk/progress',
  zValidator(
    'query',
    z.object({
      key: z.string().min(1),
    })
  ),
  async (c) => {
    const { key } = c.req.valid('query');

    try {
      const kv = c.env.oh_file_url;
      const { metadata } = await kv.getWithMetadata<FileMetadata>(key);

      if (!metadata?.chunkInfo) {
        return fail(c, 'Not a chunked file', 400);
      }

      const uploadedIndices = metadata.chunkInfo.uploadedIndices || [];
      const total = metadata.chunkInfo.total || 0;
      const uploaded = uploadedIndices.length;
      const complete = total > 0 && uploaded === total;

      return ok(c, { uploadedIndices, uploaded, total, complete });
    } catch (error: any) {
      console.error(`Get chunk progress error: ${error.message}`);
      return fail(c, error.message, 400);
    }
  }
);

// 上传单个分片（支持 direct=true 直传模式，零 KV 读写并返回分片 file_id）
chunkUploadRoutes.post(
  '/chunk',
  async (c) => {
    try {
      const formData = await c.req.formData();
      const key = formData.get('key') as string;
      const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
      const chunk = formData.get('chunkFile') as File;
      const direct = formData.get('direct') === 'true';
      const fileName = (formData.get('fileName') as string) || undefined;

      if (!key || isNaN(chunkIndex) || !chunk) {
        return fail(c, 'Missing required parameters', 400);
      }

      const db = DBAdapterFactory.getAdapter(c.env);

      if (direct) {
        const directRes = await db.uploadChunkDirect(key, chunkIndex, chunk, fileName);
        return ok(c, directRes);
      }

      const { chunkIndex: uploadedChunkIndex } = await db.uploadChunk(
        key,
        chunkIndex,
        chunk,
        c.executionCtx.waitUntil.bind(c.executionCtx)
      );

      return ok(c, uploadedChunkIndex);
    } catch (error: any) {
      console.error(`Upload chunk error: ${error.message}`);
      return fail(c, error.message, 400);
    }
  }
);

// 完成分片上传或保存断点（单次原子写入 KV，彻底消除并发 KV 覆盖与配额消耗）
chunkUploadRoutes.post(
  '/chunk/complete',
  zValidator(
    'json',
    z.object({
      key: z.string().min(1),
      fileType: z.enum(FileType).optional(),
      fileName: z.string().min(1).max(MAX_FILENAME_LENGTH).optional(),
      fileSize: z.number().int().positive().optional(),
      totalChunks: z.number().int().positive().max(MAX_CHUNK_NUM).optional(),
      tags: z.array(z.enum(FileTag)).optional(),
      nsfw: z.boolean().optional(),
      thumbUrl: z.string().optional(),
      partial: z.boolean().optional(),
      chunks: z.array(
        z.object({
          idx: z.number().int().nonnegative(),
          file_id: z.string().min(1),
          size: z.number().int().positive(),
        })
      ),
    })
  ),
  async (c) => {
    try {
      const payload = c.req.valid('json');
      const kv = c.env.oh_file_url;

      // 若 KV 中已有记录（例如服务端断点续传），合并已有分片与新上传分片
      let existingMeta: FileMetadata | null = null;
      let existingChunks: Chunk[] = [];
      try {
        const existing = await kv.getWithMetadata<FileMetadata>(payload.key);
        if (existing?.metadata) {
          existingMeta = existing.metadata;
        }
        if (existing?.value) {
          existingChunks = JSON.parse(existing.value);
        }
      } catch {
        // 忽略读取异常，以客户端提交的分片为准
      }

      const chunkMap = new Map<number, Chunk>();
      for (const ch of existingChunks) {
        if (ch && typeof ch.idx === 'number' && ch.file_id) {
          chunkMap.set(ch.idx, ch);
        }
      }
      for (const ch of payload.chunks) {
        chunkMap.set(ch.idx, ch);
      }

      const mergedChunks = Array.from(chunkMap.values()).sort((a, b) => a.idx - b.idx);
      const totalChunks =
        payload.totalChunks ??
        existingMeta?.chunkInfo?.total ??
        mergedChunks.length;

      if (!payload.partial) {
        const validation = validateChunksForMerge(mergedChunks, totalChunks);
        if (!validation.valid) {
          return fail(c, validation.reason || 'Incomplete chunks for merge', 400);
        }
      }

      const uploadedIndices = mergedChunks.map((ch) => ch.idx);
      const totalSizeFromChunks = mergedChunks.reduce((acc, ch) => acc + ch.size, 0);
      const finalFileName = (
        payload.fileName ||
        existingMeta?.fileName ||
        payload.key
      ).substring(0, MAX_FILENAME_LENGTH);
      const finalFileSize =
        payload.fileSize || existingMeta?.fileSize || totalSizeFromChunks;

      const metadata: FileMetadata = {
        fileName: finalFileName,
        fileSize: finalFileSize,
        uploadedAt: existingMeta?.uploadedAt || Date.now(),
        liked: existingMeta?.liked ?? false,
        tags:
          payload.tags !== undefined || payload.nsfw !== undefined
            ? normalizeUploadTags(payload.tags ?? existingMeta?.tags, {
                forceNsfw: Boolean(payload.nsfw),
              })
            : existingMeta?.tags || [],
        ...(payload.thumbUrl || existingMeta?.thumbUrl
          ? { thumbUrl: payload.thumbUrl || existingMeta?.thumbUrl }
          : {}),
        ...(existingMeta?.desc ? { desc: existingMeta.desc } : {}),
        chunkInfo: {
          total: totalChunks,
          uploadedIndices,
        },
      };

      const isComplete = uploadedIndices.length === totalChunks;
      await kv.put(payload.key, JSON.stringify(mergedChunks), {
        metadata,
        ...(isComplete ? {} : { expirationTtl: TEMP_CHUNK_TTL }),
      });

      return ok(c, {
        key: payload.key,
        fileType: payload.fileType || (payload.key.split(':')[0] as FileType),
        uploaded: uploadedIndices.length,
        total: totalChunks,
        complete: isComplete,
        metadata,
      });
    } catch (error: any) {
      console.error(`Complete chunk upload error: ${error.message}`);
      return fail(c, error.message || 'Failed to finalize chunk upload', 500);
    }
  }
);
