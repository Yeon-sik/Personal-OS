# Sync library maintenance notes

This directory owns the local-first/Supabase synchronization boundary.

Keep these contracts:

- `merge.ts` is the canonical LWW/tombstone rule.
- A tombstone wins when timestamps are equal.
- Supabase rows are soft-deleted; hard DELETE Realtime events are ignored.
- Row mappers own snake_case/camelCase conversion and legacy/null normalization.
- Pull, push, Realtime, presence, and finance queries stay behind `SyncClient`.
- After local snapshot hydration, pull/push/Realtime failure must not disable local editing or local persistence.
- Restore local rows before Auth/network initialization; authentication failure must not erase them.
- Never place a service-role or secret key in the client runtime.

## Incremental sync

- The existing local snapshot envelope also persists `syncState`: backend/user scope, monotonic local revisions, pending row keys and the read cursor. Rows and retry metadata are one atomic localStorage write.
- `trackLocalChanges` queues only changed Personal OS rows owned by the current device. Legacy caches without metadata seed those owned rows once; Fitness projections/archives are never uploaded.
- Push writes the device first and then pending rows in parent-before-child order. A write chunk contains at most 200 rows to bound the ID-filter confirmation URL.
- Every successful chunk reads just its IDs back with the same `user_id` filter. This handles the existing server LWW guard silently rejecting an older/equal update. Confirmed server rows reconcile locally; acknowledgments remove only the exact sent revision.
- Partial success is saved even if a later chunk fails. Timeouts/unconfirmed writes retain pending keys for idempotent retry. New edits during upload or local checkpoint saving keep their newer revisions.
- Local saves share a queue. Install a pull cursor/acknowledgment only after its merged snapshot is saved; rebase again if another edit arrived while the adapter was saving.
- With an initialized cursor, a successful push also checks the incremental feed. This retains post-write source refresh timing: nutrition/view changes are read only for affected dates. A failed follow-up read does not discard confirmed write acknowledgments.
- Realtime remains an LWW row merge. It does not acknowledge pending writes, advance/roll back a read cursor, or replace unrelated source views from an older cache.

### Read cursor migration

`supabase/migrations/20261005090000_personal_os_incremental_sync.sql` adds the cursor/feed RPCs. It changes no existing LWW, producer write permissions, ownership FKs or domain tables.

- A per-user state-row lock serializes revisions until transaction commit. A committed watermark cannot skip an earlier uncommitted revision; client `updated_at` and an independent SQL sequence cannot provide that guarantee.
- The feed stores only the latest `(user, source, row key)` revision, including soft-delete rows. Storage grows with record keys and nutrition dates rather than every edit.
- Private metadata tables/functions have no client grants. Only authenticated cursor/page RPCs are exposed, scoped by `auth.uid()`.
- Delta pages use a fixed upper watermark, at most 500 keys, and bigint strings. Changed table rows are fetched in groups of 200 keys. Rows updated past the watermark are replayed on the next pull.
- Initial/explicit recovery captures the cursor **before** the full scan. Changes during that scan are replayed. Any failed source read keeps the previous cursor; failed initial source reads leave it unset.
- `meal_records` changes invalidate old/new Fitness summary dates. Only those dates are re-read from `fitness_nutrition_summary_v1`; empty dates remove cached summaries. No raw meal detail is copied into the feed or downloaded by this path.
- Missing RPCs fall back to the established full pull, with a migration-needed status. Delta push and targeted server confirmation work without the migration. `{ full: true }` on `SyncClient.pull` retains explicit full recovery.

### Verification and limits

Run `npm run typecheck`, `npm test`, and `npm run build`. `deltaSync.test.ts` exercises transport payloads/failures, `useLocalSyncMemo.test.tsx` covers durable runtime checkpoints, and `changeFeedMigration.test.ts` executes the actual migration and existing LWW function in an isolated PGlite PostgreSQL database.

For one modified note among 1,000 already synchronized notes, the transport regression compares the old full upload plus authoritative pull with delta upload, ID confirmation and the post-write incremental refresh:

| Metric | Previous | Delta |
| --- | ---: | ---: |
| Snapshot/RPC requests | 22 | 5 |
| Uploaded note rows | 1,000 | 1 |
| Uploaded rows including device | 1,001 | 2 |

These counts exclude Auth initialization, background presence/heartbeat and separately scoped finance reads. Write plus confirmation alone uses 3 requests. Without the migration, that path remains available; source refreshes require a manual/reconnect/full pull. Initial synchronization/recovery still performs full reads. Local persistence still serializes the full envelope.

PGlite tests cover SQL permissions, LWW, tombstones, rollback, coalescing, page boundaries and account isolation. Its single connection does not prove multi-session row-lock ordering, live PostgREST/RLS behavior or two running Windows devices. Remote migration application is a separate operation. Hard deletes remain outside the existing tombstone contract; a missing changed record fails closed and does not advance the cursor.

Current references:

- `docs/adr/2026-08-01-current-architecture.md`
- `supabase/README.codex.md`
- GitHub issue #27 for live RLS, Realtime, and cross-device verification
- GitHub issue #31 for local snapshot preservation when Auth initialization throws
