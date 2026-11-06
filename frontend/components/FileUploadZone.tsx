"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  FileText,
  FolderUp,
  Globe,
  HardDriveUpload,
  ImageIcon,
  Loader2,
  Lock,
  Music,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeChunkUpload,
  UploadAbortedError,
  uploadChunkDirectWithProgress,
  uploadChunkInit,
  uploadFileByUrl,
  uploadFileWithProgress,
} from "@/lib/api";
import {
  buildFileFingerprint,
  cn,
  formatEta,
  formatFileSize,
  formatTransferSpeed,
  getFileType,
  getFileTypeFromKey,
  getMissingChunkIndices,
  getUploadSession,
  loadUploadSessions,
  removeUploadSession,
  ResumableChunkRecord,
  ResumableUploadSession,
  runConcurrentPool,
  saveUploadSession,
  scanFiles,
} from "@/lib/utils";
import { useFileDataStore } from "@/stores/file";
import { nsfwDetector } from "@/lib/nsfw-detector";
import { toast } from "sonner";
import {
  FileItem,
  FileTag,
  FileType,
  MAX_CHUNK_SIZE,
  MAX_FILENAME_LENGTH,
  MAX_FILE_SIZE,
} from "@shared/types";
import { useGeneralSettingsStore } from "@/stores/general-store";
import { MAX_CONCURRENTS } from "@/lib/types";

type TaskStatus =
  | "queued"
  | "uploading"
  | "paused"
  | "finalizing"
  | "completed"
  | "error"
  | "cancelled";

interface UploadTask {
  id: string;
  fingerprint: string;
  file: File;
  fileName: string;
  fileSize: number;
  fileType: FileType;
  isChunked: boolean;
  status: TaskStatus;
  loadedBytes: number;
  percent: number;
  speedBps: number;
  etaSec: number;
  totalChunks: number;
  completedChunks: number;
  resumedChunks: number;
  tags: FileTag[];
  errorMessage?: string;
  resultKey?: string;
}

