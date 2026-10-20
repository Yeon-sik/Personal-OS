import { isTauriRuntime } from "../../lib/platform/capabilities";
import type { DeadlineTransport } from "./deadlineScheduler";

/** Desktop scheduled notifications are immediate in Tauri, so never call them. */
export function createTauriDeadlineTransport(): DeadlineTransport {
  const supported = isTauriRuntime() && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const plugin = () => import("@tauri-apps/plugin-notification");
  const core = () => import("@tauri-apps/api/core");
  return {
    supported,
    async permission() { return supported && (await plugin()).isPermissionGranted(); },
    async exactPermission() { return supported && (await core()).invoke<boolean>("deadline_exact_alarm_status"); },
    async requestPermission() { return supported && (await (await plugin()).requestPermission()) === "granted"; },
    async openExactSettings() { if (supported) await (await core()).invoke("deadline_open_exact_alarm_settings"); },
    async pending() { return supported ? (await plugin()).pending() : []; },
    async cancel(ids) { if (supported && ids.length) await (await plugin()).cancel(ids); },
    async schedule(notification) {
      if (!supported) throw new Error("예약 알림은 Android에서만 지원합니다.");
      const { Schedule } = await plugin();
      const options = {
        id: notification.id, title: notification.title, body: notification.body,
        schedule: Schedule.at(new Date(notification.at), false, true),
        extra: { personalOsDeadlineKey: notification.key },
      };
      // In pinned 2.3.3, show/notify schedules but does not append to the mobile
      // pending store. batch does, and expects sourceJson for storage/readback.
      // Await it and verify pending() instead of treating sendNotification(void)
      // as proof of a durable OS reservation.
      await (await core()).invoke("plugin:notification|batch", {
        notifications: [{ ...options, sourceJson: JSON.stringify(options) }],
      });
    },
  };
}
