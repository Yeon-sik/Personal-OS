import { describe, expect, it } from "vitest";
import {
  mergeAuthoritativeSnapshot,
  mergeSnapshot,
} from "./snapshotMerge";
import {
  makeDevice,
  makeNote,
  makeProject,
  makeProjectHistory,
  makeSnapshot,
} from "./testFixtures";

describe("Supabase snapshot merge", () => {
  it("removes a prior nutrition date when the full v1 projection no longer returns it", () => {
    const deletedDateSummary = {
      id: "2026-08-01",
      date: "2026-08-01",
      contractVersion: 1 as const,
      mealCount: 1,
      calories: 500,
      carbsGrams: 40,
      proteinGrams: 30,
      fatGrams: 10,
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    const local = makeSnapshot({ fitnessNutritionSummaries: [deletedDateSummary] });
    const afterFullPull = makeSnapshot({ fitnessNutritionSummaries: [] });

    expect(mergeSnapshot(local, afterFullPull).fitnessNutritionSummaries).toEqual([]);
    expect(mergeAuthoritativeSnapshot(local, afterFullPull).fitnessNutritionSummaries).toEqual([]);
  });
  it("uses the canonical LWW rule for each snapshot collection", () => {
    const local = makeSnapshot({
      notes: [
        makeNote({
          content: "new local",
          updatedAt: "2026-08-01T00:00:02.000Z",
        }),
      ],
    });
    const incoming = makeSnapshot({
      notes: [
        makeNote({
          content: "old remote",
          updatedAt: "2026-08-01T00:00:01.000Z",
        }),
      ],
    });

    expect(mergeSnapshot(local, incoming).notes[0].content).toBe("new local");
  });

  it("prefers an equal-timestamp tombstone", () => {
    const updatedAt = "2026-08-01T00:00:02.000Z";
    const local = makeSnapshot({
      notes: [makeNote({ updatedAt, deletedAt: null })],
    });
    const incoming = makeSnapshot({
      notes: [makeNote({ updatedAt, deletedAt: updatedAt })],
    });

    expect(mergeSnapshot(local, incoming).notes[0].deletedAt).toBe(updatedAt);
  });

  it("keeps the general equal-time active LWW rule unchanged", () => {
    const updatedAt = "2026-08-01T00:00:02.000Z";
    const local = makeSnapshot({
      notes: [makeNote({ content: "local", updatedAt })],
    });
    const incoming = makeSnapshot({
      notes: [makeNote({ content: "server", updatedAt })],
    });

    expect(mergeSnapshot(local, incoming).notes[0].content).toBe("local");
  });

  it("uses the server value only for equal-time authoritative reconciliation", () => {
    const equalUpdatedAt = "2026-08-01T00:00:02.000Z";
    const local = makeSnapshot({
      notes: [
        makeNote({ content: "local", updatedAt: equalUpdatedAt }),
        makeNote({ id: "local-only", content: "keep me" }),
      ],
    });
    const incoming = makeSnapshot({
      notes: [makeNote({ content: "server", updatedAt: equalUpdatedAt })],
    });

    const reconciled = mergeAuthoritativeSnapshot(local, incoming);

    expect(reconciled.notes.find((note) => note.id === "note-1")?.content).toBe(
      "server",
    );
    expect(reconciled.notes.find((note) => note.id === "local-only")?.content).toBe(
      "keep me",
    );
  });

  it("preserves a newer local edit during authoritative reconciliation", () => {
    const local = makeSnapshot({
      notes: [
        makeNote({
          content: "latest local",
          updatedAt: "2026-08-01T00:00:03.000Z",
        }),
      ],
    });
    const incoming = makeSnapshot({
      notes: [
        makeNote({
          content: "server",
          updatedAt: "2026-08-01T00:00:02.000Z",
        }),
      ],
    });

    expect(
      mergeAuthoritativeSnapshot(local, incoming).notes[0].content,
    ).toBe("latest local");
  });

  it("does not resurrect an equal-time local tombstone", () => {
    const updatedAt = "2026-08-01T00:00:02.000Z";
    const local = makeSnapshot({
      notes: [makeNote({ updatedAt, deletedAt: updatedAt })],
    });
    const incoming = makeSnapshot({
      notes: [makeNote({ updatedAt, deletedAt: null })],
    });

    expect(
      mergeAuthoritativeSnapshot(local, incoming).notes[0].deletedAt,
    ).toBe(updatedAt);
  });

  it("merges all Dev Control collections with the same LWW rule", () => {
    const localProject = makeProject({
      updatedAt: "2026-08-01T00:00:02.000Z",
      currentSummary: "local",
    });
    const incomingHistory = makeProjectHistory({
      updatedAt: "2026-08-01T00:00:02.000Z",
      summary: "remote history",
    });
    const local = makeSnapshot({
      projects: [localProject],
      projectHistory: [
        makeProjectHistory({ summary: "local history" }),
      ],
    });
    const incoming = makeSnapshot({
      projects: [
        makeProject({
          updatedAt: "2026-08-01T00:00:01.000Z",
          currentSummary: "stale",
        }),
      ],
      projectHistory: [incomingHistory],
    });

    const merged = mergeSnapshot(local, incoming);
    expect(merged.projects[0].currentSummary).toBe("local");
    expect(merged.projectHistory[0].summary).toBe("remote history");
  });

  it("keeps the latest device heartbeat and sorts devices newest first", () => {
    const local = makeSnapshot({
      devices: [
        makeDevice({ id: "device-a", lastSeenAt: "2026-08-01T00:00:01.000Z" }),
      ],
    });
    const incoming = makeSnapshot({
      devices: [
        makeDevice({ id: "device-a", lastSeenAt: "2026-08-01T00:00:03.000Z" }),
        makeDevice({ id: "device-b", lastSeenAt: "2026-08-01T00:00:02.000Z" }),
      ],
    });

    expect(mergeSnapshot(local, incoming).devices.map((device) => device.id)).toEqual(
      ["device-a", "device-b"],
    );
  });
});
