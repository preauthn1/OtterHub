"use client";

import {
  useActiveBucket,
  useActiveSelectedKeys,
  useFilteredFiles,
  useFileDataStore,
  useFileQueryStore,
  useFileUIStore,
} from "@/stores/file";
import { FileCard } from "@/components/file-card";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { SortTypeDropdown } from "@/components/SortTypeDropdown";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { ViewMode } from "@/lib/types";
import {
  CheckSquare,
  ChevronDown,
  CircleAlert,
  Loader2,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MasonryGrid } from "./masonry/MasonryGrid";
import { PhotoProvider } from "react-photo-view";
import { PhotoToolbar } from "./FileImagePreview";
import { useEffect, useMemo } from "react";
import { formatFileSize } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";

function FileViewRenderer({
  viewMode,
  files,
}: {
  viewMode: ViewMode;
  files: any[];
}) {
  if (viewMode === ViewMode.Grid) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {files.map((file) => (
          <FileCard key={file.name} file={file} />
        ))}
      </div>
    );
  }

  if (viewMode === ViewMode.Masonry) {
    return (
      <div className="w-full min-w-0">
        <MasonryGrid files={files} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {files.map((file) => (
        <FileCard key={file.name} file={file} listView />
      ))}
    </div>
  );
}

export function FileGallery() {
  const {
    viewMode,
    itemsPerPage,
    setItemsPerPage,
    currentPage,
    setCurrentPage,
    addSelection,
    removeSelection,
  } = useFileUIStore();
  const { activeType, fetchNextPage } = useFileDataStore();
  const {
    searchQuery,
    filterLiked,
    filterTags,
    filterDateRange,
    resetFilters,
  } = useFileQueryStore();
  const files = useFilteredFiles();
  const bucket = useActiveBucket();
  const activeSelectedKeys = useActiveSelectedKeys();

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, filterLiked, filterTags, filterDateRange, setCurrentPage]);

  const handlePageChange = (selectedItem: { selected: number }) => {
    setCurrentPage(selectedItem.selected);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (size: number) => {
    setItemsPerPage(size);
  };

  const offset = currentPage * itemsPerPage;
  const currentFiles =
    viewMode === ViewMode.Masonry
      ? files
      : files.slice(offset, offset + itemsPerPage);

  const totalSize = useMemo(
    () =>
      files.reduce((sum, item) => sum + (item.metadata?.fileSize || 0), 0),
    [files],
  );

  const activeSelectedSet = useMemo(
    () => new Set(activeSelectedKeys),
    [activeSelectedKeys],
  );

  const isCurrentPageAllSelected =
    currentFiles.length > 0 &&
    currentFiles.every((f) => activeSelectedSet.has(f.name));

  const toggleSelectCurrentPage = () => {
    const names = currentFiles.map((f) => f.name);
    if (isCurrentPageAllSelected) {
      removeSelection(names, activeType);
    } else {
      addSelection(names, activeType);
    }
  };

  const hasActiveFilter = Boolean(
    searchQuery.trim() ||
      filterLiked ||
      filterTags.length > 0 ||
      filterDateRange.start ||
      filterDateRange.end,
  );

  if (bucket.loading && files.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44 rounded-[var(--r-sm)]" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-[var(--r-sm)]" />
            <Skeleton className="h-9 w-28 rounded-[var(--r-sm)]" />
            <Skeleton className="h-9 w-24 rounded-[var(--r-sm)]" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-[4/3] rounded-[var(--r-md)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PhotoProvider
      maskOpacity={0.9}
      toolbarRender={(props) => <PhotoToolbar {...props} />}
    >
      {/* Gallery Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-mono text-muted-foreground tabular-nums">
          <span className="font-sans font-medium text-foreground">
            {files.length} 个文件
          </span>
          {totalSize > 0 && (
            <>
              <span>·</span>
              <span>共 {formatFileSize(totalSize)}</span>
            </>
          )}

          {bucket.hasMore && (
            <Button
              onClick={fetchNextPage}
              disabled={bucket.loading || bucket.error}
              variant="ghost"
              size="sm"
              title={
                bucket.loading
                  ? "正在加载更多..."
                  : bucket.error
                    ? "加载失败，点击重试"
                    : "从云端加载更多"
              }
              className="h-8 px-2.5 text-xs taste-accent-text"
            >
              {bucket.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : bucket.error ? (
                <CircleAlert className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>{bucket.loading ? "加载中" : "加载更多"}</span>
            </Button>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-border bg-secondary px-2 py-1 text-xs font-sans font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <span>
                {searchQuery ? `搜索 "${searchQuery}"` : "已启用筛选"}
              </span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {viewMode !== ViewMode.Masonry && currentFiles.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectCurrentPage}
              className="h-9 px-3 gap-1.5 text-xs sm:text-sm"
            >
              {isCurrentPageAllSelected ? (
                <CheckSquare className="h-4 w-4 taste-accent-text" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="hidden sm:inline">
                {isCurrentPageAllSelected ? "取消全选" : "全选本页"}
              </span>
            </Button>
          )}
          <FilterDropdown />
          <SortTypeDropdown />
          <ViewModeToggle />
        </div>
      </div>

      {files.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <FileViewRenderer viewMode={viewMode} files={currentFiles} />

          {viewMode !== ViewMode.Masonry && (
            <Pagination
              totalItems={files.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              hasMore={bucket.hasMore}
              loading={bucket.loading}
              error={bucket.error}
              onPageChange={handlePageChange}
              onLoadMore={fetchNextPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}

          {viewMode === ViewMode.Masonry && bucket.hasMore && (
            <div className="flex justify-center py-8">
              <Button
                variant="outline"
                onClick={fetchNextPage}
                disabled={bucket.loading}
                className="px-6 gap-2"
              >
                {bucket.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span>加载更多图片</span>
              </Button>
            </div>
          )}
        </>
      )}
    </PhotoProvider>
  );
}
