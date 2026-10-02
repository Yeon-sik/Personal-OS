import { ArrowUpRight, CheckCheck, ClipboardList, FolderKanban, NotebookPen, Plus } from "lucide-react";
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
  const liveProjectIds = new Set(liveProjects.map((project) => project.id));
  const activeProjects = liveProjects.filter((project) => project.status === "ACTIVE");
  const activeWorkstreams = snapshot.workstreams.filter((workstream) => workstream.deletedAt === null && workstream.status === "ACTIVE");
  const liveWorkstreamIds = new Set(snapshot.workstreams.filter((workstream) => workstream.deletedAt === null).map((workstream) => workstream.id));
  const blockedActions = snapshot.projectActions.filter((action) => action.deletedAt === null && liveProjectIds.has(action.projectId) && action.type === "BLOCKED" && action.status === "OPEN").length
    + snapshot.workstreamActions.filter((action) => action.deletedAt === null && liveWorkstreamIds.has(action.workstreamId) && action.type === "BLOCKED" && action.status === "OPEN").length;
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

        <div className="grid gap-3 lg:grid-cols-2">
          <section aria-labelledby="home-next-heading" className="rounded-md border border-slate-300 bg-white p-4 dark:border-neutral-800 dark:bg-black">
            <div className="flex items-center justify-between gap-2">
              <h2 id="home-next-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100"><CheckCheck className="h-4 w-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />다음 할 일</h2>
              <button type="button" onClick={() => onOpenRecords("tasks")} className="min-h-8 text-xs text-slate-500 transition-colors duration-150 hover:text-cyan-700 dark:text-neutral-400 dark:hover:text-cyan-300">모두 보기</button>
            </div>
            {remainingTasks.length > 0 ? (
              <ul className="mt-2 divide-y divide-slate-200 dark:divide-neutral-800">
                {remainingTasks.slice(0, 3).map((task) => <li key={task.id} className="flex items-start gap-2 py-2 text-sm text-slate-700 dark:text-neutral-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600 dark:bg-cyan-400" aria-hidden="true" /><span className="min-w-0 break-words">{task.text}</span></li>)}
              </ul>
            ) : <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">오늘 예정된 할 일이 없습니다. 빠른 입력에서 다음 할 일을 추가하세요.</p>}
          </section>

          <section aria-labelledby="home-state-heading" className="rounded-md border border-slate-300 bg-white p-4 dark:border-neutral-800 dark:bg-black">
            <h2 id="home-state-heading" className="text-sm font-semibold text-slate-900 dark:text-neutral-100">확인할 상태</h2>
            <button type="button" onClick={onOpenProjects} className="mt-3 flex w-full items-center justify-between gap-3 text-left text-xs">
              <div className="min-w-0">
                <p className="text-slate-700 dark:text-neutral-200">프로젝트 {activeProjects.length}개 · 진행 작업 묶음 {activeWorkstreams.length}개</p>
                <p className={`mt-1 ${blockedActions > 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-neutral-500"}`}>{blockedActions > 0 ? `막힌 행동 ${blockedActions}개를 확인하세요.` : "막힌 행동이 없습니다."}</p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-neutral-500" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onOpenRecords("fitness", today)} className="mt-3 flex w-full items-center justify-between gap-3 border-t border-slate-200 pt-3 text-left text-xs dark:border-neutral-800">
              <div className="min-w-0">
                <p className="text-slate-700 dark:text-neutral-200">건강 · 최근 7일 운동 {fitness.weeklyWorkoutCount}회{fitness.latestWeightKg === null ? "" : ` · 최근 체중 ${fitness.latestWeightKg.toLocaleString("ko-KR")} kg`}</p>
                <p className="mt-1 text-slate-500 dark:text-neutral-500">공유된 운동 요약을 확인합니다. 운동 상세 수정은 건강 앱에서 진행합니다.</p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-neutral-500" aria-hidden="true" />
            </button>
          </section>
        </div>
      </div>
    </section>
  );
}