function normalizeFileLength(file: File): File {
  if (file.name.length <= MAX_FILENAME_LENGTH) return file;
  const extIndex = file.name.lastIndexOf(".");
  const ext = extIndex !== -1 ? file.name.substring(extIndex) : "";
  const nameWithoutExt =
    extIndex !== -1 ? file.name.substring(0, extIndex) : file.name;
  const truncatedName = nameWithoutExt.substring(
    0,
    Math.max(1, MAX_FILENAME_LENGTH - ext.length),
  );
  return new File([file], truncatedName + ext, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

function getUploadChunkSize(fileSize: number): number {
  return fileSize <= 256 * 1024 * 1024 ? 8 * 1024 * 1024 : MAX_CHUNK_SIZE;
}

function TypeBadgeIcon({ type }: { type: FileType }) {
  switch (type) {
    case FileType.Image:
      return <ImageIcon className="h-4 w-4 text-sky-500" />;
    case FileType.Video:
      return <Video className="h-4 w-4 text-teal-500" />;
    case FileType.Audio:
      return <Music className="h-4 w-4 text-emerald-500" />;
    default:
      return <FileText className="h-4 w-4 text-amber-500" />;
  }
}

export function FileUploadZone() {
  const addFileLocal = useFileDataStore((s) => s.addFileLocal);
  const { nsfwDetection, defaultUploadTags } = useGeneralSettingsStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [selectedTags, setSelectedTags] = useState<FileTag[]>([]);
  const [tagsInitialized, setTagsInitialized] = useState(false);

  const [showUrlIngest, setShowUrlIngest] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteFileName, setRemoteFileName] = useState("");
  const [isUrlUploading, setIsUrlUploading] = useState(false);

  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [savedSessions, setSavedSessions] = useState<ResumableUploadSession[]>(
    [],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const pendingResumeSessionRef = useRef<ResumableUploadSession | null>(null);

  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const inFlightProgressRef = useRef<Map<string, Map<number, number>>>(
    new Map(),
  );
  const pauseIntentRef = useRef<Set<string>>(new Set());
  const cancelIntentRef = useRef<Set<string>>(new Set());
  const speedTrackerRef = useRef<
    Map<string, { lastBytes: number; lastTime: number; emaSpeed: number }>
  >(new Map());
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (!tagsInitialized && Array.isArray(defaultUploadTags)) {
      setSelectedTags(defaultUploadTags);
      setTagsInitialized(true);
    }
  }, [defaultUploadTags, tagsInitialized]);

  const refreshSavedSessions = useCallback(() => {
    const map = loadUploadSessions();
    const list = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    setSavedSessions(list);
  }, []);

  useEffect(() => {
    refreshSavedSessions();
  }, [refreshSavedSessions]);

  const toggleTag = (tag: FileTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const updateTask = useCallback(
    (
      id: string,
      patch:
        | Partial<UploadTask>
        | ((prev: UploadTask) => Partial<UploadTask>),
    ) => {
      setTasks((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const nextPatch =
            typeof patch === "function" ? patch(item) : patch;
          return { ...item, ...nextPatch };
        }),
      );
    },
    [],
  );

  const computeTransferMetrics = useCallback(
    (id: string, loadedBytes: number, totalBytes: number) => {
      const now = performance.now();
      const prev = speedTrackerRef.current.get(id);
      let emaSpeed = 0;

      if (!prev) {
        speedTrackerRef.current.set(id, {
          lastBytes: loadedBytes,
          lastTime: now,
          emaSpeed: 0,
        });
      } else {
        const dtSec = (now - prev.lastTime) / 1000;
        if (dtSec >= 0.25) {
          const deltaBytes = Math.max(0, loadedBytes - prev.lastBytes);
          const instantSpeed = deltaBytes / dtSec;
          emaSpeed =
            prev.emaSpeed > 0
              ? prev.emaSpeed * 0.65 + instantSpeed * 0.35
              : instantSpeed;
          speedTrackerRef.current.set(id, {
            lastBytes: loadedBytes,
            lastTime: now,
            emaSpeed,
          });
        } else {
          emaSpeed = prev.emaSpeed;
        }
      }

      const remaining = Math.max(0, totalBytes - loadedBytes);
      const etaSec = emaSpeed > 0 ? remaining / emaSpeed : 0;
      const percent =
        totalBytes > 0
          ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
          : 0;

      return { speedBps: emaSpeed, etaSec, percent };
    },
    [],
  );

  const executeUploadTask = useCallback(
    async (task: UploadTask) => {
      const {
        id,
        file,
        fileName,
        fileSize,
        fileType,
        isChunked,
        tags,
        fingerprint,
      } = task;

      if (fileSize > MAX_FILE_SIZE) {
        updateTask(id, {
          status: "error",
          errorMessage: `超过单文件上限 ${formatFileSize(MAX_FILE_SIZE)}`,
        });
        toast.warning(`${fileName} 超过大小上限 ${formatFileSize(MAX_FILE_SIZE)}`);
        return;
      }

      pauseIntentRef.current.delete(id);
      cancelIntentRef.current.delete(id);

      const controller = new AbortController();
      controllersRef.current.set(id, controller);
      speedTrackerRef.current.delete(id);

      updateTask(id, {
        status: "uploading",
        errorMessage: undefined,
      });

      try {
        if (!isChunked) {
          const isUnsafe =
            nsfwDetection && fileType === FileType.Image
              ? await nsfwDetector.isUnsafeImg(file)
              : false;

          const finalTags = Array.from(
            new Set([...tags, ...(isUnsafe ? [FileTag.NSFW] : [])]),
          );

          const key = await uploadFileWithProgress(
            file,
            { nsfw: isUnsafe, tags: finalTags },
            (p) => {
              const metrics = computeTransferMetrics(id, p.loaded, fileSize);
              updateTask(id, {
                loadedBytes: p.loaded,
                percent: p.percent,
                speedBps: metrics.speedBps,
                etaSec: metrics.etaSec,
              });
            },
            controller.signal,
          );

          const fileItem: FileItem = {
            name: key,
            metadata: {
              fileName,
              fileSize,
              uploadedAt: Date.now(),
              liked: false,
              tags: finalTags,
            },
          };

          addFileLocal(fileItem, fileType);
          updateTask(id, {
            status: "completed",
            loadedBytes: fileSize,
            percent: 100,
            speedBps: 0,
            etaSec: 0,
            completedChunks: 1,
            resultKey: key,
          });
          return;
        }

        const transferChunkSize = getUploadChunkSize(fileSize);
        const totalChunks = Math.ceil(fileSize / transferChunkSize);
        let session = getUploadSession(fingerprint);

        if (
          !session ||
          session.totalChunks !== totalChunks ||
          session.fileSize !== fileSize
        ) {
          const key = await uploadChunkInit({
            fileType,
            fileName,
            fileSize,
            totalChunks,
            tags,
            deferKv: true,
          });

          session = {
            fingerprint,
            key,
            fileType,
            fileName,
            fileSize,
            lastModified: file.lastModified,
            totalChunks,
            tags,
            uploadedChunks: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          saveUploadSession(session);
          refreshSavedSessions();
        }

        const uploadedIndices = Object.keys(session.uploadedChunks).map(Number);
        const missingIndices = getMissingChunkIndices(
          totalChunks,
          uploadedIndices,
        );

        let completedBytes = 0;
        for (const idx of uploadedIndices) {
          const rec = session.uploadedChunks[idx];
          if (rec) completedBytes += rec.size;
        }

        const inFlightBytes = new Map<number, number>();
        inFlightProgressRef.current.set(id, inFlightBytes);

        const updateConfirmedProgress = () => {
          const percent = Math.min(
            99,
            Math.round((completedBytes / fileSize) * 100),
          );
          const metrics = computeTransferMetrics(id, completedBytes, fileSize);
          updateTask(id, {
            loadedBytes: completedBytes,
            percent,
            speedBps: metrics.speedBps,
            etaSec: metrics.etaSec,
          });
        };

        speedTrackerRef.current.set(id, {
          lastBytes: completedBytes,
          lastTime: performance.now(),
          emaSpeed: 0,
        });

        updateTask(id, {
          loadedBytes: completedBytes,
          completedChunks: uploadedIndices.length,
          resumedChunks: uploadedIndices.length,
          percent: Math.min(99, Math.round((completedBytes / fileSize) * 100)),
        });

        let currentSession: ResumableUploadSession = {
          ...session,
          uploadedChunks: { ...session.uploadedChunks },
        };

        if (missingIndices.length > 0) {
          await runConcurrentPool(
            missingIndices,
            MAX_CONCURRENTS,
            async (chunkIdx) => {
              if (controller.signal.aborted) {
                throw new UploadAbortedError();
              }

              const start = chunkIdx * transferChunkSize;
              const end = Math.min(start + transferChunkSize, fileSize);
              const chunkBlob = file.slice(start, end);
              const expectedChunkSize = end - start;

              const result = await uploadChunkDirectWithProgress(
                currentSession.key,
                chunkIdx,
                chunkBlob,
                fileName,
                (p) => {
                  inFlightBytes.set(
                    chunkIdx,
                    Math.min(p.loaded, expectedChunkSize),
                  );
                  let activeIngress = 0;
                  inFlightBytes.forEach((v) => {
                    activeIngress += v;
                  });
                  const metrics = computeTransferMetrics(
                    id,
                    completedBytes + activeIngress,
                    fileSize,
                  );
                  updateTask(id, {
                    loadedBytes: completedBytes,
                    percent: Math.min(
                      99,
                      Math.round((completedBytes / fileSize) * 100),
                    ),
                    speedBps: metrics.speedBps,
                    etaSec: metrics.etaSec,
                  });
                },
                controller.signal,
              );

              inFlightBytes.delete(chunkIdx);
              const chunkRecord: ResumableChunkRecord = {
                idx: chunkIdx,
                file_id: result.chunkId,
                size: result.size || expectedChunkSize,
                ...(result.thumbUrl ? { thumbUrl: result.thumbUrl } : {}),
              };

              currentSession = {
                ...currentSession,
                ...(result.thumbUrl && !currentSession.thumbUrl
                  ? { thumbUrl: result.thumbUrl }
                  : {}),
                uploadedChunks: {
                  ...currentSession.uploadedChunks,
                  [chunkIdx]: chunkRecord,
                },
                updatedAt: Date.now(),
              };

              saveUploadSession(currentSession);
              completedBytes += chunkRecord.size;
              const completedCount = Object.keys(
                currentSession.uploadedChunks,
              ).length;
              updateConfirmedProgress();

              updateTask(id, {
                completedChunks: completedCount,
              });
            },
            () => controller.signal.aborted,
          );
        }
        inFlightProgressRef.current.delete(id);

        if (controller.signal.aborted) {
          throw new UploadAbortedError();
        }

        updateTask(id, {
          status: "finalizing",
          percent: 99,
          speedBps: 0,
          etaSec: 0,
        });

        const orderedChunks = Object.values(currentSession.uploadedChunks)
          .map(({ idx, file_id, size }) => ({ idx, file_id, size }))
          .sort((a, b) => a.idx - b.idx);

        const finalized = await completeChunkUpload({
          key: currentSession.key,
          fileType,
          fileName,
          fileSize,
          totalChunks,
          tags,
          thumbUrl: currentSession.thumbUrl,
          chunks: orderedChunks,
        });

        removeUploadSession(fingerprint);
        refreshSavedSessions();

        const fileItem: FileItem = {
          name: finalized.key,
          metadata: finalized.metadata,
        };

        addFileLocal(fileItem, fileType);
        updateTask(id, {
          status: "completed",
          loadedBytes: fileSize,
          completedChunks: totalChunks,
          percent: 100,
          speedBps: 0,
          etaSec: 0,
          resultKey: finalized.key,
        });
      } catch (err) {
        if (cancelIntentRef.current.has(id)) {
          removeUploadSession(fingerprint);
          refreshSavedSessions();
          updateTask(id, {
            status: "cancelled",
            speedBps: 0,
            etaSec: 0,
          });
          return;
        }

        if (
          pauseIntentRef.current.has(id) ||
          err instanceof UploadAbortedError
        ) {
          refreshSavedSessions();
          updateTask(id, {
            status: "paused",
            speedBps: 0,
            etaSec: 0,
          });
          return;
        }

        refreshSavedSessions();
        const message = err instanceof Error ? err.message : "上传失败";
        updateTask(id, {
          status: "error",
          speedBps: 0,
          etaSec: 0,
          errorMessage: message,
        });
      } finally {
        controllersRef.current.delete(id);
        inFlightProgressRef.current.delete(id);
      }
    },
    [
      addFileLocal,
      computeTransferMetrics,
      nsfwDetection,
      refreshSavedSessions,
      updateTask,
    ],
  );

  const enqueueFiles = useCallback(
    async (rawFiles: FileList | File[]) => {
      const arr = Array.isArray(rawFiles) ? rawFiles : Array.from(rawFiles);
      if (!arr.length) return;

      const normalized = arr.map(normalizeFileLength);
      const newTasks: UploadTask[] = normalized.map((file) => {
        const fileType = getFileType(file.type, file.name);
        const isChunked = file.size > MAX_CHUNK_SIZE;
        const totalChunks = isChunked
          ? Math.ceil(file.size / getUploadChunkSize(file.size))
          : 1;
        const fingerprint = buildFileFingerprint(file);
        const existingSession = isChunked
          ? getUploadSession(fingerprint)
          : null;
        const resumedChunks = existingSession
          ? Object.keys(existingSession.uploadedChunks).length
          : 0;
        const resumedBytes = existingSession
          ? Object.values(existingSession.uploadedChunks).reduce(
              (acc, c) => acc + c.size,
              0,
            )
          : 0;

        return {
          id: `${fingerprint}::${crypto.randomUUID().slice(0, 8)}`,
          fingerprint,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType,
          isChunked,
          status: "queued",
          loadedBytes: resumedBytes,
          percent:
            file.size > 0
              ? Math.min(99, Math.round((resumedBytes / file.size) * 100))
              : 0,
          speedBps: 0,
          etaSec: 0,
          totalChunks,
          completedChunks: resumedChunks,
          resumedChunks,
          tags: [...selectedTags],
        };
      });

      setQueueCollapsed(false);
      setTasks((prev) => [...newTasks, ...prev]);

      const hasLargeFile = newTasks.some((t) => t.isChunked);
      const fileConcurrency = hasLargeFile ? 1 : MAX_CONCURRENTS;

      await runConcurrentPool(newTasks, fileConcurrency, async (task) => {
        if (
          pauseIntentRef.current.has(task.id) ||
          cancelIntentRef.current.has(task.id)
        ) {
          return;
        }
        await executeUploadTask(task);
      });
    },
    [executeUploadTask, selectedTags],
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        toast.info(`已捕获剪贴板中的 ${files.length} 个文件，开始上传`);
        void enqueueFiles(files);
      }
    };

    const handleWindowDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      dragDepthRef.current += 1;
      setIsGlobalDragging(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsGlobalDragging(false);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };

    const handleWindowDrop = async (e: DragEvent) => {
      dragDepthRef.current = 0;
      setIsGlobalDragging(false);
      setIsDragging(false);
      if (!e.dataTransfer) return;
      if ((e as any).__otterHandled) return;
      if (e.dataTransfer.files?.length || e.dataTransfer.items?.length) {
        e.preventDefault();
        if (e.dataTransfer.items) {
          const scanned = await scanFiles(e.dataTransfer.items);
          if (scanned.length) void enqueueFiles(scanned);
        } else if (e.dataTransfer.files.length) {
          void enqueueFiles(e.dataTransfer.files);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [enqueueFiles]);

  const handlePauseTask = (taskId: string) => {
    pauseIntentRef.current.add(taskId);
    const ctrl = controllersRef.current.get(taskId);
    if (ctrl) {
      ctrl.abort();
    } else {
      updateTask(taskId, { status: "paused", speedBps: 0, etaSec: 0 });
    }
  };

  const handleResumeOrRetryTask = (task: UploadTask) => {
    pauseIntentRef.current.delete(task.id);
    cancelIntentRef.current.delete(task.id);
    void executeUploadTask(task);
  };

  const handleCancelTask = (task: UploadTask) => {
    cancelIntentRef.current.add(task.id);
    const ctrl = controllersRef.current.get(task.id);
    if (ctrl) {
      ctrl.abort();
    }
    removeUploadSession(task.fingerprint);
    refreshSavedSessions();
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  };

  const handleRemoteUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = remoteUrl.trim();
    if (!trimmedUrl || isUrlUploading) return;

    try {
      new URL(trimmedUrl);
    } catch {
      toast.error("请输入有效的 HTTP/HTTPS 文件直链");
      return;
    }

    setIsUrlUploading(true);
    const toastId = toast.loading("正在通过边缘节点拉取远程文件...");
    try {
      const { key, fileSize } = await uploadFileByUrl({
        url: trimmedUrl,
        fileName: remoteFileName.trim() || undefined,
        isNsfw: selectedTags.includes(FileTag.NSFW),
        tags: selectedTags,
      });

      const fileType = getFileTypeFromKey(key);
      const inferredName =
        remoteFileName.trim() ||
        decodeURIComponent(
          trimmedUrl.split("?")[0].split("/").pop() || "remote_file",
        ).slice(0, MAX_FILENAME_LENGTH);

      addFileLocal(
        {
          name: key,
          metadata: {
            fileName: inferredName,
            fileSize: fileSize || 0,
            uploadedAt: Date.now(),
            liked: false,
            tags: [...selectedTags],
          },
        },
        fileType,
      );

      setRemoteUrl("");
      setRemoteFileName("");
      setShowUrlIngest(false);
      toast.success(`远程转存完成：${inferredName}`, { id: toastId });
    } catch (err) {
      toast.error(
        `远程拉取失败：${err instanceof Error ? err.message : "未知错误"}`,
        { id: toastId },
      );
    } finally {
      setIsUrlUploading(false);
    }
  };

  const activeFingerprints = useMemo(
    () => new Set(tasks.map((t) => t.fingerprint)),
    [tasks],
  );

  const pendingSessions = useMemo(
    () =>
      savedSessions.filter(
        (s) =>
          !activeFingerprints.has(s.fingerprint) &&
          Object.keys(s.uploadedChunks).length > 0 &&
          Object.keys(s.uploadedChunks).length < s.totalChunks,
      ),
    [savedSessions, activeFingerprints],
  );

  const queueStats = useMemo(() => {
    const active = tasks.filter(
      (t) =>
        t.status === "uploading" ||
        t.status === "finalizing" ||
        t.status === "queued",
    );
    const paused = tasks.filter((t) => t.status === "paused");
    const completed = tasks.filter((t) => t.status === "completed");
    const failed = tasks.filter((t) => t.status === "error");
    const totalSpeed = active.reduce((acc, t) => acc + (t.speedBps || 0), 0);
    const totalBytes = tasks.reduce((acc, t) => acc + t.fileSize, 0);
    const loadedBytes = tasks.reduce(
      (acc, t) =>
        acc + (t.status === "completed" ? t.fileSize : t.loadedBytes || 0),
      0,
    );
    const overallPercent =
      totalBytes > 0
        ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
        : 0;

    return {
      activeCount: active.length,
      pausedCount: paused.length,
      completedCount: completed.length,
      failedCount: failed.length,
      totalSpeed,
      overallPercent,
      totalBytes,
      loadedBytes,
    };
  }, [tasks]);

  return (
    <div className="space-y-3">
      {/* Global Drag Overlay */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-background/95 p-6">
          <div className="flex flex-col items-center justify-center rounded-[var(--r-lg)] border-2 border-dashed border-primary bg-card px-12 py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--r-md)] bg-secondary text-foreground border border-border">
              <CloudUpload className="h-7 w-7 taste-accent-text" />
            </div>
            <p className="text-lg font-medium text-foreground">
              释放鼠标以开始分片直传
            </p>
            <p className="mt-1 text-sm text-muted-foreground font-mono tabular-nums">
              大于 20 MB 自动开启并发分片与本地断点保护（上限{" "}
              {formatFileSize(MAX_FILE_SIZE)}）
            </p>
          </div>
        </div>
      )}

      {/* Main Upload Workbench */}
      <div
        onDrop={async (e) => {
          e.preventDefault();
          (e.nativeEvent as any).__otterHandled = true;
          dragDepthRef.current = 0;
          setIsGlobalDragging(false);
          setIsDragging(false);

          if (e.dataTransfer.items) {
            const files = await scanFiles(e.dataTransfer.items);
            void enqueueFiles(files);
          } else {
            void enqueueFiles(e.dataTransfer.files);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={cn(
          "relative overflow-hidden rounded-[var(--r-md)] border transition-colors duration-150",
          isDragging
            ? "border-primary bg-secondary"
            : "border-border bg-card hover:border-foreground/25",
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5">
          {/* Left: Dropzone Trigger */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="flex flex-1 items-center gap-4 cursor-pointer group focus-visible:outline-none text-left"
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] border transition-colors duration-150",
                isDragging
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-foreground group-hover:border-foreground/30",
              )}
            >
              <CloudUpload className="h-5 w-5 taste-accent-text" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm sm:text-base font-medium text-foreground tracking-tight">
                  {isDragging
                    ? "释放文件以启动上传"
                    : "拖拽文件或文件夹至此，点击选择或按 Ctrl+V 粘贴"}
                </p>
              </div>
              <p className="mt-1 text-xs font-mono text-muted-foreground tabular-nums">
                单文件上限 {formatFileSize(MAX_FILE_SIZE)} · 8–20 MB 自适应分片 ·
                断点秒续 · 图片 / 视频 / 音频 / 文档
              </p>
            </div>
          </div>

          {/* Right: Metadata Switches + Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded-[var(--r-btn)] bg-secondary p-1 border border-border">
              <button
                type="button"
                onClick={() => toggleTag(FileTag.Private)}
                title="开启后文件仅登录本人可见，外部直链需鉴权"
                className={cn(
                  "inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  selectedTags.includes(FileTag.Private)
                    ? "bg-card text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Lock className="h-3 w-3" />
                <span>私有</span>
              </button>
              <button
                type="button"
                onClick={() => toggleTag(FileTag.NSFW)}
                title="标记为敏感内容，安全模式下自动模糊遮罩"
                className={cn(
                  "inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  selectedTags.includes(FileTag.NSFW)
                    ? "bg-card text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ShieldAlert className="h-3 w-3" />
                <span>NSFW</span>
              </button>
            </div>

            <Button
              type="button"
              size="default"
              onClick={() => fileInputRef.current?.click()}
            >
              <HardDriveUpload className="h-4 w-4" />
              <span>Add files</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => folderInputRef.current?.click()}
              title="上传整个文件夹"
            >
              <FolderUp className="h-4 w-4" />
              <span className="hidden sm:inline">Add folder</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => setShowUrlIngest((v) => !v)}
              className={cn(
                showUrlIngest && "border-primary text-foreground",
              )}
              title="通过远程 URL 边缘流式转存"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Fetch URL</span>
            </Button>
          </div>
        </div>

        {/* Expandable Remote URL Ingest Form */}
        {showUrlIngest && (
          <form
            onSubmit={handleRemoteUrlSubmit}
            className="border-t border-border bg-secondary/50 px-4 py-3 sm:px-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="url"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="粘贴 HTTP / HTTPS 远程文件直链，由边缘节点直接拉取入库..."
                disabled={isUrlUploading}
                className="h-9 pl-9 bg-card border-border text-sm rounded-[var(--r-btn)]"
                required
              />
            </div>
            <Input
              type="text"
              value={remoteFileName}
              onChange={(e) => setRemoteFileName(e.target.value)}
              placeholder="可选：自定义文件名"
              disabled={isUrlUploading}
              className="h-9 sm:w-48 bg-card border-border text-sm rounded-[var(--r-btn)]"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowUrlIngest(false)}
                disabled={isUrlUploading}
              >
                收起
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isUrlUploading || !remoteUrl.trim()}
              >
                {isUrlUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>转存中...</span>
                  </>
                ) : (
                  <span>立即拉取</span>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Hidden File Pickers */}
        <input
          ref={fileInputRef}
          data-otter-upload="files"
          type="file"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              void enqueueFiles(e.target.files);
              e.target.value = "";
            }
          }}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          data-otter-upload="folder"
          type="file"
          multiple
          {...({ webkitdirectory: "", directory: "" } as any)}
          onChange={(e) => {
            if (e.target.files?.length) {
              void enqueueFiles(e.target.files);
              e.target.value = "";
            }
          }}
          className="hidden"
        />
        <input
          ref={resumeInputRef}
          type="file"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            const targetSession = pendingResumeSessionRef.current;
            e.target.value = "";
            if (!picked || !targetSession) return;

            const normalizedPicked = normalizeFileLength(picked);
            if (normalizedPicked.size !== targetSession.fileSize) {
              toast.error(
                `文件大小不匹配：期望 ${formatFileSize(targetSession.fileSize)}，实际 ${formatFileSize(normalizedPicked.size)}`,
              );
              return;
            }

            const newFp = buildFileFingerprint(normalizedPicked);
            if (newFp !== targetSession.fingerprint) {
              saveUploadSession({
                ...targetSession,
                fingerprint: newFp,
                fileName: normalizedPicked.name,
                lastModified: normalizedPicked.lastModified,
              });
              removeUploadSession(targetSession.fingerprint);
              refreshSavedSessions();
            }

            pendingResumeSessionRef.current = null;
            void enqueueFiles([normalizedPicked]);
          }}
          className="hidden"
        />
      </div>

      {/* Saved Resumable Upload Sessions */}
      {pendingSessions.length > 0 && (
        <div className="rounded-[var(--r-md)] border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <RotateCcw className="h-3.5 w-3.5 taste-accent-text" />
              <span>检测到 {pendingSessions.length} 个未完成的大文件断点记录</span>
            </div>
            <button
              type="button"
              onClick={() => {
                pendingSessions.forEach((s) =>
                  removeUploadSession(s.fingerprint),
                );
                refreshSavedSessions();
                toast.success("已清空本地断点记录");
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              全部忽略
            </button>
          </div>
          <div className="space-y-1.5">
            {pendingSessions.slice(0, 3).map((session) => {
              const doneCount = Object.keys(session.uploadedChunks).length;
              const pct = Math.round((doneCount / session.totalChunks) * 100);
              return (
                <div
                  key={session.fingerprint}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-sm)] bg-secondary px-3 py-2 border border-border text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <TypeBadgeIcon type={session.fileType} />
                    <span className="font-medium text-foreground truncate">
                      {session.fileName}
                    </span>
                    <span className="font-mono text-muted-foreground shrink-0 tabular-nums">
                      ({formatFileSize(session.fileSize)} · 已传 {doneCount}/
                      {session.totalChunks} 片 · {pct}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        pendingResumeSessionRef.current = session;
                        resumeInputRef.current?.click();
                      }}
                      className="h-7 px-2.5 text-xs"
                    >
                      选择原文件续传
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        removeUploadSession(session.fingerprint);
                        refreshSavedSessions();
                      }}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="移除此断点记录"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Transfer Queue Ledger */}
      {tasks.length > 0 && (
        <div className="rounded-[var(--r-md)] border border-border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-secondary/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2">
                {queueStats.activeCount > 0 ? (
                  <Loader2 className="h-4 w-4 taste-accent-text animate-spin" />
                ) : queueStats.failedCount > 0 ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <span className="text-sm font-medium text-foreground">
                  传输队列
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground tabular-nums">
                <span>
                  已完成 {queueStats.completedCount}/{tasks.length}
                </span>
                <span>·</span>
                <span>
                  {formatFileSize(queueStats.loadedBytes)} /{" "}
                  {formatFileSize(queueStats.totalBytes)} (
                  {queueStats.overallPercent}%)
                </span>
                {queueStats.activeCount > 0 && queueStats.totalSpeed > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-medium taste-accent-text">
                      {formatTransferSpeed(queueStats.totalSpeed)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {queueStats.activeCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    tasks.forEach((t) => {
                      if (t.status === "uploading" || t.status === "queued") {
                        handlePauseTask(t.id);
                      }
                    });
                  }}
                  className="h-7 px-2.5 text-xs"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>全部暂停</span>
                </Button>
              )}

              {(queueStats.pausedCount > 0 || queueStats.failedCount > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    tasks.forEach((t) => {
                      if (t.status === "paused" || t.status === "error") {
                        handleResumeOrRetryTask(t);
                      }
                    });
                  }}
                  className="h-7 px-2.5 text-xs taste-accent-text"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>全部继续</span>
                </Button>
              )}

              {queueStats.completedCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setTasks((prev) =>
                      prev.filter((t) => t.status !== "completed"),
                    )
                  }
                  className="h-7 px-2.5 text-xs"
                >
                  清除已完成
                </Button>
              )}

              {queueStats.activeCount === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTasks([])}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="关闭传输面板"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setQueueCollapsed((v) => !v)}
                className="h-7 w-7 text-muted-foreground"
                title={queueCollapsed ? "展开队列" : "收起队列"}
              >
                {queueCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="h-1 w-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${queueStats.overallPercent}%` }}
            />
          </div>

          {!queueCollapsed && (
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {tasks.map((task) => {
                const isRunning =
                  task.status === "uploading" || task.status === "finalizing";
                return (
                  <div
                    key={task.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-secondary border border-border">
                      <TypeBadgeIcon type={task.fileType} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="text-sm font-medium text-foreground truncate"
                            title={task.fileName}
                          >
                            {task.fileName}
                          </span>
                          {task.isChunked && (
                            <span className="shrink-0 rounded-[4px] bg-secondary border border-border px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground tabular-nums">
                              分片 {task.completedChunks}/{task.totalChunks}
                            </span>
                          )}
                          {task.resumedChunks > 0 &&
                            task.status !== "completed" && (
                              <span className="shrink-0 rounded-[4px] bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-mono text-amber-800 dark:text-amber-300">
                                断点续传
                              </span>
                            )}
                        </div>

                        <span className="text-xs font-mono font-medium tabular-nums shrink-0 text-foreground">
                          {task.status === "completed"
                            ? "已完成"
                            : task.status === "finalizing"
                              ? "合并校验中..."
                              : task.status === "paused"
                                ? `已暂停 · ${task.percent}%`
                                : task.status === "error"
                                  ? "上传失败"
                                  : task.status === "queued"
                                    ? "排队中"
                                    : `${task.percent}%`}
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-[3px] bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-[width] duration-200 ease-out",
                            task.status === "completed"
                              ? "bg-emerald-500"
                              : task.status === "error"
                                ? "bg-destructive"
                                : task.status === "paused"
                                  ? "bg-amber-500"
                                  : "bg-primary",
                          )}
                          style={{
                            width: `${task.status === "completed" ? 100 : task.percent}%`,
                          }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground tabular-nums">
                        <span>
                          {formatFileSize(
                            task.status === "completed"
                              ? task.fileSize
                              : task.loadedBytes,
                          )}{" "}
                          / {formatFileSize(task.fileSize)}
                        </span>

                        {task.status === "error" ? (
                          <span className="text-destructive truncate max-w-[65%]">
                            {task.errorMessage || "网络异常，点击右侧重试可从断点继续"}
                          </span>
                        ) : isRunning ? (
                          <span className="text-muted-foreground">
                            {task.status === "finalizing"
                              ? "正在原子写入元数据..."
                              : `${formatTransferSpeed(task.speedBps)} · 剩余 ${formatEta(task.etaSec)}`}
                          </span>
                        ) : task.status === "paused" ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            已完成分片已自动暂存，随时继续
                          </span>
                        ) : task.status === "completed" ? (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            上传入库成功
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {(task.status === "uploading" ||
                        task.status === "queued") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handlePauseTask(task.id)}
                          title="暂停上传"
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}

                      {(task.status === "paused" ||
                        task.status === "error") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleResumeOrRetryTask(task)}
                          className="taste-accent-text"
                          title={
                            task.status === "paused" ? "继续上传" : "断点重试"
                          }
                        >
                          {task.status === "paused" ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {task.status !== "finalizing" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCancelTask(task)}
                          className="text-muted-foreground hover:text-destructive"
                          title={
                            task.status === "completed"
                              ? "移除记录"
                              : "取消上传"
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
