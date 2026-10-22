import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { MobileDeleteButton } from "../../../components/MobileDeleteButton";
import type { ChecklistTaskRowProps } from "./ChecklistTaskRow";

export function MobileTaskRow({ task, today, isDragging, isDropTarget, dragOverPlacement, canMoveUp, canMoveDown, onMove, onPointerDown, onDelete, onToggle, onUpdatePlannedDate, onUpdateSchedule, onUpdateText }: ChecklistTaskRowProps) {
  return <article className="mobile-task-row" data-task-row-id={task.id} data-task-drag-state={isDropTarget ? dragOverPlacement : isDragging ? "dragging" : undefined}>
    <div className="mobile-task-main">
      <label className="mobile-check-target"><input type="checkbox" checked={task.isDone} onChange={() => onToggle(task.id)} aria-label={`${task.text || "할 일"} 완료 여부`} /><span className="sr-only">완료</span></label>
      <input className={task.isDone ? "mobile-task-text is-done" : "mobile-task-text"} value={task.text} aria-label="할 일 내용" onChange={(event) => onUpdateText(task.id, event.target.value)} />
    </div>
    <details className="mobile-task-options">
      <summary><span>일정·순서</span><span>{task.plannedDate === today ? "오늘 할 일" : task.dueDate ? `${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}` : "기한 없음"}</span></summary>
      <div className="mobile-task-fields">
        <label>마감일<input type="date" value={task.dueDate ?? ""} aria-label={`${task.text || "할 일"} 마감일`} onChange={(event) => { const date = event.target.value || null; onUpdateSchedule(task.id, date, date ? task.dueTime : null); }} /></label>
        <label>마감 시간<input type="time" value={task.dueTime ?? ""} disabled={!task.dueDate} aria-label={`${task.text || "할 일"} 마감 시간`} onChange={(event) => onUpdateSchedule(task.id, task.dueDate, event.target.value || null)} /></label>
      </div>
      {!task.dueDate ? <p className="mobile-field-hint">마감일을 정하면 시간도 지정할 수 있습니다.</p> : null}
      <button type="button" className="mobile-plan-toggle" aria-pressed={task.plannedDate === today} onClick={() => onUpdatePlannedDate(task.id, task.plannedDate === today ? null : today)}>{task.plannedDate === today ? "오늘 할 일에서 제거" : "오늘 할 일로 지정"}</button>
      <div className="mobile-task-actions">
        <div role="group" aria-label={`${task.text || "할 일"} 순서 이동`}>
          <button type="button" data-reorder-handle="" className="mobile-drag-handle" aria-label={`${task.text || "할 일"} 드래그로 순서 변경`} onPointerDown={(event) => onPointerDown(event, task.id)} onKeyDown={(event) => { if (onMove && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); onMove(event.key === "ArrowUp" ? -1 : 1, event.currentTarget); } }}><GripVertical size={20} aria-hidden="true" /></button>
          {onMove ? <><button type="button" disabled={!canMoveUp} aria-label={`${task.text || "할 일"} 위로 이동`} onClick={(event) => onMove(-1, event.currentTarget)}><ChevronUp size={20} aria-hidden="true" /></button><button type="button" disabled={!canMoveDown} aria-label={`${task.text || "할 일"} 아래로 이동`} onClick={(event) => onMove(1, event.currentTarget)}><ChevronDown size={20} aria-hidden="true" /></button></> : null}
        </div>
        <MobileDeleteButton label="할 일 삭제" itemName={task.text || "할 일"} onDelete={() => onDelete(task.id)} />
      </div>
    </details>
  </article>;
}
