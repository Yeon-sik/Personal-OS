import { describe, expect, it } from "vitest";
import { isWindowsDesktop } from "./WindowsDesktopContext";

describe("Windows UI boundary", () => {
  it("enables the desktop layout for Windows WebView2 and Windows browsers", () => {
    expect(isWindowsDesktop("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0")).toBe(true);
  });
  it.each([
    "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
    "Mozilla/5.0 (Windows Phone 10.0; Android 6.0; Windows NT 10.0)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "",
  ])("keeps the existing UI outside Windows desktop: %s", (userAgent) => {
    expect(isWindowsDesktop(userAgent)).toBe(false);
  });
});
