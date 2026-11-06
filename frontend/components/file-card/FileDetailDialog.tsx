"use client";

import { FileItem } from "@shared/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFileSize, formatTime } from "@/lib/utils";
import { Clock, File, HardDrive, Code, Copy, Check, Tag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileTagBadge } from "@/components/FileTagBadge";
import { toast } from "sonner";

interface FileDetailDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileDetailDialog({
  file,
  open,
  onOpenChange,
}: FileDetailDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const jsonString = JSON.stringify(file, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    toast.success("JSON 已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">文件详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <File className="h-4 w-4 taste-accent-text mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">文件名</p>
              <p className="text-sm font-medium text-foreground break-all">
                {file.metadata?.fileName}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <HardDrive className="h-4 w-4 text-sky-500 mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">文件大小</p>
              <p className="text-sm font-mono font-medium text-foreground tabular-nums">
                {formatFileSize(file.metadata?.fileSize ?? 0)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-500 mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">上传时间</p>
              <p className="text-sm font-mono font-medium text-foreground tabular-nums">
                {formatTime(file.metadata?.uploadedAt)}
              </p>
            </div>
          </div>

          {file.metadata.tags && file.metadata.tags.length > 0 && (
            <div className="flex items-start gap-3">
              <Tag className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">标签</p>
                <div className="flex flex-wrap gap-2">
                  {file.metadata.tags.map((tag) => (
                    <FileTagBadge key={tag} tag={tag} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-teal-500" />
              <p className="text-sm font-medium text-foreground">元数据 JSON</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="h-8 gap-1.5"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 taste-accent-text" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? "已复制" : "复制"}</span>
            </Button>
          </div>
          <div className="bg-secondary rounded-[var(--r-sm)] p-3.5 overflow-x-auto overflow-y-auto max-h-72 border border-border">
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all">
              {jsonString}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
