import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriDeadlineTransport } from "./tauriDeadlineTransport";
import type { OwnedDeadlineNotification } from "./deadlinePlanner";

const native = vi.hoisted(() => ({ tauri: true, invoke: vi.fn() }));
vi.mock("../../lib/platform/capabilities", () => ({ isTauriRuntime: () => native.tauri }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke, addPluginListener: vi.fn() }));

const notification: OwnedDeadlineNotification = {
  id: 42, key: "owned-key", taskId: "task", fireDate: "2027-01-01", at: "2027-01-01T00:00:00Z",
  title: "Personal OS · D-3", body: "접수 마감이 3일 남았습니다.", applied: false,
};

beforeEach(() => {
  native.tauri = true;
  native.invoke.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 15)" });
});
afterEach(() => vi.unstubAllGlobals());

describe("Android native notification transport", () => {
  it("awaits the durable batch command with sourceJson and a one-shot idle-capable date", async () => {
    await createTauriDeadlineTransport().schedule(notification);
    expect(native.invoke).toHaveBeenCalledTimes(1);
    const [command, args] = native.invoke.mock.calls[0];
    expect(command).toBe("plugin:notification|batch");
    const row = args.notifications[0];
    const stored = JSON.parse(row.sourceJson);
    expect(stored).toMatchObject({ id: 42, title: notification.title, body: notification.body,
      extra: { personalOsDeadlineKey: "owned-key" },
      schedule: { at: { date: new Date(notification.at).toISOString(), repeating: false, allowWhileIdle: true } } });
  });
  it("propagates native scheduling rejection for journal recovery", async () => {
    native.invoke.mockRejectedValueOnce(new Error("native unavailable"));
    await expect(createTauriDeadlineTransport().schedule(notification)).rejects.toThrow("native unavailable");
  });
  it.each(["Mozilla/5.0 (Windows NT 10.0)", "Mozilla/5.0 (Linux; Android 15)"])("never schedules from an unsupported runtime: %s", async userAgent => {
    vi.stubGlobal("navigator", { userAgent });
    native.tauri = !userAgent.includes("Android"); // Desktop Tauri or ordinary mobile browser.
    const transport = createTauriDeadlineTransport();
    expect(transport.supported).toBe(false);
    await expect(transport.schedule(notification)).rejects.toThrow("Android");
    expect(await transport.pending()).toEqual([]);
    await transport.cancel([42]);
    expect(native.invoke).not.toHaveBeenCalled();
  });
});
