"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFileDataStore } from "@/stores/file";
import { FILE_TYPE_ITEMS } from "./FileTypeTabs";
import { cn } from "@/lib/utils";

export function FileTypeDropdown() {
  const activeType = useFileDataStore((s) => s.activeType);
  const buckets = useFileDataStore((s) => s.buckets);
  const setActiveType = useFileDataStore((s) => s.setActiveType);

  const currentType =
    FILE_TYPE_ITEMS.find((type) => type.id === activeType) ||
    FILE_TYPE_ITEMS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="default">
          {currentType?.icon && (
            <currentType.icon className="taste-accent-text h-4 w-4" />
          )}
          <span>{currentType?.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-44 rounded-[var(--r-md)] border border-border bg-popover p-1"
      >
        {FILE_TYPE_ITEMS.map((type) => {
          const Icon = type.icon;
          const isActive = activeType === type.id;
          const count = buckets[type.id]?.items?.length || 0;

          return (
            <DropdownMenuItem
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={cn(
                "flex items-center justify-between rounded-[var(--r-sm)] px-2.5 py-2 text-sm cursor-pointer",
                isActive
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive ? "taste-accent-text" : "text-muted-foreground",
                  )}
                />
                <span>{type.label}</span>
              </div>
              {count > 0 && (
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {count}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
