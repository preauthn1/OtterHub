import {
  Check,
  Layers,
  Loader2,
  RotateCw,
  Music,
  Video,
  FileText,
  ImageIcon,
  Download,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTagBadge } from "@/components/FileTagBadge";
import { FileDetailDialog } from "@/components/file-card/FileDetailDialog";
import { FileActions } from "./FileActions";
import { FileItem, FileType } from "@shared/types";
import { cn, formatFileSize, formatTime } from "@/lib/utils";
import { useFileCardActions } from "./hooks";
import { FileEditDialog } from "./FileEditDialog";
import { ShareDialog } from "../file/share-dialog";

interface FileCardListProps {
  file: FileItem;
  actions: ReturnType<typeof useFileCardActions>;
}

export function FileCardList({ file, actions }: FileCardListProps) {
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

  const tags = file.metadata?.tags ?? [];
  const chunkTotal = file.metadata?.chunkInfo?.total || 0;

  const getFileIcon = () => {
    switch (fileType) {
      case FileType.Audio:
        return <Music className="h-4 w-4 text-emerald-500" />;
      case FileType.Video:
        return <Video className="h-4 w-4 text-teal-500" />;
      case FileType.Image:
        return <ImageIcon className="h-4 w-4 text-sky-500" />;
      default:
        return <FileText className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-3.5 px-4 py-2.5 rounded-[var(--r-sm)] border transition-colors cursor-pointer text-left",
          isSelected
            ? "bg-secondary border-primary"
            : "bg-card border-border hover:border-foreground/25 hover:bg-secondary/40",
        )}
        onClick={handleView}
      >
        <button
          type="button"
          onClick={handleSelect}
          aria-label="选择文件"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border transition-colors cursor-pointer",
            isSelected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border group-hover:border-foreground/40 bg-background",
          )}
        >
          {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--r-sm)] bg-secondary border border-border shrink-0">
          {getFileIcon()}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <p
              className={cn(
                "text-sm font-medium text-foreground truncate",
                blur && "blur-xs select-none opacity-80",
              )}
              title={file.metadata?.fileName}
            >
              {file.metadata?.fileName || file.name}
            </p>
            {chunkTotal > 1 && !isIncompleteUpload && (
              <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground shrink-0 tabular-nums">
                <Layers className="h-2.5 w-2.5 taste-accent-text" />
                {chunkTotal}片
              </span>
            )}
            {tags.map((tag) => (
              <FileTagBadge key={tag} tag={tag} />
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground tabular-nums">
            <span className="sm:hidden">
              {formatFileSize(file.metadata?.fileSize || 0)}
            </span>
            <span className="sm:hidden">·</span>
            <span>{formatTime(file.metadata?.uploadedAt || 0)}</span>
            {file.metadata?.desc && (
              <>
                <span className="hidden md:inline">·</span>
                <span className="truncate hidden md:inline font-sans text-muted-foreground">
                  {file.metadata.desc}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="hidden sm:block w-24 text-right text-xs font-mono font-medium text-muted-foreground tabular-nums shrink-0">
          {formatFileSize(file.metadata?.fileSize || 0)}
        </div>

        {isIncompleteUpload && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleResumeUpload();
            }}
            disabled={isResuming}
            title="继续上传剩余分片"
            className="h-8 shrink-0 px-2.5 font-mono tabular-nums"
          >
            {isResuming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">
              续传 {file.metadata.chunkInfo!.uploadedIndices?.length || 0}/
              {file.metadata.chunkInfo!.total}
            </span>
          </Button>
        )}

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyLink}
            title="复制直链"
            className="hidden md:inline-flex"
          >
            <Link className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDownload}
            title="下载文件"
            className="hidden md:inline-flex"
          >
            <Download className="h-4 w-4" />
          </Button>
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
