import { Music, Video, FileText } from "lucide-react";
import { shouldBlur, shouldLoadImage, cn } from "@/lib/utils";
import { getFileUrl } from "@/lib/api";
import { FileTag, FileType } from "@shared/types";
import { FileImagePreview } from "../FileImagePreview";
import { ImageLoadMode } from "@/lib/types";
import { useGeneralSettingsStore } from "@/stores/general-store";

export const ICON_DISPLAY_SIZE = "h-14 w-14";

interface FileContentProps {
  fileType: FileType;
  fileKey: string;
  safeMode: boolean;
  canPreview: boolean;
  tags?: FileTag[];
  fileSize?: number;
  imageLoadMode: ImageLoadMode;
  thumbUrl?: string;
  className?: string;
  imgSrc?: string;
}

export function FileContent({
  fileType,
  fileKey,
  safeMode,
  canPreview,
  tags,
  fileSize,
  imageLoadMode,
  thumbUrl,
  className,
  imgSrc,
}: FileContentProps) {
  const dataSaverThreshold = useGeneralSettingsStore(
    (s) => s.dataSaverThreshold,
  );
  const blur = shouldBlur({ safeMode, tags });
  const load = shouldLoadImage({
    fileType,
    imageLoadMode,
    fileSize,
    threshold: dataSaverThreshold * 1024 * 1024,
  });

  if (fileType === FileType.Image) {
    return (
      <FileImagePreview
        src={imgSrc || getFileUrl(fileKey)}
        alt={fileKey}
        fileKey={fileKey}
        shouldLoad={load}
        shouldBlur={blur}
        canPreview={canPreview}
      />
    );
  }

  if (fileType === FileType.Video) {
    if (thumbUrl) {
      return (
        <img
          src={thumbUrl}
          alt={fileKey}
          loading="lazy"
          decoding="async"
          className={cn(
            "w-full h-full object-cover",
            blur ? "blur-xl scale-110" : "blur-0 scale-100",
          )}
        />
      );
    }
    return <Video className={`text-teal-500 ${className}`} />;
  }

  if (fileType === FileType.Audio) {
    return <Music className={`text-emerald-500 ${className}`} />;
  }

  return <FileText className={`text-amber-500 ${className}`} />;
}
