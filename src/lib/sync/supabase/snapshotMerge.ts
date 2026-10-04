import type { LocalDataSnapshot } from "../../../types";
import {
  mergeDevices,
  mergeEntities,
  type MergeableEntity,
} from "../merge";

function mergeAuthoritativeEntities<T extends MergeableEntity>(
  localEntities: T[],
  incomingEntities: T[],
): T[] {
  const byId = new Map(localEntities.map((entity) => [entity.id, entity]));

  for (const incomingEntity of incomingEntities) {
    const currentEntity = byId.get(incomingEntity.id);
    if (!currentEntity) {
      byId.set(incomingEntity.id, incomingEntity);
      continue;
    }

    const currentUpdatedAt = Date.parse(currentEntity.updatedAt);
    const incomingUpdatedAt = Date.parse(incomingEntity.updatedAt);
    if (incomingUpdatedAt > currentUpdatedAt) {
      byId.set(incomingEntity.id, incomingEntity);
      continue;
    }
    if (incomingUpdatedAt < currentUpdatedAt) {
      continue;
    }

    // Equal timestamps normally keep the local active value. During the
    // post-push authoritative pull, the server active value wins instead.
    // Preserve the existing tombstone rule so an equal-time deletion cannot
    // be resurrected by an active server row.
    if (currentEntity.deletedAt !== null && incomingEntity.deletedAt === null) {
      continue;
    }
    byId.set(incomingEntity.id, incomingEntity);
  }

  return Array.from(byId.values());
}

export function mergeSnapshot(
  localSnapshot: LocalDataSnapshot,
  incomingSnapshot: LocalDataSnapshot,
): LocalDataSnapshot {
  return {
    syncState: localSnapshot.syncState,
    // Removed/moved meal dates disappear from the view without a tombstone.
    fitnessNutritionSummaries: incomingSnapshot.fitnessNutritionSummaries ?? localSnapshot.fitnessNutritionSummaries,
    // Full pull replaces this source-owned collection; local legacy archives stay untouched.
    fitnessWeightRecords: incomingSnapshot.fitnessWeightRecords ?? localSnapshot.fitnessWeightRecords,
    fitnessSharedWorkoutRecords: incomingSnapshot.fitnessSharedWorkoutRecords ?? localSnapshot.fitnessSharedWorkoutRecords,
    notes: mergeEntities(localSnapshot.notes, incomingSnapshot.notes),
    tasks: mergeEntities(localSnapshot.tasks, incomingSnapshot.tasks),
    workoutRecords: mergeEntities(
      localSnapshot.workoutRecords,
      incomingSnapshot.workoutRecords,
    ),
    fitnessSummaryProjections: mergeEntities(
      localSnapshot.fitnessSummaryProjections,
      incomingSnapshot.fitnessSummaryProjections,
    ),
    mealRecords: mergeEntities(
      localSnapshot.mealRecords,
      incomingSnapshot.mealRecords,
    ),
    weightRecords: mergeEntities(
      localSnapshot.weightRecords,
      incomingSnapshot.weightRecords,
    ),
    devices: mergeDevices(localSnapshot.devices, incomingSnapshot.devices),
    projects: mergeEntities(localSnapshot.projects, incomingSnapshot.projects),
    projectMilestones: mergeEntities(
      localSnapshot.projectMilestones,
      incomingSnapshot.projectMilestones,
    ),
    projectActions: mergeEntities(
      localSnapshot.projectActions,
      incomingSnapshot.projectActions,
    ),
    projectIdeas: mergeEntities(
      localSnapshot.projectIdeas,
      incomingSnapshot.projectIdeas,
    ),
    projectHistory: mergeEntities(
      localSnapshot.projectHistory,
      incomingSnapshot.projectHistory,
    ),
    workstreams: mergeEntities(
      localSnapshot.workstreams,
      incomingSnapshot.workstreams,
    ),
    workstreamProjects: mergeEntities(
      localSnapshot.workstreamProjects,
      incomingSnapshot.workstreamProjects,
    ),
    workstreamMilestones: mergeEntities(
      localSnapshot.workstreamMilestones,
      incomingSnapshot.workstreamMilestones,
    ),
    workstreamActions: mergeEntities(
      localSnapshot.workstreamActions,
      incomingSnapshot.workstreamActions,
    ),
    workstreamActionProjects: mergeEntities(
      localSnapshot.workstreamActionProjects,
      incomingSnapshot.workstreamActionProjects,
    ),
    workstreamActionDependencies: mergeEntities(
      localSnapshot.workstreamActionDependencies,
      incomingSnapshot.workstreamActionDependencies,
    ),
    knowledgeDocuments: mergeEntities(
      localSnapshot.knowledgeDocuments,
      incomingSnapshot.knowledgeDocuments,
    ),
  };
}

