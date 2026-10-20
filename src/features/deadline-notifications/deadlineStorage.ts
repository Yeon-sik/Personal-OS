import type { DeadlineSettings, OwnedDeadlineNotification } from "./deadlinePlanner";

export const DEADLINE_SETTINGS_KEY = "personal-os:deadline-settings:v1";
export const DEADLINE_REGISTRY_KEY = "personal-os:deadline-registry:v1";
export const defaultDeadlineSettings: DeadlineSettings = { enabled: false, time: null, timeZone: "Asia/Seoul" };
export class DeadlineStorage {
  constructor(private readonly storage: () => Storage) {}
  loadSettings(): DeadlineSettings {
    const raw = this.storage().getItem(DEADLINE_SETTINGS_KEY);
    if (raw === null) return { ...defaultDeadlineSettings };
    const value = JSON.parse(raw) as { version?: number; settings?: DeadlineSettings };
    const settings = value.settings;
    if (value.version !== 1 || !settings || typeof settings.enabled !== "boolean" ||
      (settings.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time)) || typeof settings.timeZone !== "string") {
      throw new Error("마감 알림 설정을 읽지 못했습니다. 저장 데이터를 지우지 말고 확인하세요.");
    }
    new Intl.DateTimeFormat("en", { timeZone: settings.timeZone });
    return settings;
  }
  saveSettings(settings: DeadlineSettings) {
    this.storage().setItem(DEADLINE_SETTINGS_KEY, JSON.stringify({ version: 1, settings }));
  }
  loadOwned(): OwnedDeadlineNotification[] {
    const raw = this.storage().getItem(DEADLINE_REGISTRY_KEY);
    if (raw === null) return [];
    const value = JSON.parse(raw) as { version?: number; owned?: OwnedDeadlineNotification[] };
    if (value.version !== 1 || !Array.isArray(value.owned) || value.owned.some(row => !row ||
      !Number.isInteger(row.id) || row.id < 1 || row.id > 2147483647 ||
      [row.key,row.taskId,row.fireDate,row.at,row.title,row.body].some(field => typeof field !== "string") ||
      !Number.isFinite(Date.parse(row.at)) || typeof row.applied !== "boolean" ||
      (row.nativeRevision !== undefined && row.nativeRevision !== 2)) ||
      new Set(value.owned.map(row => row.id)).size !== value.owned.length ||
      new Set(value.owned.map(row => row.key)).size !== value.owned.length) {
      throw new Error("알림 예약 소유권 기록을 읽지 못했습니다. 다른 알림 보호를 위해 예약을 중단했습니다.");
    }
    return value.owned;
  }
  saveOwned(owned: OwnedDeadlineNotification[]) {
    this.storage().setItem(DEADLINE_REGISTRY_KEY, JSON.stringify({ version: 1, owned }));
  }
}
