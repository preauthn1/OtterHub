"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Music,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { getFileDownloadUrl, getFileUrl } from "@/lib/api";
import { downloadFile, formatFileSize } from "@/lib/utils";
import { DIRECT_DOWNLOAD_LIMIT } from "@/lib/types";
import { FileMetadata, FileType } from "@shared/types";

type FileStatus = "pending" | "success" | "failed";

interface QueueEntry {
  key: string;
  metadata: FileMetadata;
  status: FileStatus;
  fileType: FileType;
}

interface MobileBatchDownloadDialogProps {
  files: Array<{ key: string; metadata: FileMetadata; fileType: FileType }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  [FileType.Image]: <ImageIcon className="h-4 w-4 text-sky-500" />,
  [FileType.Video]: <Video className="h-4 w-4 text-teal-500" />,
  [FileType.Audio]: <Music className="h-4 w-4 text-emerald-500" />,
};

function shouldOpenLargeMedia(entry: QueueEntry) {
  return (
    entry.metadata.fileSize > DIRECT_DOWNLOAD_LIMIT &&
    (entry.fileType === FileType.Audio || entry.fileType === FileType.Video)
  );
}

export function MobileBatchDownloadDialog({
  files,
  open,
  onOpenChange,
}: MobileBatchDownloadDialogProps) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (open && files.length) {
      setQueue(files.map((f) => ({ ...f, status: "pending" })));
      setActiveIndex(-1);
    }
  }, [open, files]);

  const total = queue.length;
  const completed = queue.filter((e) => e.status === "success").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const updateStatus = (index: number, status: FileStatus) => {
    setQueue((prev) =>
      prev.map((e, i) => (i === index ? { ...e, status } : e)),
    );
  };

  const handleAction = async (index: number, isRetry = false) => {
    const entry = queue[index];
    if (!entry || (entry.status === "failed" && !isRetry)) return;

    if (isRetry) updateStatus(index, "pending");
    setActiveIndex(index);

    try {
      if (shouldOpenLargeMedia(entry)) {
        updateStatus(index, "success");
        toast.info("已打开文件链接，请使用浏览器保存");
        window.open(getFileUrl(entry.key), "_blank", "noopener,noreferrer");
        return;
      }

      const { status } = await downloadFile(
        getFileDownloadUrl(entry.key),
        entry.metadata,
      );
      updateStatus(index, status === "success" ? "success" : "failed");
    } catch {
      updateStatus(index, "failed");
      toast.error(`下载失败: ${entry.metadata.fileName}`);
    } finally {
      setActiveIndex(-1);
    }
  };

  const getStatusIcon = (status: FileStatus, type: FileType) => {
    if (status === "success")
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (status === "failed")
      return <XCircle className="h-4 w-4 text-destructive" />;
    return FILE_ICONS[type] || <FileText className="h-4 w-4 text-amber-500" />;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] flex flex-col w-full bg-card border-border">
        <DrawerHeader>
          <DrawerTitle>批量下载</DrawerTitle>
          <DrawerDescription>
            点击每个文件触发下载，已完成的文件会自动标记。
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-2 px-4">
          <div className="flex items-center justify-between text-sm font-mono tabular-nums">
            <span className="text-muted-foreground">
              {completed} / {total}
            </span>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-1.5">
            {queue.map((entry, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={entry.key}
                  className={`flex items-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 transition-colors ${
                    isActive
                      ? "border-primary bg-secondary"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="shrink-0">
                    {isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      getStatusIcon(entry.status, entry.fileType)
                    )}
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-foreground">
                      {entry.metadata.fileName}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground tabular-nums">
                      {formatFileSize(entry.metadata.fileSize || 0)}
                    </p>
                  </div>

                  {entry.status !== "failed" && (
                    <Button
                      size="icon-sm"
                      onClick={() => handleAction(index)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {entry.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 shrink-0"
                      onClick={() => handleAction(index, true)}
                    >
                      重试
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DrawerFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
