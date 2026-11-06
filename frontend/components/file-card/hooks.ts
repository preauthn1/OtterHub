import { useState, useMemo, useRef } from "react";
import {
  useActiveSelectedKeys,
  useFileDataStore,
  useFileUIStore,
} from "@/stores/file";
import {
  getFileTypeFromKey,
  downloadFile,
  getMissingChunkIndices,
  runConcurrentPool,
} from "@/lib/utils";
import {
  completeChunkUpload,
  getFileDownloadUrl,
  getFileUrl,
  moveToTrash,
  toggleLike,
  uploadChunkDirectWithProgress,
} from "@/lib/api";
import {
  MAX_CONCURRENTS,
  binaryExtensions,
  DIRECT_DOWNLOAD_LIMIT,
} from "@/lib/types";
import { toast } from "sonner";
import { shouldBlur } from "@/lib/utils";
import { Chunk, FileItem, FileType, MAX_CHUNK_SIZE } from "@shared/types";
import { useGeneralSettingsStore } from "@/stores/general-store";
import { usePreviewStore } from "@/stores/preview-store";
import { isMobileBrowser } from "@/hooks/use-mobile";

function shouldOpenLargeMediaOnMobile(fileType: FileType, fileSize: number) {
  return (
    isMobileBrowser() &&
    fileSize > DIRECT_DOWNLOAD_LIMIT &&
    (fileType === FileType.Audio || fileType === FileType.Video)
  );
}

