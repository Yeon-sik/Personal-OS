import { describe, expect, it } from "vitest";
import { ACTION_DEFAULTS } from "../../../features/actions/actionModel";
import {
  deviceFromRow,
  deviceToRow,
  projectActionFromRow,
  projectActionToRow,
  projectFromRow,
  projectHistoryFromRow,
  projectHistoryToRow,
  projectIdeaFromRow,
  projectIdeaToRow,
  projectMilestoneFromRow,
  projectMilestoneToRow,
  projectToRow,
  mealRecordFromRow,
  mealRecordToRow,
  noteFromRow,
  noteToRow,
  taskFromRow,
  taskToRow,
  weightRecordFromRow,
  weightRecordToRow,
  workoutRecordFromRow,
  workoutRecordToRow,
  workstreamActionDependencyFromRow,
  workstreamActionDependencyToRow,
  workstreamActionFromRow,
  workstreamActionProjectFromRow,
  workstreamActionProjectToRow,
  workstreamActionToRow,
  workstreamFromRow,
  workstreamMilestoneFromRow,
  workstreamMilestoneToRow,
  workstreamProjectFromRow,
  workstreamProjectToRow,
  workstreamToRow,
} from "./mappers";
import type { TaskRow, WorkoutRecordRow } from "./rows";
import {
  makeDevice,
  makeMealRecord,
  makeNote,
  makeProject,
  makeProjectAction,
  makeProjectHistory,
  makeProjectIdea,
  makeProjectMilestone,
  makeTask,
  makeWeightRecord,
  makeWorkoutRecord,
  makeWorkstream,
  makeWorkstreamAction,
  makeWorkstreamActionDependency,
  makeWorkstreamActionProject,
  makeWorkstreamMilestone,
  makeWorkstreamProject,
} from "./testFixtures";

const USER_ID = "user-1";

