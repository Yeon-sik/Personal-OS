import { useEffect, useRef, type ReactNode, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export const actionButtonClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900";
export const actionInputClass = "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100";
export function ActionDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex='0']") ?? []);
    const first = items[0], last = items[items.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
  }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={keydown}
      className="flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white text-slate-950 outline-none dark:bg-neutral-950 dark:text-neutral-100 sm:max-w-2xl sm:rounded-xl">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} disabled={busy} className={actionButtonClass} aria-label="일정 창 닫기"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  </div>;
}
