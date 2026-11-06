"use client";

import { useCallback, useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { shareApi } from "@/lib/api/share";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileIcon,
  Loader2,
  AlertCircle,
  Package,
  Archive,
  Image,
  Music,
  Video,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarClock,
} from "lucide-react";
import { formatFileSize, formatTime, getFileCategoryByName } from "@/lib/utils";
import { ShareMetaResponse } from "@shared/types";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/ui-text";
import { Footer } from "@/components/footer";

const getFileCategory = (name: string) => getFileCategoryByName(name);

const FileIconByType = ({
  category,
  className,
}: {
  category: string;
  className?: string;
}) => {
  const icons: Record<string, any> = {
    image: Image,
    video: Video,
    audio: Music,
    text: FileText,
  };
  const Icon = icons[category] || FileIcon;
  return <Icon className={className} />;
};

const triggerDownload = (url: string, filename: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
};

function ShareHeader() {
  return (
    <header className="nav">
      <div className="wrap flex items-center justify-between gap-4">
        <a
          href="/"
          className="inline-flex items-center gap-2.5 text-foreground no-underline"
        >
          <BrandLogo size="sm" />
          <span className="text-base font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}

function ShareContent() {
  const token = useSearchParams().get("k");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ShareMetaResponse | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return (setError("无效的分享链接"), setLoading(false));
    shareApi
      .getMeta(token)
      .then(setMeta)
      .catch((err) => setError(err.message || "无法加载分享文件信息"))
      .finally(() => setLoading(false));
  }, [token]);

  const previewableFiles = useMemo(
    () =>
      (meta?.files || [])
        .map((f, i) => ({ ...f, originalIndex: i }))
        .filter((f) =>
          ["image", "video", "audio"].includes(getFileCategory(f.name)),
        ),
    [meta?.files],
  );

  const currentPreviewIndexInList = previewableFiles.findIndex(
    (f) => f.originalIndex === previewIndex,
  );
  const currentPreviewFile = previewableFiles[currentPreviewIndexInList];

  const handlePreviewNav = useCallback(
    (step: number) => {
      const len = previewableFiles.length;
      if (len === 0) return;
      const nextIdx = (currentPreviewIndexInList + step + len) % len;
      setPreviewIndex(previewableFiles[nextIdx].originalIndex);
    },
    [previewableFiles, currentPreviewIndexInList],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewIndex === null) return;
      if (e.key === "Escape") setPreviewIndex(null);
      if (e.key === "ArrowLeft") handlePreviewNav(-1);
      if (e.key === "ArrowRight") handlePreviewNav(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewIndex, handlePreviewNav]);

  const executeDownload = async (action: () => string, filename: string) => {
    if (!token) return;
    setIsActioning(true);
    try {
      triggerDownload(action(), filename);
    } catch (err) {
      console.error(err);
    } finally {
      setIsActioning(false);
    }
  };

  if (loading) return <FullScreenLoader />;
  if (error) return <ErrorView error={error} />;

  const isBundle = meta?.type === "bundle";

  return (
    <>
      {currentPreviewFile && token && (
        <PreviewModal
          file={currentPreviewFile}
          token={token}
          total={previewableFiles.length}
          currentIndex={currentPreviewIndexInList}
          onClose={() => setPreviewIndex(null)}
          onNav={handlePreviewNav}
        />
      )}

      <ShareHeader />

      <main>
        <section className="taste-workspace">
          <div className="wrap flex flex-1 flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="text-left border-b border-border pb-4">
                <p className="text-xs font-mono text-muted-foreground tabular-nums mb-1.5">
                  OtterHub Controlled Share · 受控文件分发
                </p>
                <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground break-all">
                  {isBundle
                    ? meta?.bundleName || `share-${token?.slice(0, 8)}`
                    : meta?.fileName || "分享文件"}
                </h1>
              </div>

              <div
                data-visual="share-package"
                className="taste-panel"
              >
                <div
                  data-ui="share-card"
                  className="app-frame p-5 sm:p-6 space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-border bg-secondary text-foreground">
                        {isBundle ? (
                          <Package className="h-5 w-5 taste-accent-text" />
                        ) : (
                          <FileIcon className="h-5 w-5 taste-accent-text" />
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium text-foreground truncate">
                          {isBundle
                            ? `${meta?.files?.length || 0} 个文件合集`
                            : meta?.fileName}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground tabular-nums mt-0.5">
                          {isBundle
                            ? `总大小 ${formatFileSize(meta?.totalSize || 0)}`
                            : formatFileSize(meta?.fileSize || 0)}
                          {meta?.expiresAt
                            ? ` · 有效期至 ${formatTime(meta.expiresAt)}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="default"
                      className="shrink-0"
                      disabled={isActioning}
                      onClick={() =>
                        isBundle
                          ? executeDownload(
                              () => shareApi.getDownloadAllUrl(token!),
                              `${meta?.bundleName || `share-${token!.slice(0, 8)}`}.zip`,
                            )
                          : executeDownload(
                              () => shareApi.getDownloadUrl(token!),
                              meta?.fileName || "download",
                            )
                      }
                    >
                      {isActioning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>下载中...</span>
                        </>
                      ) : isBundle ? (
                        <>
                          <Archive className="h-4 w-4" />
                          <span>下载全部 (ZIP)</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          <span>下载文件</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {isBundle ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[460px] overflow-y-auto">
                      {meta?.files?.map((file, i) => {
                        const cat = getFileCategory(file.name);
                        const isPrev = ["image", "video", "audio"].includes(cat);
                        const url = shareApi.getDownloadUrl(token!, file.key);

                        return (
                          <div
                            key={file.key || i}
                            className="taste-card group relative overflow-hidden cursor-pointer flex flex-col"
                            onClick={() => isPrev && setPreviewIndex(i)}
                          >
                            <div className="taste-card-media aspect-[4/3] flex items-center justify-center bg-secondary overflow-hidden">
                              {cat === "image" && url ? (
                                <img
                                  src={url}
                                  alt={file.name}
                                  width={400}
                                  height={300}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <FileIconByType
                                  category={cat}
                                  className="h-10 w-10 text-muted-foreground"
                                />
                              )}
                            </div>
                            <div className="p-2.5 border-t border-border bg-card text-left">
                              <p
                                className="text-xs font-medium text-foreground truncate"
                                title={file.name}
                              >
                                {file.name}
                              </p>
                              <p className="text-[11px] font-mono text-muted-foreground tabular-nums mt-0.5">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              {isPrev && (
                                <Button
                                  size="icon-sm"
                                  variant="secondary"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewIndex(i);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="icon-sm"
                                variant="secondary"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  executeDownload(
                                    () =>
                                      shareApi.getDownloadUrl(token!, file.key),
                                    file.name,
                                  );
                                }}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    meta?.mimeType?.startsWith("image/") &&
                    token && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--r-sm)] border border-border bg-secondary">
                        <img
                          src={shareApi.getDownloadUrl(token)}
                          alt={meta.fileName}
                          width={1280}
                          height={720}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )
                  )}

                  {meta?.expiresAt && (
                    <div className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-border bg-secondary px-3 py-1.5 text-xs font-mono text-muted-foreground tabular-nums">
                      <CalendarClock className="h-3.5 w-3.5 taste-accent-text" />
                      <span>分享链接将于 {formatTime(meta.expiresAt)} 自动失效</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Footer />
          </div>
        </section>
      </main>
    </>
  );
}

const FullScreenLoader = () => (
  <>
    <ShareHeader />
    <main>
      <section className="taste-workspace">
        <div className="wrap flex flex-1 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </section>
    </main>
  </>
);

const ErrorView = ({ error }: { error: string }) => (
  <>
    <ShareHeader />
    <main>
      <section className="taste-workspace">
        <div className="wrap flex flex-1 flex-col justify-between gap-8">
          <div className="space-y-4 text-left max-w-xl">
            <p className="text-xs font-mono text-muted-foreground">
              Share Status · 404 / Expired
            </p>
            <h1 className="taste-h2">分享链接不可用或已过期</h1>
            <p className="taste-lead">{error}</p>
            <div className="pt-2" data-visual="share-error">
              <div
                data-ui="share-error-box"
                className="flex items-center gap-3 rounded-[var(--r-md)] border border-border bg-card p-4 text-sm text-muted-foreground"
              >
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <span>请向分享者确认链接是否完整，或重新生成有效外链。</span>
              </div>
            </div>
            <div className="pt-2">
              <Button asChild variant="outline">
                <a href="/login">访问云盘工作台</a>
              </Button>
            </div>
          </div>
          <Footer />
        </div>
      </section>
    </main>
  </>
);

const PreviewModal = ({
  file,
  token,
  total,
  currentIndex,
  onClose,
  onNav,
}: any) => {
  const cat = getFileCategory(file.name);
  const url = shareApi.getDownloadUrl(token, file.key);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 sm:p-16"
      onClick={handleBackdropClick}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-[var(--r-sm)] bg-white/10 hover:bg-white/20 transition-colors z-10"
        aria-label="关闭预览"
      >
        <X className="h-5 w-5 text-white" />
      </button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-[var(--r-sm)] bg-black/70 border border-white/15 text-white text-xs font-mono max-w-[75%] truncate">
        {file.name}
      </div>

      {total > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNav(-1);
            }}
            className="absolute left-4 p-2 rounded-[var(--r-sm)] bg-white/10 hover:bg-white/20 transition-colors z-10"
            aria-label="上一个"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNav(1);
            }}
            className="absolute right-4 p-2 rounded-[var(--r-sm)] bg-white/10 hover:bg-white/20 transition-colors z-10"
            aria-label="下一个"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-[var(--r-sm)] bg-black/70 border border-white/15 text-white text-xs font-mono tabular-nums">
        {currentIndex + 1} / {total}
      </div>

      {cat === "image" && (
        <img
          src={url}
          alt={file.name}
          className="max-w-full max-h-full object-contain relative z-10"
        />
      )}
      {cat === "video" && (
        <video
          src={url}
          controls
          autoPlay
          className="max-w-full max-h-full relative z-10"
        />
      )}
      {cat === "audio" && (
        <div className="flex flex-col items-center gap-5 relative z-10 bg-card border border-border p-6 rounded-[var(--r-md)]">
          <Music className="h-14 w-14 taste-accent-text" />
          <p className="text-foreground text-sm font-medium">{file.name}</p>
          <audio src={url} controls autoPlay className="w-72 sm:w-80" />
        </div>
      )}
    </div>
  );
};

export default function SharePage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <ShareContent />
    </Suspense>
  );
}
