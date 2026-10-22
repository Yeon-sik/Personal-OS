import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMobileLayoutState, useMobileViewport } from "./MobileLayoutContext";

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); vi.unstubAllGlobals(); });

describe("mobile layout and keyboard viewport", () => {
  it("adapts to window/input changes while retaining the Windows layout", () => {
    let listener = () => {};
    const remove = vi.fn();
    const media = { matches: true, addEventListener: (_: string, callback: () => void) => { listener = callback; }, removeEventListener: remove };
    vi.stubGlobal("window", { matchMedia: () => media });
    function Probe({ windows = false }: { windows?: boolean }) { return <div data-mobile={useMobileLayoutState(windows)} />; }
    act(() => { renderer = create(<Probe />); });
    expect(renderer!.root.findByType("div").props["data-mobile"]).toBe(true);
    act(() => { media.matches = false; listener(); });
    expect(renderer!.root.findByType("div").props["data-mobile"]).toBe(false);
    act(() => { media.matches = true; listener(); renderer!.update(<Probe windows />); });
    expect(renderer!.root.findByType("div").props["data-mobile"]).toBe(false);
    act(() => renderer!.unmount()); renderer = undefined;
    expect(remove).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("tracks keyboard resizing and offsets, preserves pinch zoom, and cleans up", () => {
    const listeners = new Map<string, () => void>();
    const viewport = { height: 800, offsetTop: 0, scale: 1, addEventListener: (event: string, fn: () => void) => listeners.set(event, fn), removeEventListener: vi.fn() };
    const properties = new Map<string, string>();
    const shell = { style: { setProperty: (key: string, value: string) => properties.set(key, value), removeProperty: (key: string) => properties.delete(key) }, dataset: {} as Record<string, string> };
    vi.stubGlobal("window", { visualViewport: viewport });
    function Probe({ enabled = true }: { enabled?: boolean }) { return <div ref={useMobileViewport(enabled)} />; }
    act(() => { renderer = create(<Probe />, { createNodeMock: () => shell }); });
    expect(properties.get("--mobile-viewport-height")).toBe("800px");
    act(() => { viewport.height = 360; viewport.offsetTop = 20; listeners.get("resize")!(); });
    expect(properties.get("--mobile-viewport-height")).toBe("360px");
    expect(properties.get("--mobile-viewport-top")).toBe("20px");
    expect(shell.dataset.shortViewport).toBe("true");
    act(() => { viewport.scale = 2; viewport.height = 180; listeners.get("resize")!(); });
    expect(properties.get("--mobile-viewport-height")).toBe("360px");
    act(() => renderer!.update(<Probe enabled={false} />));
    expect(properties.size).toBe(0);
    expect(viewport.removeEventListener).toHaveBeenCalledTimes(2);
    expect(shell.dataset.shortViewport).toBeUndefined();
  });
});
