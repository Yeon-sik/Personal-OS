import type { Device, LocalDataSnapshot } from "../../types";
import type { PendingRevision } from "./syncState";

// 헤더와 설정 패널에서 공유하는 동기화 상태 모델이다.
export type SyncMode = "offline" | "syncing" | "synced" | "error" | "local-only";

export interface SyncStatus {
  mode: SyncMode;
  label: string;
  detail: string;
  isOnline: boolean;
  lastSyncedAt: string | null;
  isConfigured: boolean;
  fitnessReadModels?: FitnessReadModelDiagnostics;
}

export type FitnessReadModelName = "workout" | "nutrition" | "weight";
export type FitnessReadModelState = "connected" | "empty" | "error";

export interface FitnessReadModelStatus {
  state: FitnessReadModelState;
  detail: string;
}

export type FitnessReadModelDiagnostics = Record<
  FitnessReadModelName,
  FitnessReadModelStatus
>;

export interface SyncResult {
  status: SyncStatus;
  changedRows: number;
  snapshot?: LocalDataSnapshot;
  acknowledged?: PendingRevision[];
  received?: { base: LocalDataSnapshot; snapshot: LocalDataSnapshot };
}

export interface SyncContext {
  device: Device;
  userId: string;
  backend?: string;
}

export interface AuthState {
  userId: string | null;
  email: string | null;
}

export interface FinanceDailySummary {
  date: string;
  incomeKrw: number;
  expenseKrw: number;
  netKrw: number;
  entryCount: number;
}

// Realtime/heartbeat 구현체가 정리 함수를 동일한 모양으로 반환하게 한다.
export interface RealtimeSubscription {
  unsubscribe(): Promise<void> | void;
}

export interface RealtimeOptions {
  context: SyncContext;
  getSnapshot: () => LocalDataSnapshot;
  onSnapshot: (snapshot: LocalDataSnapshot, status: SyncStatus) => void;
  onError: (message: string) => void;
}

// 로컬 전용 모드와 Supabase 모드를 같은 앱 훅에서 사용할 수 있게 하는 계약이다.
export interface SyncClient {
  getBackend?(): string;
  getStatus(): SyncStatus;
  isConfigured(): boolean;
  getAuthState(): Promise<AuthState>;
  signIn(email: string, password: string): Promise<AuthState>;
  signOut(): Promise<void>;
  getFinanceDailySummaries(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<FinanceDailySummary[]>;
  pull(localSnapshot: LocalDataSnapshot, context: SyncContext, options?: { full?: boolean }): Promise<LocalDataSnapshot>;
  push(localSnapshot: LocalDataSnapshot, context: SyncContext): Promise<SyncResult>;
  subscribeRealtime(options: RealtimeOptions): RealtimeSubscription;
  startHeartbeat(context: SyncContext): RealtimeSubscription;
  getActiveDevices(context: SyncContext, fallbackDevices: Device[]): Promise<Device[]>;
}
