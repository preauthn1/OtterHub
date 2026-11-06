import { FileItem, FileTag } from "@shared/types";

// 标签展示配置（taste-skill 规范：零紫色/薰衣草色，4.5:1+ 对比度）
export interface TagDisplayConfig {
  label: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const TAG_CONFIG: Record<FileTag, TagDisplayConfig> = {
  [FileTag.NSFW]: {
    label: "NSFW",
    description: "敏感内容",
    bgColor: "bg-amber-500/15",
    textColor: "text-amber-800 dark:text-amber-300",
    borderColor: "border-amber-500/40",
  },
  [FileTag.Private]: {
    label: "Private",
    description: "私有文件",
    bgColor: "bg-sky-500/15",
    textColor: "text-sky-800 dark:text-sky-300",
    borderColor: "border-sky-500/40",
  },
};

export enum BatchTagState {
  None = "none",
  Partial = "partial",
  All = "all",
}

export type TagStateMap = Record<FileTag, BatchTagState>;

export type TagIntent = "keep" | "add" | "remove";

const NEXT_STATE: Record<
  BatchTagState,
  Record<BatchTagState, BatchTagState[]>
> = {
  [BatchTagState.None]: {
    [BatchTagState.None]: [BatchTagState.All],
    [BatchTagState.All]: [BatchTagState.None],
    [BatchTagState.Partial]: [],
  },
  [BatchTagState.All]: {
    [BatchTagState.All]: [BatchTagState.None],
    [BatchTagState.None]: [BatchTagState.All],
    [BatchTagState.Partial]: [],
  },
  [BatchTagState.Partial]: {
    [BatchTagState.Partial]: [BatchTagState.All],
    [BatchTagState.All]: [BatchTagState.None],
    [BatchTagState.None]: [BatchTagState.Partial],
  },
};

export function getTagIntent(
  current: BatchTagState,
  original: BatchTagState,
): TagIntent {
  if (current === original) return "keep";
  if (current === BatchTagState.All) return "add";
  return "remove";
}

export function calcOriginalTagStates(files: FileItem[]): TagStateMap {
  const states = Object.fromEntries(
    Object.values(FileTag).map((tag) => [tag, BatchTagState.None]),
  ) as TagStateMap;

  if (files.length === 0) return states;

  for (const tag of Object.values(FileTag)) {
    const count = files.filter((f) => f.metadata?.tags?.includes(tag)).length;

    if (count === 0) {
      states[tag] = BatchTagState.None;
    } else if (count === files.length) {
      states[tag] = BatchTagState.All;
    } else {
      states[tag] = BatchTagState.Partial;
    }
  }

  return states;
}

export function nextTagState(
  current: BatchTagState,
  original: BatchTagState,
): BatchTagState {
  const next = NEXT_STATE[original][current];
  return next?.[0] ?? current;
}

export function applyTagStates(
  existing: FileTag[],
  states: TagStateMap,
  original: TagStateMap,
): FileTag[] {
  const result = new Set<FileTag>(existing);

  for (const tag of Object.values(FileTag)) {
    const intent = getTagIntent(states[tag], original[tag]);

    if (intent === "add") result.add(tag);
    if (intent === "remove") result.delete(tag);
  }

  return [...result];
}

export function hasAnyTagChange(
  states: TagStateMap,
  original: TagStateMap,
): boolean {
  return Object.values(FileTag).some(
    (tag) => getTagIntent(states[tag], original[tag]) !== "keep",
  );
}
