import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useMobileLayout } from "../../../app/MobileLayoutContext";
import { MobileDeleteButton } from "../../../components/MobileDeleteButton";

// 선택 날짜의 기록 묶음을 제목, 개수, 빈 상태와 함께 렌더링합니다.
export function DailySection({
  children,
  count,
  emptyText,
  icon,
  title,
}: {
  children: ReactNode;
  count: number;
  emptyText: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
        {icon}
        <span>{title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </section>
  );
}

// 일별 목록에서 하나의 기록 행을 마커와 선택 액션 영역으로 구성합니다.
export function DailyItem({
  actions,
  children,
  markerClassName,
}: {
  actions?: ReactNode;
  children: ReactNode;
  markerClassName: string;
}) {
  return (
    <div className="mobile-daily-item flex min-h-10 items-start gap-2 rounded-md border border-slate-200 px-2 py-2 dark:border-neutral-800">
      <span className="mt-1.5 inline-flex h-2 w-2 shrink-0 items-center justify-center">
        <span className={`block h-1.5 w-1.5 rounded-full ${markerClassName}`} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  );
}

// 기록 행 오른쪽에 붙는 삭제 전용 아이콘 버튼입니다.
export function DeleteItemButton({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => void;
}) {
  const mobileLayout = useMobileLayout();
  if (mobileLayout) return <MobileDeleteButton label={label} itemName={label.replace(/ 삭제$/, "")} onDelete={onDelete} />;
  return (
    <button
      type="button"
      onClick={onDelete}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-200"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
