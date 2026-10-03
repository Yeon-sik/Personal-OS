export type AppTab = "home" | "records" | "projects" | "settings";
export type RecordSection = "all" | "memo" | "tasks" | "fitness";

export const APP_TAB_LABELS: Record<AppTab, string> = {
  home: "홈",
  records: "기록",
  projects: "프로젝트",
  settings: "설정",
};

export const RECORD_SECTION_LABELS: Record<RecordSection, string> = {
  all: "전체",
  memo: "메모",
  tasks: "할 일",
  fitness: "건강",
};
