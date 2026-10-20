import type { Task } from "../../types";
import { reconcileDeadlineNotifications, type DeadlineSettings, type OwnedDeadlineNotification } from "./deadlinePlanner";
import { DeadlineStorage } from "./deadlineStorage";

export interface PendingDeadlineNotification { id: number; title?: string; body?: string }
export interface DeadlineTransport {
  supported: boolean;
  permission(): Promise<boolean>;
  exactPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  openExactSettings(): Promise<void>;
  pending(): Promise<PendingDeadlineNotification[]>;
  cancel(ids: number[]): Promise<void>;
  schedule(notification: OwnedDeadlineNotification): Promise<void>;
}
export interface DeadlineRuntimeStatus {
  permission: "unknown" | "granted" | "denied" | "unsupported";
  exactGranted: boolean;
  count: number;
  error: string | null;
}

/** Serializes native changes and journals each ID before any OS write. */
export class DeadlineScheduler {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly transport: DeadlineTransport, private readonly storage: DeadlineStorage,
    private readonly clock: () => string = () => new Date().toISOString()) {}
  reconcile(tasks: readonly Task[], settings: DeadlineSettings, scope: string, now?: string): Promise<DeadlineRuntimeStatus> {
    const clock = now === undefined ? this.clock : () => now;
    const result = this.queue.catch(() => undefined).then(() => this.apply(tasks, settings, scope, clock));
    this.queue = result;
    return result;
  }
  private async apply(tasks: readonly Task[], settings: DeadlineSettings, scope: string, clock: () => string): Promise<DeadlineRuntimeStatus> {
    if (!this.transport.supported) return { permission: "unsupported", exactGranted: false, count: 0, error: null };
    const granted = await this.transport.permission();
    const exactGranted = await this.transport.exactPermission();
    let owned = this.storage.loadOwned();
    const pending = await this.transport.pending();
    const pendingById = new Map(pending.map(row => [row.id, row]));
    for (const row of owned) {
      const native = pendingById.get(row.id);
      if (native && (native.title !== row.title || native.body !== row.body)) {
        throw new Error("다른 알림과 ID가 충돌했습니다. 해당 알림은 취소하지 않았습니다.");
      }
    }
    const knownIds = new Set(owned.map(row => row.id));
    const plan = reconcileDeadlineNotifications(tasks, { ...settings, enabled: settings.enabled && granted && exactGranted }, clock(), scope,
      owned.map(row => pendingById.has(row.id) ? row : { ...row, applied: false }),
      pending.filter(row => !knownIds.has(row.id)).map(row => row.id));
    for (const row of plan.cancel) {
      if (pendingById.has(row.id)) await this.transport.cancel([row.id]);
      owned = owned.filter(item => item.key !== row.key);
      this.storage.saveOwned(owned);
    }
    for (const row of plan.add) {
      // Permission dialogs/native calls or a queued reconciliation can outlive
      // today's clock. Never submit a past alarm for immediate OS delivery.
      if (Date.parse(row.at) <= Date.parse(clock())) continue;
      // Failure here must prevent OS scheduling. A crash after the OS call leaves
      // applied=false, so next startup cancels/replaces this same owned ID safely.
      owned = [...owned.filter(item => item.key !== row.key), row];
      this.storage.saveOwned(owned);
      await this.transport.schedule(row);
      const confirmed = (await this.transport.pending()).find(item => item.id === row.id);
      if (!confirmed || confirmed.title !== row.title || confirmed.body !== row.body) throw new Error("OS 예약 확정값을 확인하지 못했습니다.");
      owned = owned.map(item => item.key === row.key ? { ...row, applied: true } : item);
      this.storage.saveOwned(owned);
    }
    return { permission: granted ? "granted" : "denied", exactGranted,
      count: owned.filter(row => Date.parse(row.at) > Date.parse(clock()) && row.applied).length,
      error: plan.issues.length ? plan.issues.join("\n") : null };
  }
}
