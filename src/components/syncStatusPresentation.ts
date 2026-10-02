import type { SyncStatus } from "../lib/sync/syncTypes";

const labels: Record<SyncStatus["mode"], string> = {
  "local-only": "로컬 저장",
  offline: "오프라인",
  syncing: "동기화 중",
  synced: "동기화됨",
  error: "동기화 오류",
};

export function getSyncStatusLabel(mode: SyncStatus["mode"]): string {
  return labels[mode];
}

export function getSyncStatusDescription(status: SyncStatus): string {
  if (status.mode === "error") return status.detail;
  if (status.mode === "local-only") return "이 기기에 저장됩니다. 설정에서 동기화를 연결할 수 있습니다.";
  if (status.mode === "offline") return "인터넷 연결이 복구되면 변경 사항을 동기화합니다.";
  if (status.mode === "syncing") return "로컬 변경 사항을 서버와 동기화하고 있습니다.";
  return "이 기기의 변경 사항을 동기화했습니다.";
}
