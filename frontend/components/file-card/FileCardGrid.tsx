import { Check, Layers, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTagBadge } from "@/components/FileTagBadge";
import { FileDetailDialog } from "@/components/file-card/FileDetailDialog";
import { FileActions } from "./FileActions";
import { FileContent, ICON_DISPLAY_SIZE } from "./FileContent";
import { FileItem } from "@shared/types";
import { cn, formatFileSize, formatDate } from "@/lib/utils";
import { useFileCardActions } from "./hooks";
import { NsfwSign } from "./NsfwSign";
import { FileEditDialog } from "./FileEditDialog";
import { ShareDialog } from "../file/share-dialog";
import { useGeneralSettingsStore } from "@/stores/general-store";

interface FileCardGridProps {
  file: FileItem;
  actions: ReturnType<typeof useFileCardActions>;
}

export function FileCardGrid({ file, actions }: FileCardGridProps) {
  const {
    isSelected,
    fileType,
    blur,
    isIncompleteUpload,
    showDetail,
    showEdit,
    isResuming,
    setShowDetail,
    setShowEdit,
    handleSelect,
    handleDelete,
    handleCopyLink,
    handleDownload,
    handleView,
    handleEdit,
    handleEditSuccess,
    handleToggleLike,
    handleResumeUpload,
  } = actions;

  const { safeMode, imageLoadMode } = useGeneralSettingsStore();
  const tags = file.metadata?.tags ?? [];
  const chunkTotal = file.metadata?.chunkInfo?.total || 0;

  return (
    <>
      <div
        onClick={handleView}
        className={cn(
          "taste-card group relative overflow-hidden cursor-pointer flex flex-col",
          isSelected && "border-primary ring-2 ring-primary/40",
        )}
      >
        {/* Top Media Stage — no text overlaid on photographs */}
        <div className="taste-card-media relative aspect-[4/3] w-full bg-secondary flex items-center justify-center overflow-hidden">
          {/* Top-left Selection + Chunk Count */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
            <button
              type="button"
              aria-label="选择文件"
              className={cn(
                "w-6 h-6 rounded-[var(--r-sm)] border flex items-center justify-center transition-opacity duration-150 cursor-pointer",
                isSelected
                  ? "bg-primary border-primary text-primary-foreground opacity-100"
                  : "bg-card/95 border-border text-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100",
              )}
              onClick={handleSelect}
            >
              {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
            </button>

            {chunkTotal > 1 && !isIncompleteUpload && (
              <span
                title={`大文件分片存储 (${chunkTotal} 个分片)`}
                className="inline-flex items-center gap-1 rounded-[4px] bg-card/95 px-1.5 py-0.5 text-[10px] font-mono font-medium text-foreground border border-border tabular-nums"
              >
                <Layers className="h-2.5 w-2.5 taste-accent-text" />
                {chunkTotal}片
              </span>
            )}
          </div>

          {/* Top-right Actions Menu */}
          <div
            className="absolute top-2 right-2 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <FileActions
              onDownload={handleDownload}
              onDelete={handleDelete}
              onView={handleView}
              onEdit={handleEdit}
              onToggleLike={handleToggleLike}
              onCopyLink={handleCopyLink}
              onShowDetail={() => setShowDetail(true)}
              onShare={actions.handleShare}
              isLiked={file.metadata?.liked || false}
            />
          </div>

          <FileContent
            fileType={fileType}
            fileKey={file.name}
            safeMode={safeMode}
            canPreview={!blur}
            tags={tags}
            fileSize={file.metadata?.fileSize ?? 0}
            imageLoadMode={imageLoadMode}
            thumbUrl={file.metadata?.thumbUrl || ""}
            className={ICON_DISPLAY_SIZE}
          />
          {blur && <NsfwSign />}
        </div>

        {/* Dedicated Solid Metadata Bar (7:1+ ink & 4.5:1+ muted contrast) */}
        <div className="p-3 bg-card border-t border-border flex flex-col gap-1 text-left">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "text-sm font-medium text-foreground truncate flex-1",
                blur && "blur-xs select-none opacity-75",
              )}
              title={file.metadata?.fileName}
            >
              {file.metadata?.fileName || file.name}
            </p>
            {tags.length > 0 && (
              <div className="flex gap-1 shrink-0">
                {tags.map((tag) => (
                  <FileTagBadge key={tag} tag={tag} />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground min-w-0 tabular-nums">
              <span className="shrink-0">
                {formatFileSize(file.metadata?.fileSize || 0)}
              </span>
              <span>·</span>
              <span className="shrink-0 truncate">
                {formatDate(file.metadata?.uploadedAt || 0)}
              </span>
            </p>

            {isIncompleteUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResumeUpload();
                }}
                disabled={isResuming}
                className="h-6 px-2 text-[11px] font-mono tabular-nums"
              >
                {isResuming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <RotateCw className="h-3 w-3" />
                    <span>
                      续传 {file.metadata.chunkInfo!.uploadedIndices.length}/
                      {file.metadata.chunkInfo!.total}
                    </span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <FileDetailDialog
        file={file}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
      <FileEditDialog
        file={file}
        open={showEdit}
        onOpenChange={setShowEdit}
        onSuccess={handleEditSuccess}
      />
      <ShareDialog
        open={actions.showShare}
        onOpenChange={actions.setShowShare}
        fileKey={file.name}
        fileName={file.metadata?.fileName}
      />
    </>
  );
}
