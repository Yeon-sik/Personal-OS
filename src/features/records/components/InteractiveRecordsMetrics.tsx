import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface ChartInteractionHandlers {
  activeIndex: number | null;
  onBlur: () => void;
  onHover: (index: number) => void;
  onLeave: () => void;
  onPointerDown: (index: number) => void;
  onPointerMove: (index: number) => void;
  onToggleLock: (index: number) => void;
}

interface InteractiveSeriesPoint {
  ariaLabel: string;
}

export function BriefMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-2">
      <div className="truncate text-[10px] font-medium text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}

export function KpiCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "amber" | "blue" | "emerald" | "violet";
  value: string;
}) {
  const toneClasses = {
    amber: "text-amber-700 dark:text-amber-300",
    blue: "text-sky-700 dark:text-sky-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    violet: "text-violet-700 dark:text-violet-300",
  };

  return (
    <div className="min-w-0 rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-neutral-400">
        <Icon className={`h-4 w-4 shrink-0 ${toneClasses[tone]}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-xl font-semibold tabular-nums text-slate-950 dark:text-neutral-50">
        {value}
      </div>
      <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-neutral-400">
        {detail}
      </div>
    </div>
  );
}

export function ChartCard({
  caption,
  children,
  detail,
  icon: Icon,
  title,
}: {
  caption: string;
  children: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700 dark:text-neutral-200">
          <Icon className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </div>
        <span className="truncate text-[11px] text-slate-400 dark:text-neutral-500">
          {caption}
        </span>
      </div>
      {children}
      {detail ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function handleSeriesPointerMove(
  event: ReactPointerEvent<HTMLElement>,
  index: number,
  handlers: ChartInteractionHandlers | undefined,
) {
  if (event.buttons === 1) {
    handlers?.onPointerMove(index);
  } else {
    handlers?.onHover(index);
  }
}

function SeriesHitTargets({
  handlers,
  points,
}: {
  handlers?: ChartInteractionHandlers;
  points: InteractiveSeriesPoint[];
}) {
  if (!handlers || points.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute inset-0 grid h-full w-full"
      style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
    >
      {points.map((point, index) => (
        <button
          key={`${point.ariaLabel}-${index}`}
          type="button"
          aria-label={point.ariaLabel}
          className="h-full w-full cursor-pointer bg-transparent p-0 focus:outline-none"
          onBlur={handlers.onBlur}
          onClick={() => handlers.onToggleLock(index)}
          onFocus={() => handlers.onHover(index)}
          onMouseEnter={() => handlers.onHover(index)}
          onMouseLeave={handlers.onLeave}
          onPointerDown={() => handlers.onPointerDown(index)}
          onPointerMove={(event) => handleSeriesPointerMove(event, index, handlers)}
        />
      ))}
    </div>
  );
}

export function BarSeries({
  interaction,
  pointLabels,
  toneClassName,
  values,
}: {
  interaction?: ChartInteractionHandlers;
  pointLabels?: string[];
  toneClassName: string;
  values: Array<number | null>;
}) {
  const maxValue = Math.max(...values.flatMap((value) => value === null ? [] : [value]), 1);

  return (
    <div className="relative h-16">
      <div className="flex h-16 items-end gap-1 overflow-hidden">
        {values.map((value, index) => {
          const isActive = interaction?.activeIndex === index;
          const numericValue = value ?? 0;
          return (
            <span
              key={`${index}-${value ?? "unknown"}`}
              className={`min-w-1 flex-1 rounded-t-sm transition-all ${value === null ? "border border-dashed border-slate-400 bg-slate-100 dark:border-neutral-600 dark:bg-neutral-900" : numericValue > 0 ? toneClassName : "bg-slate-200 dark:bg-neutral-800"} ${isActive ? "opacity-100 ring-2 ring-slate-400/70 ring-offset-1 ring-offset-white dark:ring-neutral-500 dark:ring-offset-black" : "opacity-80"}`}
              style={{ height: `${value === null ? 8 : Math.max(8, (numericValue / maxValue) * 100)}%` }}
            />
          );
        })}
      </div>
      <SeriesHitTargets
        handlers={interaction}
        points={values.map((value, index) => ({
          ariaLabel:
            pointLabels?.[index] ??
            (value === null ? `${index + 1}번째 값 미확인` : `${index + 1}번째 값 ${value.toLocaleString("ko-KR")}`),
        }))}
      />
    </div>
  );
}

export function WeightLine({
  interaction,
  pointLabels,
  values,
}: {
  interaction?: ChartInteractionHandlers;
  pointLabels?: string[];
  values: number[];
}) {
  if (values.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
        체중 추세 데이터 부족
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const circles = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 56 - ((value - min) / range) * 48;

    return { x, y };
  });
  const points = circles.map((circle) => `${circle.x},${circle.y}`).join(" ");

  return (
    <div className="relative h-16">
      <svg
        className="h-16 w-full overflow-visible"
        viewBox="0 0 100 64"
        preserveAspectRatio="none"
        role="img"
        aria-label="체중 변화 추세"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-violet-600 dark:text-violet-300"
          vectorEffect="non-scaling-stroke"
        />
        {circles.map((circle, index) => {
          const isActive = interaction?.activeIndex === index;

          return (
            <circle
              key={`${circle.x}-${circle.y}-${index}`}
              cx={circle.x}
              cy={circle.y}
              r={isActive ? 3.4 : 2.2}
              className={
                isActive
                  ? "fill-violet-700 dark:fill-violet-200"
                  : "fill-violet-500 dark:fill-violet-300"
              }
            />
          );
        })}
      </svg>
      <SeriesHitTargets
        handlers={interaction}
        points={values.map((value, index) => ({
          ariaLabel:
            pointLabels?.[index] ??
            `${index + 1}번째 체중 ${value.toLocaleString("ko-KR")} kg`,
        }))}
      />
    </div>
  );
}
