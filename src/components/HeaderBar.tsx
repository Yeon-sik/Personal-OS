import {
  Cloud,
  CloudOff,
  HardDrive,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { APP_TAB_LABELS, type AppTab } from "../app/navigation";
import type { Device } from "../types";
import type { SyncStatus } from "../lib/sync/syncTypes";
import { getSyncStatusDescription, getSyncStatusLabel } from "./syncStatusPresentation";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type HeaderView = AppTab;

interface HeaderBarProps {
  activeView: HeaderView;
  device: Device | null;
  syncStatus: SyncStatus;
  saveState: SaveState;
}

const viewDescriptions: Record<AppTab, string> = {
  home: "오늘의 상태와 다음 행동",
  records: "날짜별 기록과 상세 내용",
  projects: "프로젝트와 워크스트림 운영",
  settings: "동기화와 앱 환경",
};

function getSaveLabel(saveState: SaveState): string {
  if (saveState === "saving") {
    return "저장 중";
  }

  if (saveState === "error") {
    return "저장 실패";
  }

  if (saveState === "saved") {
    return "자동 저장됨";
  }

  return "대기 중";
}

function getSyncClasses(mode: SyncStatus["mode"]): string {
  if (mode === "synced") {
    return "border-cyan-200/70 bg-cyan-50/60 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-200";
  }

  if (mode === "syncing") {
    return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
  }

  if (mode === "error") {
    return "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-300";
}

export function HeaderBar({
  activeView,
  device,
  syncStatus,
  saveState,
}: HeaderBarProps) {
  const SyncIcon =
    syncStatus.mode === "offline" || syncStatus.mode === "local-only"
      ? CloudOff
      : syncStatus.mode === "syncing"
        ? RefreshCw
        : Cloud;

  return (
    <header className="os-context-bar shrink-0 px-3 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-normal text-slate-950 dark:text-neutral-50">
            Personal OS
          </h1>
          <p className="truncate text-[11px] text-slate-500 dark:text-neutral-400">
            {viewDescriptions[activeView]}
          </p>
        </div>

        <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-neutral-400">
          {APP_TAB_LABELS[activeView]}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-300">
          <Monitor
            className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            {device?.name ?? "기기 확인 중"}
          </span>
        </div>

        <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-300">
          <HardDrive
            className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">{getSaveLabel(saveState)}</span>
        </div>

        <div
          className={`flex h-8 min-w-0 items-center gap-1.5 rounded-md border px-2 ${getSyncClasses(
            syncStatus.mode,
          )}`}
          title={getSyncStatusDescription(syncStatus)}
        >
          <SyncIcon
            className={
              syncStatus.mode === "syncing"
                ? "h-4 w-4 shrink-0 animate-spin"
                : "h-4 w-4 shrink-0"
            }
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">{getSyncStatusLabel(syncStatus.mode)}</span>
          <span
            className={
              syncStatus.isOnline
                ? "h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                : "h-2 w-2 shrink-0 rounded-full bg-slate-400"
            }
            aria-label={syncStatus.isOnline ? "온라인" : "오프라인"}
          />
        </div>
      </div>
    </header>
  );
}
