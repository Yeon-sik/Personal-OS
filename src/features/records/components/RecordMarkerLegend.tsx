export function MarkerLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400"
      aria-label="달력 표시 범례"
      role="group"
    >
      <MarkerLegendItem
        label="Project"
        className="bg-violet-700 dark:bg-violet-600"
      />
      <MarkerLegendItem
        label="Training"
        className="bg-red-700 dark:bg-red-600"
      />
      <PlanLegendItem />
      <MemoLegendItem />
    </div>
  );
}

function MarkerLegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="inline-flex h-2 w-4 shrink-0 items-center justify-center">
        <span className={`block h-1.5 w-4 rounded-sm ${className}`} />
      </span>
      <span>{label}</span>
    </span>
  );
}

function PlanLegendItem() {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="inline-flex h-2 shrink-0 items-center gap-0.5 text-[9px] font-semibold leading-none">
        <span className="text-teal-700 dark:text-teal-300">✓1/2</span>
        <span className="text-amber-700 dark:text-amber-300">!1</span>
      </span>
      <span>Plan</span>
    </span>
  );
}

function MemoLegendItem() {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="inline-flex h-2 w-4 shrink-0 items-center justify-center">
        <span className="block h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-neutral-300" />
      </span>
      <span>Memo</span>
    </span>
  );
}
