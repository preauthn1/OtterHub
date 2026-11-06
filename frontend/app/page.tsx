"use client";

import { useEffect } from "react";
import { FolderUp, HardDriveUpload } from "lucide-react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FileGallery } from "@/components/FileGallery";
import { BatchOperationsBar } from "@/components/batch-operations/BatchOperationsBar";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  useActiveBucket,
  useActiveItems,
  useFileDataStore,
  useFileUIStore,
  useHasAnySelection,
} from "@/stores/file";
import { ViewMode } from "@/lib/types";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function OtterHubPage() {
  const activeItems = useActiveItems();
  const activeBucket = useActiveBucket();
  const hasAnySelection = useHasAnySelection();

  const { fetchNextPage } = useFileDataStore();
  const { viewMode } = useFileUIStore();

  const isListOrGrid = [ViewMode.Grid, ViewMode.List].includes(viewMode);
  const showBatchBar = hasAnySelection && isListOrGrid;
  const isEmpty = activeItems.length === 0 && !activeBucket.loading;

  useEffect(() => {
    fetchNextPage().catch((error) => {
      console.error("[OtterHubPage] fetch files failed:", error);
    });
  }, [fetchNextPage]);

  const triggerFilePicker = () => {
    document
      .querySelector<HTMLInputElement>(
        'input[type="file"][data-otter-upload="files"]',
      )
      ?.click();
  };

  const triggerFolderPicker = () => {
    document
      .querySelector<HTMLInputElement>(
        'input[type="file"][data-otter-upload="folder"]',
      )
      ?.click();
  };

  return (
    <>
      <Header />

      <main>
        <section
          className="taste-workspace"
          id="workspace"
          style={{ "--h": 1 } as React.CSSProperties}
        >
          <div className="wrap flex flex-1 flex-col h-full">
            <div className="hero-text flex flex-1 flex-col justify-between gap-3 sm:gap-5">
              <div className="space-y-3 sm:space-y-5">
                {/* Workspace Headline + Fact + Directly Adjacent Actions (no stranded-action) */}
                <div className="text-left">
                  <p className="text-xs font-mono text-muted-foreground tabular-nums mb-1.5 sm:mb-2">
                    Cloudflare Edge · 单文件上限 1.95{"\u00A0"}GB · 8–20{"\u00A0"}MB 并发分片
                  </p>
                  <h1 className="taste-h1 text-xl sm:text-4xl mb-3 sm:mb-4">
                    Personal cloud drive for large files
                  </h1>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      size="default"
                      onClick={triggerFilePicker}
                    >
                      <HardDriveUpload className="h-4 w-4" />
                      <span>Add files</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      onClick={triggerFolderPicker}
                    >
                      <FolderUp className="h-4 w-4" />
                      <span>Add folder</span>
                    </Button>
                  </div>
                </div>

                {/* Live Application UI Surface */}
                <div
                  className="taste-panel"
                  data-visual="cloud-drive-workspace"
                >
                  <div
                    className="app-frame p-3 sm:p-5 space-y-3 sm:space-y-5"
                    data-ui="otterhub-workspace"
                  >
                    <FileUploadZone />
                    {isEmpty ? <EmptyState /> : <FileGallery />}
                  </div>
                </div>
              </div>

              <Footer />
            </div>
          </div>
        </section>
      </main>

      {showBatchBar && <BatchOperationsBar />}
    </>
  );
}
