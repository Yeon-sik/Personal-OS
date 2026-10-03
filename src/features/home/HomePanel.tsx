import { ArrowUpRight, ClipboardList, FolderKanban, NotebookPen, Plus } from "lucide-react";
import { useMemo } from "react";
import type { LocalDataSnapshot } from "../../types";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import { getSyncStatusLabel } from "../../components/syncStatusPresentation";
import { formatKoreanDate, formatLocalDate } from "../fitness/fitnessDate";
import { getFitnessSummary } from "../fitness-summary/fitnessSummary";
import { getRecordsForDate } from "../records/recordAggregation";
import { BriefMetric } from "../records/components/InteractiveRecordsMetrics";
import { ActivityHeatmap } from "./ActivityHeatmap";

export interface HomePanelProps {
  snapshot: LocalDataSnapshot;
  syncStatus: SyncStatus;
  onOpenRecords: (section?: "all" | "memo" | "tasks" | "fitness", date?: string) => void;
  onOpenProjects: () => void;
  onQuickCapture: () => void;
  today?: string;
}

export function HomePanel({ snapshot, syncStatus, onOpenRecords, onOpenProjects, onQuickCapture, today = formatLocalDate() }: HomePanelProps) {
  const todayRecords = useMemo(() => getRecordsForDate(snapshot, today), [snapshot, today]);
  const fitness = useMemo(() => getFitnessSummary(snapshot, today), [snapshot, today]);
  const todayPlannedTasks = todayRecords.tasks.filter((task) => task.plannedDate === today);
  const remainingTasks = todayPlannedTasks.filter((task) => !task.isDone);
  const completedTasks = todayPlannedTasks.filter((task) => task.isDone);
  const liveProjects = snapshot.projects.filter((project) => project.deletedAt === null);
  const activeProjects = liveProjects.filter((project) => project.status === "ACTIVE");
  const quickActions = [
    { label: "기록 달력", detail: "쌓인 기록 둘러보기", icon: NotebookPen, run: () => onOpenRecords("all", today) },
    { label: "할 일", detail: "오늘 할 일 정리", icon: ClipboardList, run: () => onOpenRecords("tasks") },
    { label: "프로젝트", detail: "진행 상황과 다음 행동", icon: FolderKanban, run: onOpenProjects },
    { label: "빠른 입력", detail: "생각과 할 일 바로 저장", icon: Plus, run: onQuickCapture },
  ];

  return (
    <section aria-label="홈" className="h-full min-h-0 overflow-y-auto pr-1">
      <div className="mx-auto max-w-6xl space-y-4 pb-6">
        <section aria-labelledby="home-today-heading" className="rounded-md border border-slate-300 bg-slate-950 p-4 text-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-cyan-300">오늘의 지휘판</p>
              <h1 id="home-today-heading" className="mt-1 break-keep text-xl font-semibold tracking-normal">지금 확인하고, 바로 시작하세요.</h1>
              <p className="mt-2 text-xs text-neutral-400">{formatKoreanDate(today)}</p>
            </div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-neutral-300">{getSyncStatusLabel(syncStatus.mode)}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <BriefMetric label="오늘 남은 일" value={`${remainingTasks.length}개`} />
            <BriefMetric label="오늘 완료" value={`${completedTasks.length}개`} />
            <BriefMetric label="오늘 운동" value={fitness.todayHasWorkout ? "완료 기록 있음" : "기록 없음"} />
            <BriefMetric label="진행 프로젝트" value={`${activeProjects.length}개`} />
          </div>
        </section>

        <section aria-label="빠른 이동과 행동" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {quickActions.map(({ label, detail, icon: Icon, run }) => (
            <button key={label} type="button" onClick={run} className="group flex min-h-20 items-start gap-2 rounded-md border border-slate-300 bg-white p-3 text-left transition-colors duration-150 hover:border-cyan-700/50 hover:bg-slate-50 dark:border-neutral-800 dark:bg-black dark:hover:border-cyan-500/40 dark:hover:bg-neutral-950">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="break-keep text-sm font-semibold text-slate-800 dark:text-neutral-100">{label}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-500">{detail}</p>
              </div>
              <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors duration-150 group-hover:text-cyan-600 min-[380px]:block dark:text-neutral-600 dark:group-hover:text-cyan-300" aria-hidden="true" />
            </button>
          ))}
        </section>

        <ActivityHeatmap snapshot={snapshot} today={today} onOpenDate={(date) => onOpenRecords("all", date)} onOpenProjects={onOpenProjects} />
      </div>
    </section>
  );
}
