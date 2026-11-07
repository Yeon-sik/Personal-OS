import { describe, expect, it } from "vitest";
import { initializeSyncState } from "../syncState";
import { pushSnapshotChanges } from "./deltaPush";
import { makeDevice, makeProject, makeProjectAction, makeSnapshot, makeTask } from "./testFixtures";
import type { SnapshotTransport } from "./snapshotIo";
import type { SnapshotTableName } from "./rows";

describe("linked Task sync dependency order", () => {
  it.each([false, true])("writes an offline project action before its linked Task (ensure=%s)", async ensure => {
    const context = { userId: "user-1", device: makeDevice({ id: "device-a" }) };
    const scope = { userId: context.userId, backend: "https://example.supabase.co" };
    const project = makeProject({ deviceId: context.device.id });
    const action = makeProjectAction({ deviceId: context.device.id, projectId: project.id });
    const task = makeTask({ id: "linked-task", deviceId: context.device.id, projectActionId: action.id,
      sourceNamespace: "project", externalKey: action.id, actionOwnerScope: context.userId, origin: "IMPORT" });
    const snapshot = initializeSyncState(makeSnapshot({ projects: [project], projectActions: [action], tasks: [task] }), scope, context.device.id);
    if (ensure) snapshot.syncState!.pending = snapshot.syncState!.pending.map(item => item.collection === "tasks"
      ? { ...item, operation: "ENSURE_ACTION", initialTask: task } : item);
    const rows = new Map<string, Map<string, Record<string, unknown>>>();
    const writes: string[] = [];
    const write = (table: string, input: unknown) => {
      const values = (Array.isArray(input) ? input : [input]) as Record<string, unknown>[];
      for (const row of values) {
        if (table === "tasks" && row.project_action_id && !rows.get("project_actions")?.has(String(row.project_action_id))) {
          throw new Error("project action foreign key is missing");
        }
        const store = rows.get(table) ?? new Map<string, Record<string, unknown>>();
        store.set(String(row.id), row); rows.set(table, store);
      }
      writes.push(table);
    };
    const transport: SnapshotTransport = {
      async upsertRows(table, values) { write(table, values); return { error: null }; },
      async selectRows<Row>(table: SnapshotTableName, _user: string, options?: { ids?: string[]; dates?: string[] }) {
        return { data: [...(rows.get(table)?.values() ?? [])].filter(row => !options?.ids || options.ids.includes(String(row.id))) as Row[], error: null };
      },
      async ensureAction(row) { write("tasks", row); return { data: [row], error: null }; },
    };
    const result = await pushSnapshotChanges(transport, snapshot, context, "2027-01-01T00:00:00Z");
    expect(result.error).toBeNull();
    expect(writes.indexOf("project_actions")).toBeLessThan(writes.indexOf("tasks"));
    expect(result.snapshot.tasks[0]).toMatchObject({ id: task.id, projectActionId: action.id });
    expect(result.acknowledged.some(item => item.collection === "tasks" && item.id === task.id)).toBe(true);
  });
});
