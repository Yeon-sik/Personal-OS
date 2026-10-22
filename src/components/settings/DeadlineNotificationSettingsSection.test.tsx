import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { DeadlineNotificationsRuntime } from "../../features/deadline-notifications/useDeadlineNotifications";
import { DeadlineNotificationSettingsSection } from "./DeadlineNotificationSettingsSection";

function runtime(): DeadlineNotificationsRuntime {
  return { settings: { enabled: false, time: null, timeZone: "Asia/Seoul" },
    status: { permission: "denied", exactGranted: false, count: 0, error: null }, busy: false, blocked: false, error: null, enabled: false,
    setEnabled: vi.fn().mockResolvedValue(undefined), setTime: vi.fn(), openExactSettings: vi.fn().mockResolvedValue(undefined) };
}
describe("deadline notification settings", () => {
  it("has no silent default time or enabled state, and changes only on user interaction", () => {
    const model = runtime(); let view!: ReturnType<typeof create>;
    act(() => { view = create(<DeadlineNotificationSettingsSection notifications={model} />); });
    const checkbox = view.root.findByProps({ "aria-label": "마감 알림 사용" });
    expect(checkbox.props.checked).toBe(false);
    expect(view.root.findByProps({ "aria-label": "마감 알림 시각" }).props.value).toBe("");
    expect(model.setEnabled).not.toHaveBeenCalled();
    act(() => { checkbox.props.onChange({ target: { checked: true } }); });
    expect(model.setEnabled).toHaveBeenCalledWith(true);
    act(() => { view.unmount(); });
  });
  it("shows denied/exact permission states and disables unsupported desktop scheduling", () => {
    const model = runtime(); model.error = "알림 권한이 없습니다."; let view!: ReturnType<typeof create>;
    act(() => { view = create(<DeadlineNotificationSettingsSection notifications={model} />); });
    expect(view.root.findByProps({ role: "alert" }).children.join("")).toContain("권한");
    model.status = { ...model.status, permission: "granted" };
    act(() => { view.update(<DeadlineNotificationSettingsSection notifications={model} />); });
    expect(view.root.findAllByType("button")).toHaveLength(1);
    model.status = { ...model.status, permission: "unsupported" };
    act(() => { view.update(<DeadlineNotificationSettingsSection notifications={model} />); });
    expect(view.root.findByProps({ "aria-label": "마감 알림 사용" }).props.disabled).toBe(true);
    expect(view.root.findAllByType("button")).toHaveLength(0);
    act(() => { view.unmount(); });
  });
  it("prevents overwriting settings whose stored format could not be read", () => {
    const model = runtime(); model.blocked = true; let view!: ReturnType<typeof create>;
    act(() => { view = create(<DeadlineNotificationSettingsSection notifications={model} />); });
    expect(view.root.findByProps({ "aria-label": "마감 알림 사용" }).props.disabled).toBe(true);
    expect(view.root.findByProps({ "aria-label": "마감 알림 시각" }).props.disabled).toBe(true);
    act(() => { view.unmount(); });
  });
});
