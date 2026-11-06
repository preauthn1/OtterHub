"use client";

import { Search, X, Settings2, Trash2, Settings, LogOut } from "lucide-react";
import { useFileDataStore, useFileQueryStore } from "@/stores/file";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { FileTypeDropdown } from "./FileTypeDropdown";
import { FileTypeTabs } from "./FileTypeTabs";
import { ImageLoadModeToggle } from "./ImageLoadModeToggle";
import { SafeModeToggle } from "./SafeModeToggle";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "./ui/input";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { APP_NAME } from "@/lib/ui-text";
import { BrandLogo } from "./BrandLogo";
import { TrashSheet } from "./trash/TrashSheet";
import { SettingsDialog } from "./settings/SettingsDialog";
import { logout } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FileType } from "@shared/types";

export function Header() {
  const { searchQuery, setSearchQuery } = useFileQueryStore();
  const trashCount = useFileDataStore(
    (s) => s.buckets[FileType.Trash]?.items?.length || 0,
  );
  const isMobile = useIsMobile();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isMobile) {
          setShowMobileSearch(true);
        } else {
          searchInputRef.current?.focus();
        }
        return;
      }

      if (!isEditing && e.key === "/") {
        e.preventDefault();
        if (isMobile) {
          setShowMobileSearch(true);
        } else {
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("已安全退出");
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  if (isMobile) {
    return (
      <>
        <header className="nav">
          <div className="wrap flex items-center justify-between gap-2">
            {showMobileSearch ? (
              <div className="flex w-full items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="搜索文件名、描述或标签..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full pl-9 pr-9 bg-secondary border-border rounded-[var(--r-btn)] text-sm"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowMobileSearch(false);
                    setSearchQuery("");
                  }}
                >
                  取消
                </Button>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between">
                <a
                  href="#workspace"
                  className="taste-link inline-flex items-center gap-2 text-foreground"
                >
                  <BrandLogo size="sm" />
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    {APP_NAME}
                  </span>
                </a>
                <div className="flex items-center gap-1">
                  <FileTypeDropdown />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowMobileSearch(true)}
                    title="搜索"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsTrashOpen(true)}
                    title="回收站"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title="偏好设置"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="bottom"
                      className="rounded-none border-t border-border bg-card pb-10 px-6"
                    >
                      <SheetHeader className="mb-4 pt-2 text-left">
                        <SheetTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                          <Settings2 className="h-4 w-4 taste-accent-text" />
                          快捷控制与系统设置
                        </SheetTitle>
                      </SheetHeader>
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <p className="text-sm font-medium text-foreground">
                              安全模式
                            </p>
                            <p className="text-xs text-muted-foreground">
                              自动模糊遮罩敏感内容 (NSFW)
                            </p>
                          </div>
                          <SafeModeToggle />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <p className="text-sm font-medium text-foreground">
                              图片加载策略
                            </p>
                            <p className="text-xs text-muted-foreground">
                              切换原图、省流或无图模式
                            </p>
                          </div>
                          <ImageLoadModeToggle />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <p className="text-sm font-medium text-foreground">
                              外观主题
                            </p>
                            <p className="text-xs text-muted-foreground">
                              切换深色或浅色界面
                            </p>
                          </div>
                          <ThemeToggle />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-border">
                          <Button
                            variant="outline"
                            onClick={() => setIsSettingsOpen(true)}
                            className="h-10 gap-2"
                          >
                            <Settings className="h-4 w-4" />
                            系统设置
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleLogout}
                            className="h-10 gap-2 text-destructive hover:text-destructive"
                          >
                            <LogOut className="h-4 w-4" />
                            退出登录
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            )}
          </div>
        </header>
        <TrashSheet open={isTrashOpen} onOpenChange={setIsTrashOpen} />
        <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      </>
    );
  }

  return (
    <>
      <header className="nav">
        <div className="wrap flex items-center justify-between gap-4">
          {/* Left: Brand Identity flush on .wrap left line */}
          <a
            href="#workspace"
            className="taste-link inline-flex items-center gap-2.5 shrink-0 text-foreground"
            title="返回顶部"
          >
            <BrandLogo size="sm" />
            <span className="text-sm font-semibold tracking-tight text-foreground leading-none">
              {APP_NAME}
            </span>
          </a>

          {/* Center: Category Navigation (never wraps at 1024+) */}
          <div className="flex items-center justify-center shrink-0">
            <FileTypeTabs />
          </div>

          {/* Right: Search & System Controls flush on .wrap right line */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative group hidden xl:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <Input
                ref={searchInputRef}
                placeholder="搜索文件或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-52 rounded-[var(--r-btn)] border-border bg-secondary pl-9 pr-10 text-sm placeholder:text-muted-foreground"
              />
              {searchQuery ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-5 items-center rounded-[4px] border border-border bg-card px-1.5 font-mono text-[11px] text-muted-foreground">
                  /
                </kbd>
              )}
            </div>

            <SafeModeToggle />
            <ImageLoadModeToggle />
            <ThemeToggle />

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsTrashOpen(true)}
              className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
              title="回收站"
            >
              <Trash2 className="h-4 w-4" />
              {trashCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-primary px-1 text-[10px] font-mono font-semibold text-primary-foreground tabular-nums">
                  {trashCount > 99 ? "99+" : trashCount}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsSettingsOpen(true)}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title="系统设置与分享管理"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="default"
              onClick={handleLogout}
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <TrashSheet open={isTrashOpen} onOpenChange={setIsTrashOpen} />
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
