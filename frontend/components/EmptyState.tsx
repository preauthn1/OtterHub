"use client";

import {
  CloudUpload,
  FileText,
  FilterX,
  FolderOpen,
  ImageIcon,
  Music,
  Video,
} from "lucide-react";
import { useFileDataStore, useFileQueryStore } from "@/stores/file";
import { Button } from "./ui/button";
import { FILE_TYPE_ITEMS } from "./FileTypeTabs";

const STORAGE_CHANNELS = [
  {
    title: "图片与原图画廊",
    spec: "支持网格 / 瀑布流预览与省流加载",
    icon: ImageIcon,
    color: "text-sky-500",
  },
  {
    title: "大体积视频流",
    spec: "最高 1.95\u00A0GB 自适应分片与在线播放",
    icon: Video,
    color: "text-teal-500",
  },
  {
    title: "无损音频档案",
    spec: "后台悬浮播放器与元数据标签检索",
    icon: Music,
    color: "text-emerald-500",
  },
  {
    title: "文档与压缩归档",
    spec: "支持批量重命名、ZIP 打包与限时外链",
    icon: FileText,
    color: "text-amber-500",
  },
];

export function EmptyState() {
  const activeType = useFileDataStore((s) => s.activeType);
  const {
    searchQuery,
    filterLiked,
    filterTags,
    filterDateRange,
    resetFilters,
  } = useFileQueryStore();

  const hasFilters = Boolean(
    searchQuery.trim() ||
      filterLiked ||
      filterTags.length > 0 ||
      filterDateRange.start ||
      filterDateRange.end,
  );

  const currentType =
    FILE_TYPE_ITEMS.find((t) => t.id === activeType) || FILE_TYPE_ITEMS[0];
  const Icon = currentType.icon || FolderOpen;

  const triggerUploadPicker = () => {
    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][data-otter-upload="files"]',
    );
    fileInput?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[var(--r-md)] border border-border bg-background p-4 sm:p-6 text-left">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-border bg-secondary text-foreground">
            {hasFilters ? (
              <FilterX className="h-5 w-5 taste-accent-text" />
            ) : (
              <Icon className="h-5 w-5 taste-accent-text" />
            )}
          </div>

          <div className="space-y-1 text-left">
            <p className="text-base font-semibold text-foreground">
              {hasFilters
                ? "没有找到符合筛选条件的文件"
                : `当前「${currentType.label}」分类库暂无文件`}
            </p>

            <p className="text-sm text-muted-foreground max-w-xl">
              {hasFilters
                ? "可调整搜索关键词、标签或时间范围，或一键重置当前筛选条件。"
                : "将文件或文件夹拖拽至上方上传区，或按 Ctrl+V 粘贴剪贴板文件极速入库。"}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {hasFilters ? (
            <Button variant="outline" size="default" onClick={resetFilters}>
              <FilterX className="h-4 w-4" />
              <span>重置筛选条件</span>
            </Button>
          ) : (
            <Button type="button" size="default" onClick={triggerUploadPicker}>
              <CloudUpload className="h-4 w-4" />
              <span>Add files</span>
            </Button>
          )}
        </div>
      </div>

      {!hasFilters && (
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {STORAGE_CHANNELS.map((ch) => {
            const ChIcon = ch.icon;
            return (
              <div
                key={ch.title}
                className="rounded-[var(--r-sm)] border border-border bg-background p-4 lg:p-5 text-left space-y-2"
              >
                <div className="flex items-center gap-2">
                  <ChIcon className={`h-4 w-4 shrink-0 ${ch.color}`} />
                  <p className="text-sm font-medium text-foreground">
                    {ch.title}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {ch.spec}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
