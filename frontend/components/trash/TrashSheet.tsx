"use client";

import { useEffect, useState } from "react";
import { Trash2, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { FileType } from "@shared/types";
import { TrashFileCard } from "@/components/trash/TrashFileCard";
import { deleteFile, restoreFile } from "@/lib/api";
import { toast } from "sonner";
import { useFileDataStore, useFileUIStore } from "@/stores/file";
import { processBatch } from "@/lib/utils";

interface TrashSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrashSheet({ open, onOpenChange }: TrashSheetProps) {
  const {
    buckets,
    fetchBucket,
    restoreFromTrashLocal,
    deleteFilesLocalByType,
  } = useFileDataStore();
  const { selectedKeys, clearSelection } = useFileUIStore();
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const trashBucket = buckets[FileType.Trash];
  const isEmpty = trashBucket.items.length === 0;
  const selectedTrashKeys = selectedKeys[FileType.Trash] || [];
  const hasSelection = selectedTrashKeys.length > 0;

  useEffect(() => {
    if (open && trashBucket.items.length === 0 && trashBucket.hasMore) {
      fetchBucket(FileType.Trash);
    }
  }, [open, fetchBucket, trashBucket.items.length, trashBucket.hasMore]);

  useEffect(() => {
    if (!open) {
      clearSelection(FileType.Trash);
    }
  }, [open, clearSelection]);

  const handleLoadMore = () => {
    fetchBucket(FileType.Trash);
  };

  const handleBatchRestore = async () => {
    if (!confirm(`确定还原选中的 ${selectedTrashKeys.length} 个文件?`)) return;

    setIsBatchProcessing(true);
    const toastId = toast.loading(
      `正在还原 ${selectedTrashKeys.length} 个文件...`,
    );

    try {
      const selectedItems = trashBucket.items.filter((item) =>
        selectedTrashKeys.includes(item.name),
      );

      await processBatch(
        selectedItems,
        async (item) => {
          await restoreFile(item.name);
          restoreFromTrashLocal(item);
        },
        (current, total) => {
          toast.loading(`正在还原 ${current}/${total} 个文件...`, {
            id: toastId,
          });
        },
        10,
      );

      clearSelection(FileType.Trash);

      toast.success(`已还原 ${selectedTrashKeys.length} 个文件`, {
        id: toastId,
      });
    } catch (_error) {
      toast.error("批量还原失败", { id: toastId });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (
      !confirm(
        `确定永久删除选中的 ${selectedTrashKeys.length} 个文件? 此操作不可恢复！`,
      )
    )
      return;

    setIsBatchProcessing(true);
    const toastId = toast.loading(
      `正在删除 ${selectedTrashKeys.length} 个文件...`,
    );

    try {
      const selectedItems = trashBucket.items.filter((item) =>
        selectedTrashKeys.includes(item.name),
      );

      await processBatch(
        selectedItems,
        async (item) => {
          await deleteFile(item.name);
          deleteFilesLocalByType([item.name], FileType.Trash);
        },
        (current, total) => {
          toast.loading(`正在删除 ${current}/${total} 个文件...`, {
            id: toastId,
          });
        },
        10,
      );

      clearSelection(FileType.Trash);
      toast.success(`已永久删除 ${selectedTrashKeys.length} 个文件`, {
        id: toastId,
      });
    } catch (_error) {
      toast.error("批量删除失败", { id: toastId });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (isEmpty) return;
    if (!confirm("确定清空回收站吗？所有文件将被永久删除且无法恢复！")) return;

    setIsBatchProcessing(true);
    const toastId = toast.loading("正在清空回收站...");

    try {
      const itemsToDelete = [...trashBucket.items];

      await processBatch(
        itemsToDelete,
        async (item) => {
          await deleteFile(item.name);
          deleteFilesLocalByType([item.name], FileType.Trash);
        },
        (current, total) => {
          toast.loading(`正在删除 ${current}/${total} 个文件...`, {
            id: toastId,
          });
        },
        10,
      );

      toast.success("回收站已清空", { id: toastId });
    } catch (_error) {
      toast.error("清空回收站失败", { id: toastId });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[520px] flex flex-col p-0 bg-card border-l border-border">
        <SheetHeader className="px-6 py-4 border-b border-border text-left">
          <div className="flex items-center justify-between pr-8">
            <SheetTitle className="text-base font-semibold text-foreground">
              回收站
            </SheetTitle>
            {!isEmpty && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEmptyTrash}
                disabled={isBatchProcessing}
                className="text-destructive hover:text-destructive"
              >
                {isBatchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>清空回收站</span>
              </Button>
            )}
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            移入回收站的文件将于 30 天后自动彻底清除。
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3">
          {isEmpty && !trashBucket.loading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 min-h-[300px]">
              <Trash2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">回收站为空</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {trashBucket.items.map((file) => (
                <TrashFileCard key={file.name} file={file} />
              ))}

              {trashBucket.loading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {!trashBucket.loading && trashBucket.hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                  >
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {hasSelection && (
          <div className="p-4 border-t border-border bg-secondary flex items-center justify-between">
            <div className="text-sm font-mono tabular-nums text-foreground">
              已选择 {selectedTrashKeys.length} 个文件
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchRestore}
                disabled={isBatchProcessing}
              >
                {isBatchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                <span>还原</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchDelete}
                disabled={isBatchProcessing}
              >
                {isBatchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>彻底删除</span>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
