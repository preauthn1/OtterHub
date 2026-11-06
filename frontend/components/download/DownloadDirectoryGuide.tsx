"use client";

import { FolderOpen, Save, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  pickDownloadDirectoryForFirstTime,
  type DirectoryHandleResult,
} from "@/lib/utils/file";

const FEATURES = [
  {
    Icon: FolderOpen,
    color: "text-sky-500",
    title: "推荐目录",
    desc: "建议创建并选择 Downloads / OtterHub 目录",
  },
  {
    Icon: Save,
    color: "text-teal-500",
    title: "记住选择",
    desc: "大文件和批量下载时自动使用已授权目录",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDirectorySelected: (result: DirectoryHandleResult) => void;
}

export function DownloadDirectoryGuide({
  open,
  onOpenChange,
  onDirectorySelected,
}: Props) {
  const handleSelect = () =>
    pickDownloadDirectoryForFirstTime().then(
      (r) => r && onDirectorySelected(r),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 taste-accent-text" />
            选择下载目录
          </DialogTitle>
          <DialogDescription>
            首次保存大文件或批量下载时，需要授权本地保存目录
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {FEATURES.map(({ Icon, color, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-[var(--r-sm)] border border-border bg-secondary p-3"
            >
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
              <div>
                <p className="font-medium text-sm text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSelect}>选择目录</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