export function mergeAuthoritativeSnapshot(
  localSnapshot: LocalDataSnapshot,
  incomingSnapshot: LocalDataSnapshot,
): LocalDataSnapshot {
  return {
    syncState: localSnapshot.syncState,
    // Removed/moved meal dates disappear from the view without a tombstone.
    fitnessNutritionSummaries: incomingSnapshot.fitnessNutritionSummaries ?? localSnapshot.fitnessNutritionSummaries,
    // Full pull replaces this source-owned collection; local legacy archives stay untouched.
    fitnessWeightRecords: incomingSnapshot.fitnessWeightRecords ?? localSnapshot.fitnessWeightRecords,
    fitnessSharedWorkoutRecords: incomingSnapshot.fitnessSharedWorkoutRecords ?? localSnapshot.fitnessSharedWorkoutRecords,
    notes: mergeAuthoritativeEntities(
      localSnapshot.notes,
      incomingSnapshot.notes,
    ),
    tasks: mergeAuthoritativeEntities(
      localSnapshot.tasks,
      incomingSnapshot.tasks,
    ),
    workoutRecords: mergeAuthoritativeEntities(
      localSnapshot.workoutRecords,
      incomingSnapshot.workoutRecords,
    ),
    fitnessSummaryProjections: mergeAuthoritativeEntities(
      localSnapshot.fitnessSummaryProjections,
      incomingSnapshot.fitnessSummaryProjections,
    ),
    mealRecords: mergeAuthoritativeEntities(
      localSnapshot.mealRecords,
      incomingSnapshot.mealRecords,
    ),
    weightRecords: mergeAuthoritativeEntities(
      localSnapshot.weightRecords,
      incomingSnapshot.weightRecords,
    ),
    devices: mergeDevices(localSnapshot.devices, incomingSnapshot.devices),
    projects: mergeAuthoritativeEntities(
      localSnapshot.projects,
      incomingSnapshot.projects,
    ),
    projectMilestones: mergeAuthoritativeEntities(
      localSnapshot.projectMilestones,
      incomingSnapshot.projectMilestones,
    ),
    projectActions: mergeAuthoritativeEntities(
      localSnapshot.projectActions,
      incomingSnapshot.projectActions,
    ),
    projectIdeas: mergeAuthoritativeEntities(
      localSnapshot.projectIdeas,
      incomingSnapshot.projectIdeas,
    ),
    projectHistory: mergeAuthoritativeEntities(
      localSnapshot.projectHistory,
      incomingSnapshot.projectHistory,
    ),
    workstreams: mergeAuthoritativeEntities(
      localSnapshot.workstreams,
      incomingSnapshot.workstreams,
    ),
    workstreamProjects: mergeAuthoritativeEntities(
      localSnapshot.workstreamProjects,
      incomingSnapshot.workstreamProjects,
    ),
    workstreamMilestones: mergeAuthoritativeEntities(
      localSnapshot.workstreamMilestones,
      incomingSnapshot.workstreamMilestones,
    ),
    workstreamActions: mergeAuthoritativeEntities(
      localSnapshot.workstreamActions,
      incomingSnapshot.workstreamActions,
    ),
    workstreamActionProjects: mergeAuthoritativeEntities(
      localSnapshot.workstreamActionProjects,
      incomingSnapshot.workstreamActionProjects,
    ),
    workstreamActionDependencies: mergeAuthoritativeEntities(
      localSnapshot.workstreamActionDependencies,
      incomingSnapshot.workstreamActionDependencies,
    ),
    knowledgeDocuments: mergeAuthoritativeEntities(
      localSnapshot.knowledgeDocuments,
      incomingSnapshot.knowledgeDocuments,
    ),
  };
}
