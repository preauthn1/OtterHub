"use client";

import { ImageIcon, Music, Video, FileText } from "lucide-react";
import { FileType } from "@shared/types";
import { useFileDataStore } from "@/stores/file";
import { cn } from "@/lib/utils";

export const FILE_TYPE_ITEMS = [
  { id: FileType.Image, label: "图片", icon: ImageIcon },
  { id: FileType.Video, label: "视频", icon: Video },
  { id: FileType.Audio, label: "音频", icon: Music },
  { id: FileType.Document, label: "文档", icon: FileText },
];

export function FileTypeTabs() {
  const activeType = useFileDataStore((s) => s.activeType);
  const buckets = useFileDataStore((s) => s.buckets);
  const setActiveType = useFileDataStore((s) => s.setActiveType);

  return (
    <div
      role="tablist"
      aria-label="文件分类导航"
      className="inline-flex items-center gap-1 rounded-[var(--r-btn)] bg-secondary p-1 border border-border shrink-0"
    >
      {FILE_TYPE_ITEMS.map((type) => {
        const Icon = type.icon;
        const isActive = activeType === type.id;
        const count = buckets[type.id]?.items?.length || 0;

        return (
          <button
            key={type.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveType(type.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-[var(--r-sm)] px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive ? "text-primary-foreground" : "text-muted-foreground",
              )}
            />
            <span>{type.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "rounded-[4px] px-1.5 py-0.2 text-[11px] font-mono font-medium tabular-nums",
                  isActive
                    ? "bg-black/15 text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
