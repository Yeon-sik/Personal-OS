import type {
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  KnowledgeDocumentType,
} from "../../types";

// Presentation labels keep persisted project and workstream enum values intact.
export const MILESTONE_STATUS_LABELS: Record<DevMilestoneStatus, string> = {
  PLANNED: "예정",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
};

export const ACTION_TYPE_LABELS: Record<DevActionType, string> = {
  NEXT: "다음 작업",
  LATER: "나중에",
  BLOCKED: "차단됨",
};

export const ACTION_STATUS_LABELS: Record<DevActionStatus, string> = {
  OPEN: "미완료",
  DONE: "완료",
};

export const HISTORY_TYPE_LABELS: Record<DevHistoryType, string> = {
  STATUS_CHANGE: "상태 변경",
  MILESTONE: "마일스톤",
  RELEASE: "출시",
  NOTE: "메모",
};

export const KNOWLEDGE_DOCUMENT_TYPE_LABELS: Record<KnowledgeDocumentType, string> = {
  IDEA: "아이디어",
  PLAN: "계획",
  DESIGN: "설계",
  RESEARCH: "조사",
  NOTE: "메모",
};
