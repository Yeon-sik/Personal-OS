import type { ReactNode } from "react";
import { RECORD_SECTION_LABELS, type RecordSection } from "../../app/navigation";
import { RecordNavigation } from "../../components/RecordNavigation";

interface RecordHubProps {
  activeSection: RecordSection;
  selectedDate: string;
  onChangeSection: (section: RecordSection) => void;
  children: ReactNode;
}

export function RecordHub({ activeSection, selectedDate, onChangeSection, children }: RecordHubProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-slate-950 dark:text-neutral-100">기록</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
          달력에서 하루를 살펴보고, 필요한 기록을 이어가세요.
        </p>
      </div>
      <RecordNavigation activeSection={activeSection} onChangeSection={onChangeSection} />
      {activeSection === "fitness" ? (
        <div className="flex shrink-0 items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 dark:text-neutral-400">선택 날짜 · {selectedDate}</span>
          <button type="button" className="min-h-8 text-cyan-700 dark:text-cyan-300" onClick={() => onChangeSection("all")}>
            달력에서 날짜 선택
          </button>
        </div>
      ) : null}
      <div
        id={`records-${activeSection}`}
        className="os-record-content grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden"
        role="region"
        aria-label={`${RECORD_SECTION_LABELS[activeSection]} 기록`}
      >
        {children}
      </div>
    </div>
  );
}
