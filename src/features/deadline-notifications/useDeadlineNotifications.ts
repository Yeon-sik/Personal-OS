import { useEffect, useRef, useState } from "react";
import type { Task } from "../../types";
import { DeadlineScheduler, type DeadlineRuntimeStatus } from "./deadlineScheduler";
import { defaultDeadlineSettings, DeadlineStorage } from "./deadlineStorage";
import type { DeadlineSettings } from "./deadlinePlanner";
import { createTauriDeadlineTransport } from "./tauriDeadlineTransport";

const storage = new DeadlineStorage(() => window.localStorage);
let scheduler: DeadlineScheduler | undefined;
function getScheduler() { return scheduler ??= new DeadlineScheduler(createTauriDeadlineTransport(), storage); }
const initialStatus: DeadlineRuntimeStatus = { permission: "unknown", exactGranted: false, count: 0, error: null };

export function useDeadlineNotifications(tasks: readonly Task[], ready: boolean, scope: string) {
  const [loaded] = useState(() => {
    try { return { settings: typeof window === "undefined" ? { ...defaultDeadlineSettings } : storage.loadSettings(), error: null }; }
    catch { return { settings: { ...defaultDeadlineSettings }, error: "마감 알림 설정을 읽지 못했습니다. 기존 데이터는 보존했습니다." }; }
  });
  const [settings, setSettings] = useState<DeadlineSettings>(loaded.settings);
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(loaded.error);
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => { if (typeof document === "undefined" || document.visibilityState !== "hidden") setResume(value => value + 1); };
    window.addEventListener?.("focus", refresh);
    if (typeof document !== "undefined") document.addEventListener?.("visibilitychange", refresh);
    return () => { window.removeEventListener?.("focus", refresh); if (typeof document !== "undefined") document.removeEventListener?.("visibilitychange", refresh); };
  }, []);
  useEffect(() => {
    if (!ready || loaded.error) return;
    let active = true;
    void getScheduler().reconcile(tasks, settings, scope).then(result => {
      if (!active) return;
      setStatus(result);
      setError(null);
      if (settings.enabled && (result.permission === "denied" || (result.permission === "granted" && !result.exactGranted))) {
        const disabled = { ...settings, enabled: false };
        storage.saveSettings(disabled);
        setSettings(disabled);
      }
    }).catch(() => { if (active) setError("알림 예약을 변경하지 못했습니다. 이전 예약이 남아 있을 수 있습니다. 앱을 다시 열면 소유한 예약만 재확인합니다."); });
    return () => { active = false; };
  }, [tasks, ready, scope, settings, resume, loaded.error]);
  function save(next: DeadlineSettings) {
    storage.saveSettings(next);
    setSettings(next);
    setError(null);
  }
  async function setEnabled(enabled: boolean) {
    if (busy || loaded.error) return;
    setBusy(true);
    try {
      if (!enabled) { save({ ...settings, enabled: false }); return; }
      const transport = getScheduler().transport;
      if (!transport.supported) throw new Error("마감 알림은 Android 앱에서 설정하세요.");
      if (!settings.time) throw new Error("알림 시각을 먼저 선택하세요.");
      let granted = await transport.permission();
      if (!granted) granted = await transport.requestPermission(); // User gesture only; never in reconciliation.
      const exactGranted = await transport.exactPermission();
      if (!mounted.current) return;
      setStatus(current => ({ ...current, permission: granted ? "granted" : "denied", exactGranted }));
      if (!granted) throw new Error("알림 권한이 없습니다. Android 앱 설정에서 허용한 후 다시 켜세요.");
      if (!exactGranted) throw new Error("정확한 알림 권한이 필요합니다. 아래 Android 설정에서 허용한 후 다시 켜세요.");
      save({ ...settings, enabled: true });
    } catch (caught) { if (mounted.current) setError(caught instanceof Error ? caught.message : "알림 설정을 저장하지 못했습니다."); }
    finally { if (mounted.current) setBusy(false); }
  }
  function setTime(time: string) {
    if (loaded.error || busy) return;
    try {
      if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("올바른 시각을 선택하세요.");
      save({ ...settings, time: time || null, enabled: time ? settings.enabled : false });
    } catch { setError("알림 시각을 저장하지 못했습니다."); }
  }
  async function openExactSettings() {
    try { await getScheduler().transport.openExactSettings(); }
    catch { setError("Android 알림 설정을 열지 못했습니다."); }
  }
  return { settings, status, busy, blocked: Boolean(loaded.error), error: error || status.error, setEnabled, setTime, openExactSettings,
    enabled: settings.enabled && status.permission === "granted" && status.exactGranted };
}
export type DeadlineNotificationsRuntime = ReturnType<typeof useDeadlineNotifications>;
