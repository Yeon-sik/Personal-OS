import type { BackfillInput, Task } from "../../types";
import { createEntityAuditFields } from "../../lib/dataTrust/backfillMetadata";
import { createId } from "../../lib/storage/id";

// UI에는 soft delete 되지 않은 항목만 orderIndex 순서로 보여준다.
export function getVisibleTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => task.deletedAt === null && task.registrationState !== "CANDIDATE")
    .sort((first, second) => {
      if (first.orderIndex !== second.orderIndex) {
        return first.orderIndex - second.orderIndex;
      }

      return first.updatedAt.localeCompare(second.updatedAt);
    });
}

// 새 항목은 현재 보이는 체크리스트의 마지막 순서 뒤에 붙인다.
export function getNextOrderIndex(tasks: Task[]): number {
  const visibleTasks = getVisibleTasks(tasks);

  if (visibleTasks.length === 0) {
    return 0;
  }

  return Math.max(...visibleTasks.map((task) => task.orderIndex)) + 1;
}

// 새 체크리스트 항목은 로컬에서 즉시 만들고 생성 기기를 기록한다.
export function createTask(
  text: string,
  orderIndex: number,
  deviceId: string,
  dueDate: string | null = null,
  dueTime: string | null = null,
  plannedDate: string | null = null,
  backfillInput?: BackfillInput,
): Task {
  const now = new Date().toISOString();
  const auditFields = createEntityAuditFields(backfillInput, now);

  return {
    ...auditFields,
    id: createId(),
    text,
    isDone: false,
    orderIndex,
    dueDate,
    dueTime: dueDate ? dueTime : null,
    plannedDate,
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

// 항목 수정/완료 변경 시 동기화 충돌 기준인 updatedAt을 함께 갱신한다.
export function updateTask(
  task: Task,
  changes: Pick<
    Partial<Task>,
    "text" | "isDone" | "orderIndex" | "dueDate" | "dueTime" | "plannedDate"
  >,
  deviceId: string,
): Task {
  if (task.registrationState === "CANDIDATE" && changes.isDone) return task;
  const evidenceChanged = task.sourceType === "EXTERNAL_NOTICE" &&
    (["text", "dueDate", "dueTime"] as const).some(key => changes[key] !== undefined && changes[key] !== task[key]);
  return {
    ...task,
    ...changes,
    ...(evidenceChanged ? { verificationStatus: "UNVERIFIED" as const, sourceCheckedAt: null, sourceCheckedBy: null } : {}),
    updatedAt: new Date(Math.max(Date.now(), Date.parse(task.updatedAt) + 1)).toISOString(),
    deviceId,
  };
}

// 삭제 상태도 Supabase에 upsert하기 위해 tombstone으로 남긴다.
export function softDeleteTask(task: Task, deviceId: string): Task {
  const now = new Date(Math.max(Date.now(), Date.parse(task.updatedAt) + 1)).toISOString();

  return {
    ...task,
    updatedAt: now,
    deletedAt: now,
    deviceId,
  };
}
