"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WallpaperTab } from "./wallpaper-tab/WallpaperTab";
import { GeneralTab } from "./general-tab/GeneralTab";
import { LayoutGrid, Image as ImageIcon, Settings, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareTab } from "./share-tab/ShareTab";
import { useUIStore } from "@/stores/ui-store";
import { SettingTab } from "@/lib/types/settings";
import type { SettingsSnapshot } from "@/stores/general-store";
import { useGeneralSettingsStore } from "@/stores/general-store";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const settingsSnapshotRef = useRef<SettingsSnapshot | null>(null);
  const previousOpenRef = useRef(open);

  const menuItems = [
    {
      id: SettingTab.General,
      label: "常规设置",
      icon: Settings,
    },
    {
      id: SettingTab.Wallpaper,
      label: "随机壁纸",
      icon: ImageIcon,
    },
    {
      id: SettingTab.Share,
      label: "分享管理",
      icon: Share2,
    },
  ];

  const activeTab = useUIStore((state) => state.activeSettingTab);
  const setActiveTab = useUIStore((state) => state.setActiveSettingTab);

  const resetGeneralSettingsSnapshot = () => {
    settingsSnapshotRef.current = useGeneralSettingsStore
      .getState()
      .getSettingsSnapshot();
  };

  useEffect(() => {
    const wasOpen = previousOpenRef.current;

    if (open && (!wasOpen || !settingsSnapshotRef.current)) {
      settingsSnapshotRef.current = useGeneralSettingsStore
        .getState()
        .getSettingsSnapshot();
    }

    if (wasOpen && !open) {
      const snapshot = settingsSnapshotRef.current;
      const store = useGeneralSettingsStore.getState();
      if (snapshot && store.hasSettingsChanged(snapshot)) {
        store.syncSettings({ silent: true }).catch(() => {});
      }
    }

    previousOpenRef.current = open;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[95vw] md:max-w-[90vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border rounded-[var(--r-lg)]">
        <DialogHeader className="px-6 py-4 border-b border-border bg-secondary/40 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--r-sm)] bg-secondary border border-border">
              <Settings className="h-4 w-4 taste-accent-text" />
            </div>
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
              系统设置与分享管理
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <aside className="w-full md:w-20 lg:w-52 border-b md:border-b-0 md:border-r border-border bg-secondary/20 flex flex-row md:flex-col p-2 px-4 md:p-2 lg:p-3 gap-1.5 overflow-x-auto md:overflow-y-auto shrink-0">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center rounded-[var(--r-btn)] text-xs md:text-sm font-medium transition-colors shrink-0 cursor-pointer",
                    "gap-2 md:gap-0 lg:gap-2.5",
                    "px-3 md:px-0 lg:px-3.5",
                    "py-2 md:py-3 lg:py-2.5",
                    "justify-center lg:justify-start w-auto md:w-full",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  />
                  <span className="whitespace-nowrap md:hidden lg:inline">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </aside>

          <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col bg-background">
            <div className="flex-1 min-h-0">
              {activeTab === SettingTab.Wallpaper && <WallpaperTab />}
              {activeTab === SettingTab.General && (
                <GeneralTab
                  onGeneralSettingsSnapshotReset={resetGeneralSettingsSnapshot}
                />
              )}
              {activeTab === SettingTab.Share && <ShareTab />}
              {activeTab !== SettingTab.Wallpaper &&
                activeTab !== SettingTab.General &&
                activeTab !== SettingTab.Share && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <LayoutGrid className="h-12 w-12 mb-3 opacity-40" />
                    <p className="text-sm font-medium">功能就绪中</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
