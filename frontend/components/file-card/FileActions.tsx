import {
  MoreVertical,
  Download,
  Trash2,
  Heart,
  Eye,
  Edit,
  Info,
  Link,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileActionsProps {
  onDownload: () => void;
  onDelete: () => void;
  onView: () => void;
  onEdit: () => void;
  onToggleLike: () => void;
  onCopyLink: () => void;
  onShowDetail: () => void;
  onShare: () => void;
  isLiked: boolean;
}

export function FileActions({
  onDownload,
  onDelete,
  onView,
  onEdit,
  onToggleLike,
  onCopyLink,
  onShowDetail,
  onShare,
  isLiked,
}: FileActionsProps) {
  const IconColor = "text-muted-foreground";
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="icon-sm"
        title="收藏"
        className="h-8 w-8 bg-card/95 border border-border opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLike();
        }}
      >
        <Heart
          className={`h-4 w-4 transition-colors ${
            isLiked
              ? "text-rose-500 fill-rose-500"
              : "text-muted-foreground hover:text-rose-500"
          }`}
        />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            title="更多操作"
            className="h-8 w-8 bg-card/95 border border-border opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover border-border">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
          >
            <Eye className={`h-4 w-4 mr-2 ${IconColor}`} />
            查看
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
          >
            <Share2 className={`h-4 w-4 mr-2 ${IconColor}`} />
            分享
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onCopyLink();
            }}
          >
            <Link className={`h-4 w-4 mr-2 ${IconColor}`} />
            复制链接
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className={`h-4 w-4 mr-2 ${IconColor}`} />
            编辑
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            <Download className={`h-4 w-4 mr-2 ${IconColor}`} />
            下载
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onShowDetail();
            }}
          >
            <Info className={`h-4 w-4 mr-2 ${IconColor}`} />
            详情
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2 text-destructive" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
