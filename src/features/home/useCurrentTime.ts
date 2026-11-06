import { useEffect, useState } from "react";

/** Refresh deadlines and the date after midnight or returning to a suspended mobile webview. */
export function useCurrentTime(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}
