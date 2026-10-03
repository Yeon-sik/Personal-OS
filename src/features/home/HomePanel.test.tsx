import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { HomePanel } from "./HomePanel";
import { getRecordsForDate } from "../records/recordAggregation";
import { emptySnapshot, entity, projection, task } from "./testFixtures";

describe("HomePanel entry points", () => {
  it("opens the existing calendar, task screen, projects and capture", () => {
    const records = vi.fn();
    const projects = vi.fn();
    const capture = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<HomePanel snapshot={emptySnapshot()} syncStatus={{ mode: "local-only", label: "Local only", detail: "", isOnline: false, lastSyncedAt: null, isConfigured: false }} today="2026-10-02" onOpenRecords={records} onOpenProjects={projects} onQuickCapture={capture} />);
    });
    const clickText = (text: string) => {
      const button = renderer.root.findAllByType("button").find((entry) => entry.findAllByType("p").some((paragraph) => paragraph.children.join("") === text));
      expect(button).toBeDefined();
      act(() => button!.props.onClick());
    };

    clickText("기록 달력");
    expect(records).toHaveBeenLastCalledWith("all", "2026-10-02");
    clickText("할 일");
    expect(records).toHaveBeenLastCalledWith("tasks");
    clickText("프로젝트");
    expect(projects).toHaveBeenCalledTimes(1);
    clickText("빠른 입력");
    expect(capture).toHaveBeenCalledTimes(1);

    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain("로컬 저장");
    expect(text).not.toContain("Local only");
    act(() => renderer.unmount());
  });

  it("shows record-only activity before opening its calendar date and excludes deleted tasks from today's summary", () => {
    const snapshot = emptySnapshot();
    snapshot.tasks = [task(), task({ id: "done", isDone: true }), task({ id: "deleted", text: "삭제된 일", deletedAt: "2026-10-02T01:00:00.000Z" })];
    snapshot.fitnessSummaryProjections = [projection()];
    snapshot.notes = [{ ...entity, id: "edited-note", createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-02T12:00:00.000Z", title: "수정된 메모", content: "" }];
    snapshot.weightRecords = [{ ...entity, id: "weight-1", date: "2026-10-01", weightKg: 70 }];
    expect(getRecordsForDate(snapshot, "2026-10-01").notes).toHaveLength(0);
    const records = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<HomePanel snapshot={snapshot} syncStatus={{ mode: "synced", label: "Synced", detail: "", isOnline: true, lastSyncedAt: null, isConfigured: true }} today="2026-10-02" onOpenRecords={records} onOpenProjects={vi.fn()} onQuickCapture={vi.fn()} />);
    });
    const dayButton = renderer.root.findAllByType("button").find((entry) => typeof entry.props["aria-label"] === "string" && entry.props["aria-label"].startsWith("2026년 10월 1일"));
    expect(dayButton).toBeDefined();
    act(() => dayButton!.props.onClick());
    expect(records).not.toHaveBeenCalled();
    act(() => dayButton!.props.onMouseLeave());
    const details = renderer.root.findByProps({ "aria-label": "날짜별 활동 내역" });
    const detailText = details.findAllByType("p").map((paragraph) => paragraph.children.join("")).join(" ");
    expect(detailText).toContain("2026년 10월 1일");
    expect(detailText).toContain("메모 등록 1건");
    expect(detailText).toContain("체중 기록 1건");
    expect(detailText).toContain("기록 달력은 메모의 최근 수정일과 할 일 일정 기준이므로 이 활동 내역과 다르게 표시될 수 있습니다.");
    const destinations = details.findByProps({ "aria-label": "활동 상세 이동" }).findAllByType("button");
    expect(destinations).toHaveLength(1);
    expect(destinations[0].children).toContain("기록 달력 ");
    act(() => destinations[0].props.onClick());
    expect(records).toHaveBeenCalledWith("all", "2026-10-01");
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain("오늘 할 일");
    expect(text).not.toContain("삭제된 일");
    expect(text).toContain("완료 기록 있음");
    expect(renderer.root.findAllByType("div").filter((entry) => entry.props.className?.includes("text-sm font-semibold tabular-nums text-white")).map((entry) => entry.children.join(""))).toEqual(["1개", "1개", "완료 기록 있음", "0개"]);
    act(() => renderer.unmount());
  });

  it("shows project-only activity and opens projects instead of the calendar", () => {
    const snapshot = emptySnapshot();
    snapshot.projects = [{ ...entity, id: "project-1", name: "프로젝트", description: "", repository: null, branch: null, githubRepositoryId: null, githubOwner: null, githubRepo: null, status: "ACTIVE", currentSummary: "", targetSummary: "", lastVerifiedCommit: null, lastVerifiedAt: null }];
    snapshot.projectHistory = [{ ...entity, id: "history-1", projectId: "project-1", type: "NOTE", summary: "기록", occurredAt: "2026-10-01T12:00:00.000Z", githubRef: null }];
    snapshot.knowledgeDocuments = [{ ...entity, id: "doc-1", createdAt: "2026-10-01T12:00:00.000Z", title: "문서", type: "NOTE", projectId: "project-1", workstreamId: null, relativePath: "note.md" }];
    const records = vi.fn();
    const projects = vi.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<HomePanel snapshot={snapshot} syncStatus={{ mode: "local-only", label: "Local only", detail: "", isOnline: false, lastSyncedAt: null, isConfigured: false }} today="2026-10-02" onOpenRecords={records} onOpenProjects={projects} onQuickCapture={vi.fn()} />);
    });
    const dayButton = renderer.root.findAllByType("button").find((entry) => typeof entry.props["aria-label"] === "string" && entry.props["aria-label"].startsWith("2026년 10월 1일"));
    expect(dayButton).toBeDefined();
    act(() => dayButton!.props.onClick());
    expect(records).not.toHaveBeenCalled();
    expect(projects).not.toHaveBeenCalled();
    const details = renderer.root.findByProps({ "aria-label": "날짜별 활동 내역" });
    const detailText = details.findAllByType("p").map((paragraph) => paragraph.children.join("")).join(" ");
    expect(detailText).toContain("프로젝트 이력 1건");
    expect(detailText).toContain("지식 문서 등록 1건");
    const destinations = details.findByProps({ "aria-label": "활동 상세 이동" }).findAllByType("button");
    expect(destinations).toHaveLength(1);
    expect(destinations[0].children).toContain("프로젝트 ");
    act(() => destinations[0].props.onClick());
    expect(projects).toHaveBeenCalledTimes(1);
    expect(records).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it("summarizes only today's planned tasks while preserving wider calendar visibility", () => {
    const snapshot = emptySnapshot();
    snapshot.tasks = [
      task({ id: "today", text: "오늘 계획한 일" }),
      task({ id: "today-done", text: "오늘 계획한 완료 일", isDone: true }),
      task({ id: "tomorrow", text: "내일 계획한 일", plannedDate: "2026-10-03", dueDate: "2026-10-03" }),
      task({ id: "unscheduled", text: "계획 없는 새 일", createdAt: "2026-10-02T00:00:00.000Z", plannedDate: null, dueDate: null }),
      task({ id: "future-due", text: "미래 마감일인 일", createdAt: "2026-09-30T00:00:00.000Z", plannedDate: null, dueDate: "2026-10-05" }),
      task({ id: "done-unscheduled", text: "계획 없는 완료 일", createdAt: "2026-10-02T00:00:00.000Z", plannedDate: null, dueDate: null, isDone: true }),
    ];
    expect(getRecordsForDate(snapshot, "2026-10-02").tasks).toHaveLength(6);
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<HomePanel snapshot={snapshot} syncStatus={{ mode: "local-only", label: "Local only", detail: "", isOnline: false, lastSyncedAt: null, isConfigured: false }} today="2026-10-02" onOpenRecords={vi.fn()} onOpenProjects={vi.fn()} onQuickCapture={vi.fn()} />);
    });

    expect(renderer.root.findAllByType("div").filter((entry) => entry.props.className?.includes("text-sm font-semibold tabular-nums text-white")).map((entry) => entry.children.join(""))).toEqual(["1개", "1개", "기록 없음", "0개"]);
    act(() => renderer.unmount());
  });
});
