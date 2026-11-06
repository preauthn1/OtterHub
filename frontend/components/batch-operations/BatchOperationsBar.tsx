"use client";

import {
  Download,
  Trash2,
  X,
  Toolbox,
  Check,
  Tag,
  Copy,
  FilePen,
  Share2,
  ImageIcon,
  Music,
  Video,
  FileText,
  XIcon,
} from "lucide-react";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  useFileDataStore,
  useFilteredFiles,
  useFileBuckets,
} from "@/stores/file";
import {
  useFileUIStore,
  useActiveSelectedKeys,
  useTotalSelectedKeys,
  useSelectedStats,
  clearAllSelection,
  removeSelectionFromAllTypes,
} from "@/stores/file";
import {
  getFileDownloadUrl,
  getFileUrl,
  moveToTrash,
  deleteFile,
} from "@/lib/api";
import {
  downloadFile,
  downloadFiles,
  getFileTypeFromKey,
  processBatch,
  type DirectoryHandleResult,
} from "@/lib/utils";
import { ViewMode } from "@/lib/types";
import { BatchEditTagsDialog } from "./BatchEditTagsDialog";
import { BatchRenameDialog } from "./BatchRenameDialog";
import { BatchShareDialog } from "./BatchShareDialog";
import { MobileBatchDownloadDialog } from "./MobileBatchDownloadDialog";
import { DownloadDirectoryGuide } from "@/components/download/DownloadDirectoryGuide";
import { toast } from "sonner";
import {
  FileMetadata,
  FileTag,
  FileType,
  MAX_FILES_IN_BUNDLE,
} from "@shared/types";
import { isMobileBrowser } from "@/hooks/use-mobile";

const typeIcons: Record<FileType, typeof ImageIcon> = {
  [FileType.Image]: ImageIcon,
  [FileType.Audio]: Music,
  [FileType.Video]: Video,
  [FileType.Document]: FileText,
  [FileType.Trash]: Trash2,
};

const typeNames: Record<FileType, string> = {
  [FileType.Image]: "图片",
  [FileType.Audio]: "音频",
  [FileType.Video]: "视频",
  [FileType.Document]: "文档",
  [FileType.Trash]: "回收站",
};

