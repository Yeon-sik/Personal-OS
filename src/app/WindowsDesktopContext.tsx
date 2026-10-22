import { createContext, useContext } from "react";

// A narrow Windows window is still desktop UI. Never select this layout by width alone.
export function isWindowsDesktop(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /Windows NT/i.test(userAgent) && !/Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
}

export const WindowsDesktopContext = createContext(false);
export const useWindowsDesktop = () => useContext(WindowsDesktopContext);
