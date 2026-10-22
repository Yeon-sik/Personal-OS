import { createContext, useContext, useEffect, useRef, useState } from "react";

// Layout follows the available window/input, while Windows keeps its own shell.
const mobileQuery = "(max-width: 767px), (hover: none) and (pointer: coarse)";
export const MobileLayoutContext = createContext(false);
export const useMobileLayout = () => useContext(MobileLayoutContext);

export function useMobileLayoutState(windowsDesktop: boolean) {
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(mobileQuery).matches));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.(mobileQuery);
    if (!media) return;
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return !windowsDesktop && compact;
}

export function useMobileViewport(enabled: boolean) {
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!enabled || !shell || !viewport) return;
    const update = () => {
      // Do not resize the interface while the user is pinch-zooming.
      if (viewport.scale !== 1) return;
      shell.style.setProperty("--mobile-viewport-height", `${viewport.height}px`);
      shell.style.setProperty("--mobile-viewport-top", `${viewport.offsetTop}px`);
      shell.dataset.shortViewport = String(viewport.height < 500);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      shell.style.removeProperty("--mobile-viewport-height");
      shell.style.removeProperty("--mobile-viewport-top");
      delete shell.dataset.shortViewport;
    };
  }, [enabled]);
  return shellRef;
}
