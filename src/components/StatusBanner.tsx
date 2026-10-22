import { AlertTriangle } from "lucide-react";
import { useWindowsDesktop } from "../app/WindowsDesktopContext";

interface StatusBannerProps {
  message: string;
}

// 저장/동기화 오류처럼 사용자가 알아야 할 상태를 상단에 노출한다.
export function StatusBanner({ message }: StatusBannerProps) {
  const windowsDesktop = useWindowsDesktop();
  return (
    <div role={windowsDesktop ? "alert" : undefined} className={`${windowsDesktop ? "shrink-0 " : ""}flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200`}>
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
