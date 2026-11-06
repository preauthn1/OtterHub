"use client";

import { useFileUIStore } from "@/stores/file";
import { FileItem, FileType } from "@shared/types";
import { getFileUrl } from "@/lib/api";
import { shouldBlur, shouldLoadImage, cn } from "@/lib/utils";
import { PhotoView } from "react-photo-view";
import { NsfwSign } from "../file-card/NsfwSign";
import { useGeneralSettingsStore } from "@/stores/general-store";
import { Image } from "lucide-react";

interface MasonryImageCardProps {
  file: FileItem;
}

export function MasonryImageCard({ file }: MasonryImageCardProps) {
  const { safeMode, imageLoadMode, dataSaverThreshold } =
    useGeneralSettingsStore();
  const { forceLoadFiles, addForceLoadFile } = useFileUIStore();

  const blur = shouldBlur({ safeMode, tags: file.metadata?.tags ?? [] });
  const shouldLoad = shouldLoadImage({
    fileType: FileType.Image,
    imageLoadMode,
    fileSize: file.metadata?.fileSize ?? 0,
    threshold: dataSaverThreshold * 1024 * 1024,
  });

  const load = shouldLoad || forceLoadFiles.includes(file.name);
  const imageUrl = getFileUrl(file.name);

  const imgContent = load ? (
    <img
      src={imageUrl}
      alt={file.metadata?.fileName}
      loading="lazy"
      decoding="async"
      className={cn(
        "w-full h-auto block",
        blur && "blur-xl",
        !blur && "cursor-zoom-in",
      )}
    />
  ) : (
    <div
      className="flex flex-col items-center justify-center w-full py-12 bg-secondary text-muted-foreground gap-2 cursor-pointer hover:bg-accent transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        addForceLoadFile(file.name);
      }}
    >
      <Image className="w-7 h-7" aria-label="点击加载图片" />
      <span className="text-xs">点击加载原图</span>
    </div>
  );

  return (
    <div className="taste-card relative group overflow-hidden">
      <div className="taste-card-media overflow-hidden bg-secondary">
        {!blur && load ? (
          <PhotoView src={imageUrl}>{imgContent}</PhotoView>
        ) : (
          imgContent
        )}
      </div>

      {blur && <NsfwSign />}

      <div className="px-3 py-2 border-t border-border bg-card text-left">
        <p className="text-xs font-medium text-foreground truncate">
          {file.metadata?.fileName || file.name}
        </p>
      </div>
    </div>
  );
}
