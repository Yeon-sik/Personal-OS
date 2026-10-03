# Fitness Summary Projection v2

Status: additive cross-app read contract. Fitness Record Contract v1 remains
frozen and readable for legacy compatibility.

FitnessApp owns the original workout session, exercise master references, meal
and nutrition data, weight/body-composition data, and all per-set detail.
Personal OS prefers `public.fitness_summary_projections_v2` for shared
workout summaries. Until a v2 projection exists for a completed shared session,
it may display only the category already published in Fitness-owned v1
`workout_records`. It does not infer set counts from v1 rows.

The write boundary is the Fitness-owned
`upsert_fitness_summary_projection_v2(jsonb)` RPC. Personal OS has `SELECT`
permission only and does not include this table in any push payload.

## Allowed fields

```text
source_fitness_session_id
date
completion_status = completed
chest_sets
back_sets
legs_sets
shoulders_sets
abs_sets
triceps_sets
biceps_sets
total_duration_seconds
cardio_duration_seconds
contract_version = 2
```

The table also carries ordinary synchronization audit fields. The projection
does not carry `exercise_id`, exercise name, family/variant, weight, reps,
RPE/RIR, set rows, or exercise metadata.

Personal OS may retain and read existing v1 `workout_records` rows while
older clients converge, but it never creates, edits, deletes, or restores
Fitness canonical records through its ordinary UI or sync push.