export function useFileCardActions(file: FileItem) {
  const { updateFileMetadata, moveToTrashLocal } = useFileDataStore();
  const { toggleSelection } = useFileUIStore();
  const { safeMode } = useGeneralSettingsStore();
  const { openPreview } = usePreviewStore();
  const selectedKeys = useActiveSelectedKeys();

  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isSelected = selectedKeys.includes(file.name);
  const fileType = useMemo(() => getFileTypeFromKey(file.name), [file.name]);
  const blur = shouldBlur({ safeMode, tags: file.metadata?.tags ?? [] });
  const isIncompleteUpload = Boolean(
    file.metadata?.chunkInfo &&
      file.metadata.chunkInfo.uploadedIndices?.length !==
        file.metadata.chunkInfo.total,
  );

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelection(file.name, fileType);
  };

  const handleDelete = () => {
    if (!confirm(`确定将「${file.metadata?.fileName}」移入回收站吗？`)) return;
    moveToTrash(file.name).then(() => {
      moveToTrashLocal(file);
      toast.success("已移入回收站");
    });
  };

  const handleCopyLink = () => {
    const url = getFileUrl(file.name);
    navigator.clipboard.writeText(url);
    toast.success("直链已复制到剪贴板");
  };

  const handleShare = () => {
    setShowShare(true);
  };

  const handleDownload = () => {
    const url = getFileDownloadUrl(file.name);
    const fileName = file.metadata?.fileName || file.name;
    const fileSize = file.metadata?.fileSize || 0;

    if (shouldOpenLargeMediaOnMobile(fileType, fileSize)) {
      toast.info("已打开媒体流链接，可通过浏览器直接保存");
      window.open(getFileUrl(file.name), "_blank", "noopener,noreferrer");
      return;
    }

    const toastId =
      fileSize > DIRECT_DOWNLOAD_LIMIT
        ? toast.loading(`准备下载: ${fileName}`)
        : null;

    void downloadFile(url, file.metadata, (progress) => {
      if (!toastId) return;
      const message = progress.dirName
        ? `下载至 ${progress.dirName}: ${fileName} (${progress.percentage}%)`
        : `下载中: ${fileName} (${progress.percentage}%)`;
      toast.loading(message, { id: toastId });
    })
      .then((result) => {
        if (!toastId) return;
        if (result.status === "cancelled") {
          toast.dismiss(toastId);
          return;
        }
        const message = result.dirName
          ? `下载完成: ${fileName}（已保存至 ${result.dirName}）`
          : `下载完成: ${fileName}`;
        toast.success(message, { id: toastId });
      })
      .catch(() => {
        if (toastId) {
          toast.error(`下载失败: ${fileName}`, { id: toastId });
        } else {
          toast.error("下载失败");
        }
      });
  };

  const handleView = () => {
    const url = getFileUrl(file.name);
    const fileName = file.metadata?.fileName?.toLowerCase() || "";
    const fileSize = file.metadata?.fileSize || 0;

    const canPreviewAsText =
      fileType === FileType.Document &&
      !binaryExtensions.some((ext) => fileName.endsWith(ext)) &&
      fileSize <= DIRECT_DOWNLOAD_LIMIT;

    if (fileType === FileType.Document) {
      if (!canPreviewAsText) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      openPreview(file, "text");
      return;
    }

    if (fileType === FileType.Video) {
      openPreview(file, "video");
      return;
    }

    if (fileType === FileType.Audio) {
      openPreview(file, "audio");
      return;
    }

    if (fileSize > DIRECT_DOWNLOAD_LIMIT) {
      handleDownload();
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleEdit = () => {
    setShowEdit(true);
  };

  const handleEditSuccess = (updatedMetadata: any) => {
    updateFileMetadata(file.name, {
      ...file.metadata,
      ...updatedMetadata,
    });
  };

  const handleToggleLike = () => {
    toggleLike(file.name).then(() => {
      updateFileMetadata(file.name, {
        ...file.metadata,
        liked: !file.metadata.liked,
      });
    });
  };

  const handleResumeUpload = () => {
    inputRef.current?.click();
  };

  const handleResumeFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = e.target.files?.[0];
    e.target.value = "";
    if (!selectedFile || !isIncompleteUpload) return;

    if (selectedFile.size !== file.metadata?.fileSize) {
      toast.error("所选文件大小与待续传记录不一致");
      return;
    }

    setIsResuming(true);
    const chunkInfo = file.metadata.chunkInfo!;
    const totalChunks = chunkInfo.total;
    const toastId = toast.loading(`正在断点续传: ${file.metadata.fileName}...`);

    try {
      const chunkIndicesToUpload = getMissingChunkIndices(
        totalChunks,
        chunkInfo.uploadedIndices,
      );

      const newChunks: Chunk[] = [];
      let thumbUrl: string | undefined;
      let done = 0;

      await runConcurrentPool(
        chunkIndicesToUpload,
        MAX_CONCURRENTS,
        async (chunkIndex) => {
          const start = chunkIndex * MAX_CHUNK_SIZE;
          const endPos = Math.min(start + MAX_CHUNK_SIZE, selectedFile.size);
          const chunkBlob = selectedFile.slice(start, endPos);

          const res = await uploadChunkDirectWithProgress(
            file.name,
            chunkIndex,
            chunkBlob,
            file.metadata.fileName,
          );
          if (res.thumbUrl && !thumbUrl) {
            thumbUrl = res.thumbUrl;
          }
          newChunks.push({
            idx: chunkIndex,
            file_id: res.chunkId,
            size: res.size || endPos - start,
          });
          done += 1;
          toast.loading(
            `正在续传 ${file.metadata.fileName} (${done}/${chunkIndicesToUpload.length})`,
            { id: toastId },
          );
        },
      );

      const finalized = await completeChunkUpload({
        key: file.name,
        fileType,
        fileName: file.metadata.fileName,
        fileSize: file.metadata.fileSize,
        totalChunks,
        thumbUrl,
        chunks: newChunks,
      });

      updateFileMetadata(file.name, finalized.metadata);
      toast.success(`断点续传完成：${file.metadata.fileName}`, { id: toastId });
    } catch (error) {
      console.error("继续上传失败:", error);
      toast.error(
        `续传失败：${error instanceof Error ? error.message : "网络错误"}`,
        { id: toastId },
      );
    } finally {
      setIsResuming(false);
    }
  };

  return {
    isSelected,
    fileType,
    blur,
    isIncompleteUpload,
    showDetail,
    showEdit,
    showShare,
    isResuming,
    inputRef,
    setShowDetail,
    setShowEdit,
    setShowShare,
    handleSelect,
    handleDelete,
    handleCopyLink,
    handleShare,
    handleDownload,
    handleView,
    handleEdit,
    handleEditSuccess,
    handleToggleLike,
    handleResumeUpload,
    handleResumeFileSelect,
  };
}
