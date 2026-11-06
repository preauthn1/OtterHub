import { Hono } from "hono";
import { FileType } from "@shared/types";
import type { Env } from "../../types/hono";
import { authMiddleware } from "middleware/auth";
import { fail, ok } from "@utils/response";
import { buildKeyId } from "@utils/file";

export const importRoutes = new Hono<{ Bindings: Env }>();
importRoutes.use("*", authMiddleware);

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "heic"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv", "avi"]);

type LegacyMeta = {
  FileName?: string;
  FileSize?: string;
  TimeStamp?: number;
  TgFileId?: string;
};

function fileTypeOf(name: string): FileType {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (IMAGE_EXT.has(ext)) return FileType.Image;
  if (AUDIO_EXT.has(ext)) return FileType.Audio;
  if (VIDEO_EXT.has(ext)) return FileType.Video;
  return FileType.Document;
}

function extOf(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return ext.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
}

importRoutes.post("/legacy", async (c) => {
  const cursor = c.req.query("cursor") || undefined;
  const limit = Math.min(Number(c.req.query("limit") || 100), 200);
  const listed = await c.env.oh_file_url.list({ limit, cursor });
  let imported = 0;
  let skipped = 0;
  let existed = 0;
  for (const item of listed.keys || []) {
    try {
    const name = item.name as string;
    if (!/^\d{10,}_/.test(name)) {
      skipped += 1;
      continue;
    }
    const legacy = await c.env.oh_file_url.getWithMetadata<LegacyMeta>(name);
    const meta = legacy.metadata;
    const fileId = meta?.TgFileId;
    const fileName = meta?.FileName || name.replace(/^\d+_/, "");
    if (!fileId) {
      skipped += 1;
      continue;
    }
    const key = buildKeyId(fileTypeOf(fileName), fileId, extOf(fileName));
    if (key.length > 480) {
      skipped += 1;
      continue;
    }
    let existing;
    try {
      existing = await c.env.oh_file_url.getWithMetadata(key);
    } catch {
      skipped += 1;
      continue;
    }
    if (existing.metadata) {
      existed += 1;
      continue;
    }
    const sizeMb = Number(meta?.FileSize || 0);
    try {
      await c.env.oh_file_url.put(key, "", {
        metadata: {
          fileName,
          fileSize: Number.isFinite(sizeMb) ? Math.round(sizeMb * 1024 * 1024) : 0,
          uploadedAt: meta?.TimeStamp || Date.now(),
          liked: false,
          legacyKey: name,
        },
      });
      imported += 1;
    } catch {
      skipped += 1;
    }
    } catch {
      skipped += 1;
    }
  }
  return ok(c, {
    imported,
    existed,
    skipped,
    cursor: listed.list_complete ? "" : listed.cursor || "",
    list_complete: Boolean(listed.list_complete),
  });
});