export function BatchOperationsBar() {
  const { activeType, updateFileMetadata, moveToTrashLocal, deleteFilesLocal } =
    useFileDataStore();

  const {
    clearSelection,
    addSelection,
    removeSelection,
    viewMode,
    currentPage,
    itemsPerPage,
  } = useFileUIStore();

  const activeSelectedKeys = useActiveSelectedKeys();
  const totalSelectedKeys = useTotalSelectedKeys();
  const selectedStats = useSelectedStats();
  const buckets = useFileBuckets();

  const [showBatchTags, setShowBatchTags] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [showDirGuide, setShowDirGuide] = useState(false);
  const [showMobileBatchDownload, setShowMobileBatchDownload] = useState(false);
  const [mobileDownloadFiles, setMobileDownloadFiles] = useState<
    Array<{
      key: string;
      metadata: FileMetadata;
      fileType: FileType;
    }>
  >([]);
  const [pendingDownloadFiles, setPendingDownloadFiles] = useState<Array<{
    key: string;
    metadata: FileMetadata;
  }> | null>(null);

  const filteredFiles = useFilteredFiles();

  const allItems = useMemo(() => {
    return Object.values(buckets).flatMap((bucket) => bucket.items);
  }, [buckets]);

  const allItemMap = useMemo(() => {
    return new Map(allItems.map((f) => [f.name, f]));
  }, [allItems]);

  const selectedItems = useMemo(() => {
    return totalSelectedKeys
      .map((key) => allItemMap.get(key))
      .filter(Boolean) as typeof allItems;
  }, [totalSelectedKeys, allItemMap]);

  const currentCount = activeSelectedKeys.length;
  const totalCount = totalSelectedKeys.length;
  const hasCrossTypeSelection = totalCount > currentCount;

  const currentFiles = useMemo(() => {
    if (viewMode === ViewMode.Masonry) return filteredFiles;
    const offset = currentPage * itemsPerPage;
    return filteredFiles.slice(offset, offset + itemsPerPage);
  }, [filteredFiles, viewMode, currentPage, itemsPerPage]);

  const activeSelectedSet = useMemo(
    () => new Set(activeSelectedKeys),
    [activeSelectedKeys],
  );

  const isAllSelected =
    currentFiles.length > 0 &&
    currentFiles.every((file) => activeSelectedSet.has(file.name));

  const handleBatchTagSuccess = (
    updatedFiles: Array<{ name: string; tags: FileTag[] }>,
  ) => {
    updatedFiles.forEach(({ name, tags }) => {
      const file = allItemMap.get(name);
      if (!file) return;

      updateFileMetadata(name, {
        ...file.metadata,
        tags,
      });
    });
  };

  const handleBatchRenameSuccess = (
    updatedFiles: Array<{ name: string; fileName: string }>,
  ) => {
    updatedFiles.forEach(({ name, fileName }) => {
      const file = allItemMap.get(name);
      if (!file) return;

      updateFileMetadata(name, {
        ...file.metadata,
        fileName,
      });
    });
  };

  const startBatchDownload = async (
    files: Array<{ key: string; metadata: FileMetadata }>,
    dirHandleResult?: DirectoryHandleResult,
  ) => {
    const toastId = toast.loading(`准备下载 ${files.length} 个文件...`);
    let downloadDirName: string | null = null;

    try {
      const downloadOptions = {
        files,
        getUrl: getFileDownloadUrl,
        onDirectorySelected: (dirName: string) => {
          downloadDirName = dirName;
          toast.loading(`正在下载到 ${dirName}...`, { id: toastId });
        },
        onDirectoryReused: (dirName: string) => {
          downloadDirName = dirName;
          toast.loading(`正在下载到 ${dirName}...`, { id: toastId });
        },
        onFileStart: (index: number, fileName: string) => {
          const prefix = downloadDirName
            ? `下载到 ${downloadDirName}`
            : "下载中";
          toast.loading(
            `${prefix} (${index + 1}/${files.length}): ${fileName}`,
            { id: toastId },
          );
        },
        onFileComplete: (index: number, fileName: string, success: boolean) => {
          if (!success) {
            toast.error(`下载失败: ${fileName}`, { duration: 2000 });
          }
        },
      };

      const result = dirHandleResult
        ? await downloadFiles({ ...downloadOptions, dirHandleResult })
        : await downloadFiles(downloadOptions);

      if (result.cancelled > 0) {
        toast.info("下载已取消", { id: toastId });
      } else if (result.failed === 0) {
        toast.success(`成功下载 ${result.success} 个文件`, { id: toastId });
      } else {
        toast.warning("部分文件下载失败", {
          id: toastId,
          description: `成功 ${result.success} 个，失败 ${result.failed} 个`,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message === "NO_DIRECTORY_HANDLE") {
        toast.dismiss(toastId);
        setPendingDownloadFiles(files);
        setShowDirGuide(true);
      } else {
        toast.error("批量下载失败", { id: toastId });
      }
    }
  };

  const handleDirectorySelected = async (dirResult: DirectoryHandleResult) => {
    setShowDirGuide(false);
    if (!pendingDownloadFiles) return;
    await startBatchDownload(pendingDownloadFiles, dirResult);
    setPendingDownloadFiles(null);
  };

  const handleBatchDownload = async () => {
    if (totalSelectedKeys.length === 0) return;

    const files = totalSelectedKeys
      .map((key) => {
        const file = allItemMap.get(key);
        if (!file) return null;
        return {
          key,
          metadata: file.metadata,
          fileType: getFileTypeFromKey(key),
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      metadata: FileMetadata;
      fileType: FileType;
    }>;

    if (files.length === 1) {
      const [{ key, metadata }] = files;
      const toastId = toast.loading(`准备下载: ${metadata.fileName}`);

      try {
        const result = await downloadFile(
          getFileDownloadUrl(key),
          metadata,
          (progress) => {
            const message = progress.dirName
              ? `下载到 ${progress.dirName}: ${metadata.fileName} (${progress.percentage}%)`
              : `下载中: ${metadata.fileName} (${progress.percentage}%)`;
            toast.loading(message, { id: toastId });
          },
        );
        if (result.status === "cancelled") {
          toast.dismiss(toastId);
          return;
        }
        const message = result.dirName
          ? `下载完成: ${metadata.fileName}，已保存到 ${result.dirName}`
          : `下载完成: ${metadata.fileName}`;
        toast.success(message, { id: toastId });
      } catch (_error) {
        toast.error(`下载失败: ${metadata.fileName}`, { id: toastId });
      }
      return;
    }

    if (files.length > MAX_FILES_IN_BUNDLE) {
      toast.error(`批量下载最多支持 ${MAX_FILES_IN_BUNDLE} 个文件`);
      return;
    }

    const isMobile = isMobileBrowser();
    const canUseDirectoryPicker = "showDirectoryPicker" in window && !isMobile;

    if (!canUseDirectoryPicker) {
      setMobileDownloadFiles(files);
      setShowMobileBatchDownload(true);
      return;
    }

    await startBatchDownload(files);
  };

  const handleBatchDelete = async () => {
    const statsText = selectedStats
      .map((s) => `${typeNames[s.type]}:${s.count}`)
      .join("，");
    const confirmMsg = hasCrossTypeSelection
      ? `确认删除这 ${totalCount} 个文件？\n（${statsText}）`
      : `确认删除这 ${totalCount} 个文件？`;

    if (!confirm(confirmMsg)) return;

    const toastId = toast.loading(`正在删除 ${totalCount} 个文件...`);

    try {
      const successful: string[] = [];
      const failed: string[] = [];

      await processBatch(
        totalSelectedKeys,
        async (key) => {
          try {
            const success = await moveToTrash(key);
            if (success) {
              successful.push(key);
            } else {
              failed.push(key);
            }
          } catch (_err) {
            failed.push(key);
          }
        },
        (current, total) => {
          toast.loading(`正在删除 ${current}/${total} 个文件...`, {
            id: toastId,
          });
        },
        10,
      );

      successful.forEach((key) => {
        const item = allItemMap.get(key);
        if (item) moveToTrashLocal(item);
      });

      removeSelectionFromAllTypes(successful);

      if (failed.length === 0) {
        toast.success(`成功删除 ${successful.length} 个文件`, { id: toastId });
      } else {
        toast.error("部分文件删除失败", {
          id: toastId,
          description: `${failed.length} 个文件删除失败，成功删除 ${successful.length} 个`,
        });
      }
    } catch (_error) {
      toast.error("操作失败", {
        id: toastId,
        description: "执行批量删除时发生未知错误",
      });
    }
  };

  const handleBatchPermanentDelete = async () => {
    const statsText = selectedStats
      .map((s) => `${typeNames[s.type]}:${s.count}`)
      .join("，");
    const confirmMsg = hasCrossTypeSelection
      ? `确认【彻底删除】这 ${totalCount} 个文件？此操作不可恢复！\n（${statsText}）`
      : `确认【彻底删除】这 ${totalCount} 个文件？此操作不可恢复！`;

    if (!confirm(confirmMsg)) return;

    const toastId = toast.loading(`正在删除 ${totalCount} 个文件...`);

    try {
      const successful: string[] = [];
      const failed: string[] = [];

      await processBatch(
        totalSelectedKeys,
        async (key) => {
          try {
            const success = await deleteFile(key);
            if (success) {
              successful.push(key);
            } else {
              failed.push(key);
            }
          } catch (_err) {
            failed.push(key);
          }
        },
        (current, total) => {
          toast.loading(`正在彻底删除 ${current}/${total} 个文件...`, {
            id: toastId,
          });
        },
        10,
      );

      if (successful.length > 0) {
        deleteFilesLocal(successful);
      }

      removeSelectionFromAllTypes(successful);

      if (failed.length === 0) {
        toast.success(`成功彻底删除 ${successful.length} 个文件`, {
          id: toastId,
        });
      } else {
        toast.error("部分文件删除失败", {
          id: toastId,
          description: `${failed.length} 个文件彻底删除失败，成功删除 ${successful.length} 个`,
        });
      }
    } catch (_error) {
      toast.error("操作失败", {
        id: toastId,
        description: "执行批量彻底删除时发生未知错误",
      });
    }
  };

  const handleBatchCopy = async () => {
    const urls = totalSelectedKeys
      .map((key) => {
        const file = allItemMap.get(key);
        if (!file) return null;
        return getFileUrl(key);
      })
      .filter(Boolean);

    const text = urls.join("\n");
    await navigator.clipboard.writeText(text);

    toast.success(`已复制 ${urls.length} 个文件链接`);
  };

  const TypeBadge = ({
    type,
    count,
    onClear,
  }: {
    type: FileType;
    count: number;
    onClear?: () => void;
  }) => {
    const Icon = typeIcons[type];
    return (
      <Badge
        variant="secondary"
        className="group gap-1 bg-secondary text-foreground border border-border cursor-pointer font-mono tabular-nums"
        onClick={onClear}
        title={`清空选中「${typeNames[type]}」`}
      >
        <Icon className="h-3 w-3 group-hover:hidden" />
        <span className="group-hover:hidden">{count}</span>
        <XIcon className="h-3 w-3 hidden group-hover:block" />
      </Badge>
    );
  };

  return (
    <>
      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-max">
        <div className="flex items-center gap-2 md:gap-3 rounded-[var(--r-md)] border border-border bg-card px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm font-mono font-medium text-foreground whitespace-nowrap tabular-nums">
              已选 {totalCount} 项
            </span>
            {selectedStats.length > 0 && (
              <div className="hidden md:flex items-center gap-1">
                {selectedStats.map(({ type, count }) => (
                  <TypeBadge
                    key={type}
                    type={type}
                    count={count}
                    onClear={() => clearSelection(type)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-border mx-0.5" />

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleBatchDownload}
              title="下载"
            >
              <Download className="h-4 w-4" />
              <span className="hidden md:inline">批量下载</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleBatchDelete}
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline">移入回收站</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="outline" title="更多批量操作">
                  <Toolbox className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                side="top"
                className="min-w-[180px] border-border bg-popover"
              >
                <DropdownMenuItem
                  onClick={() => {
                    const names = currentFiles.map((i) => i.name);
                    if (isAllSelected) {
                      removeSelection(names, activeType);
                    } else {
                      addSelection(names, activeType);
                    }
                  }}
                >
                  <Check className="mr-2 h-4 w-4 text-muted-foreground" />
                  {isAllSelected ? "取消本页全选" : "全选当前页"}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setShowBatchTags(true)}>
                  <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                  编辑标签
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setShowBatchRename(true)}>
                  <FilePen className="mr-2 h-4 w-4 text-muted-foreground" />
                  批量重命名
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    if (totalSelectedKeys.length > MAX_FILES_IN_BUNDLE) {
                      toast.error(`最多支持 ${MAX_FILES_IN_BUNDLE} 个文件`);
                      return;
                    }
                    setShowBatchShare(true);
                  }}
                >
                  <Share2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  打包分享
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleBatchCopy}>
                  <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                  复制直链
                </DropdownMenuItem>

                <div className="my-1 h-px bg-border" />

                <DropdownMenuItem
                  onClick={handleBatchPermanentDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                  彻底删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="icon-sm"
              variant="ghost"
              onClick={clearAllSelection}
              title="清空全部选中"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <BatchEditTagsDialog
        files={selectedItems}
        open={showBatchTags}
        onOpenChange={setShowBatchTags}
        onSuccess={handleBatchTagSuccess}
      />

      <BatchRenameDialog
        files={selectedItems}
        open={showBatchRename}
        onOpenChange={setShowBatchRename}
        onSuccess={handleBatchRenameSuccess}
      />

      <BatchShareDialog
        files={selectedItems}
        open={showBatchShare}
        onOpenChange={setShowBatchShare}
      />

      <MobileBatchDownloadDialog
        files={mobileDownloadFiles}
        open={showMobileBatchDownload}
        onOpenChange={setShowMobileBatchDownload}
      />

      <DownloadDirectoryGuide
        open={showDirGuide}
        onOpenChange={setShowDirGuide}
        onDirectorySelected={handleDirectorySelected}
      />
    </>
  );
}