describe("Supabase row mappers", () => {
  it("round-trips every sync entity and device", () => {
    const note = makeNote();
    const task = makeTask({ dueDate: "2026-08-02", dueTime: "09:30" });
    const workout = makeWorkoutRecord();
    const meal = makeMealRecord();
    const weight = makeWeightRecord();
    const device = makeDevice();
    const project = makeProject();
    const milestone = makeProjectMilestone();
    const action = makeProjectAction();
    const idea = makeProjectIdea();
    const history = makeProjectHistory();
    const workstream = makeWorkstream();
    const workstreamProject = makeWorkstreamProject();
    const workstreamMilestone = makeWorkstreamMilestone();
    const workstreamAction = makeWorkstreamAction();
    const workstreamActionProject = makeWorkstreamActionProject();
    const workstreamActionDependency = makeWorkstreamActionDependency();

    expect(noteFromRow(noteToRow(note, USER_ID))).toEqual(note);
    expect(taskFromRow(taskToRow(task, USER_ID))).toEqual({ ...ACTION_DEFAULTS, ...task, actionOwnerScope: USER_ID });
    expect(workoutRecordFromRow(workoutRecordToRow(workout, USER_ID))).toEqual(
      workout,
    );
    expect(mealRecordFromRow(mealRecordToRow(meal, USER_ID))).toEqual(meal);
    expect(weightRecordFromRow(weightRecordToRow(weight, USER_ID))).toEqual(
      weight,
    );
    expect(deviceFromRow(deviceToRow(device, USER_ID))).toEqual(device);
    expect(projectFromRow(projectToRow(project, USER_ID))).toEqual(project);
    expect(
      projectMilestoneFromRow(projectMilestoneToRow(milestone, USER_ID)),
    ).toEqual(milestone);
    expect(projectActionFromRow(projectActionToRow(action, USER_ID))).toEqual(
      action,
    );
    expect(projectIdeaFromRow(projectIdeaToRow(idea, USER_ID))).toEqual(idea);
    expect(
      projectHistoryFromRow(projectHistoryToRow(history, USER_ID)),
    ).toEqual(history);
    expect(workstreamFromRow(workstreamToRow(workstream, USER_ID))).toEqual(
      workstream,
    );
    expect(
      workstreamProjectFromRow(
        workstreamProjectToRow(workstreamProject, USER_ID),
      ),
    ).toEqual(workstreamProject);
    expect(
      workstreamMilestoneFromRow(
        workstreamMilestoneToRow(workstreamMilestone, USER_ID),
      ),
    ).toEqual(workstreamMilestone);
    expect(
      workstreamActionFromRow(workstreamActionToRow(workstreamAction, USER_ID)),
    ).toEqual(workstreamAction);
    expect(
      workstreamActionProjectFromRow(
        workstreamActionProjectToRow(workstreamActionProject, USER_ID),
      ),
    ).toEqual(workstreamActionProject);
    expect(
      workstreamActionDependencyFromRow(
        workstreamActionDependencyToRow(workstreamActionDependency, USER_ID),
      ),
    ).toEqual(workstreamActionDependency);
  });

  it("normalizes missing audit fields and database time precision", () => {
    const row: TaskRow = {
      ...taskToRow(makeTask(), USER_ID),
      created_at: null,
      is_backfilled: true,
      backfilled_at: null,
      backfill_reason: null,
      due_time: "09:30:00",
      planned_date: null,
    };

    expect(taskFromRow(row)).toMatchObject({
      createdAt: row.updated_at,
      isBackfilled: true,
      backfilledAt: row.updated_at,
      backfillReason: null,
      dueTime: "09:30",
      plannedDate: null,
    });
  });

  it("reads pre-identity rows as URL-only Projects without changing legacy fields", () => {
    const row = projectToRow(
      makeProject({
        repository: "https://github.com/octo/repo",
        branch: "develop",
        githubRepositoryId: null,
        githubOwner: null,
        githubRepo: null,
      }),
      USER_ID,
    );
    delete row.github_repository_id;
    delete row.github_owner;
    delete row.github_repo;

    expect(projectFromRow(row)).toMatchObject({
      repository: "https://github.com/octo/repo",
      branch: "develop",
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });
  });

  it("normalizes partial GitHub identity tuples at the sync boundary", () => {
    const partial = makeProject({
      githubRepositoryId: "42",
      githubOwner: "octo",
      githubRepo: null,
    });
    const row = projectToRow(partial, USER_ID);

    expect(row).toMatchObject({
      github_repository_id: null,
      github_owner: null,
      github_repo: null,
    });
    expect(
      projectFromRow({
        ...row,
        github_repository_id: "42",
        github_owner: "octo",
        github_repo: null,
      }),
    ).toMatchObject({
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });
  });

  it("normalizes legacy workout contract values and nullable metrics", () => {
    const row: WorkoutRecordRow = {
      ...workoutRecordToRow(makeWorkoutRecord(), USER_ID),
      workout_type: "legacy-weight-training",
      duration_seconds: null,
      average_heart_rate: null,
      source_app: null,
      scope: null,
      metadata: null,
      contract_version: 99,
    };

    expect(workoutRecordFromRow(row)).toMatchObject({
      workoutType: "strength",
      durationSeconds: null,
      averageHeartRate: null,
      sourceApp: "os",
      scope: "both",
      metadata: {},
      contractVersion: 1,
    });
  });

  it("writes canonical defaults for optional fitness contract fields", () => {
    const meal = makeMealRecord({
      sourceApp: undefined,
      scope: undefined,
      metadata: undefined,
      contractVersion: undefined,
    });
    const weight = makeWeightRecord({
      sourceApp: undefined,
      scope: undefined,
      metadata: undefined,
      contractVersion: undefined,
    });

    expect(mealRecordToRow(meal, USER_ID)).toMatchObject({
      source_app: "os",
      scope: "both",
      metadata: {},
      contract_version: 1,
    });
    expect(weightRecordToRow(weight, USER_ID)).toMatchObject({
      source_app: "os",
      scope: "both",
      metadata: {},
      contract_version: 1,
    });
  });
});
