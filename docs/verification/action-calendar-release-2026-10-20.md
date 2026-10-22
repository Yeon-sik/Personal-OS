# Action Calendar v1.1 release integration report

2026-10-20, Asia/Seoul. **BLOCKED — main 병합하지 않음.**

> 후속 운영 보안 작업으로 아래 RLS OFF 7건은 해소됐다. 현재 정책·검증 결과와 남은 실기기 blocker는 [운영 보안 후속 보고서](action-calendar-security-2026-10-20.md)를 따른다. 이 문서의 과거 감사 결과는 당시 기록으로 보존한다.

## 1. Branch / HEAD

- Integration branch: `feat/action-calendar-release-20261020`.
- 최신 원격 main 기준: `0b0153ee01aa1bc37d7645b5bfbd18cdd3e408de`.
- 비교한 원래 feature HEAD: `36d2cca434146d3504673037ba70e38d8eb45f28`.
- 코드 검증 HEAD: `78720f93fb3375eae799806f1ecf673616c1c3b6`. 최종 문서 커밋은 이 코드 위에 추가된다.
- 원래 feature 전체를 merge하지 않았다. main에서 새 브랜치를 만들고 아래 prerequisite와 Action 커밋만 cherry-pick했다. 기존 feature branch는 보존했다.

## 2. 포함한 prerequisite와 이유

| 원본 | Integration 커밋 | 필요한 이유 |
|---|---|---|
| `eb28280` durable incremental sync | `04cd63c` | ENSURE_ACTION의 생성 의도·최초 payload를 영속 대기열에 보존하고, 부분 성공·정확한 revision 확인·진행 중 수정·저장 checkpoint를 처리하는 기반이다. 이 기반 없이 가져오기 생성 의도를 안전하게 재시도할 수 없다. 기존 구현 단위를 이식했고 sync 구조를 새로 재설계하지 않았다 |
| `65375be` Action Calendar | `d2996c5` | Task 확장, 가져오기·후보/확정·출처 검증, 기존 달력 projection과 충돌 검토. main의 기존 달력 레이아웃에 필요한 일정 집계만 접합했다 |
| `c1f8950` notes ownership repair | `0d61293` | 이미 운영에 적용된 후속 migration의 이력을 보존하고, 메모 계정 불일치 때문에 공통 sync가 실패하는 기존 문제의 회귀 테스트를 포함한다 |
| 이번 보완 | `78720f9` | 기존 Task의 오프라인 수정이 migration 시각에 의해 소실되지 않도록 양쪽 버전과 대기열을 보존한다. 향후 소유권 변경의 content revision 불변식도 추가했다 |

durable sync 단위에 포함된 cursor/change-feed RPC는 현재 운영에 미배포다. RPC 누락 시 기존 전체 pull fallback을 유지한다. 운영 DB의 누락 migration을 일괄 적용하지 않았다. PGlite 의존성은 실제 PostgreSQL migration/LWW/RLS 회귀 실행에 필요하다. Android 빌드 스크립트는 기존 Windows 심볼릭 링크 권한 오류에 한해서 검증된 라이브러리를 복사해 패키징하는 재현 도구다.

**제외 확인:** Serena 설정, launcher/icon 이미지, Tauri 아이콘 설정·기능, 테마 아이콘 연동, semantic progress stack, Home 단순화, 일반 달력 범례 변경은 이식하지 않았다. `src-tauri/**`, `src/app/useThemeMode.ts`, `RecordMarkerLegend.tsx`, `.serena/**`는 main 대비 변경이 없다. Home 변경은 candidate 집계 제외에 한정한다.

## 3. 수정 파일

main 대비 66개 파일(이 보고서 포함)이다. 핵심 변경은 아래와 같다.

- 일정 모델·가져오기·출처·충돌: `src/features/actions/*`, `src/types/action.ts`, Task 타입.
- 기존 UI 접합: App/runtime, Task row, Records/calendar projection, candidate를 제외하는 Home/activity.
- sync prerequisite 및 보완: 저장 adapter, syncState/reconciliation, delta push, Supabase transport/mappers.
- DB: 원래 Action migration과 notes repair를 바이트 내용 변경 없이 보존. 새 guard migration만 추가.
- 검증·문서·빌드 재현: 관련 테스트, 설계 문서, 기존 Action 예시 화면과 Android 빌드 스크립트. 기존 화면 이미지는 과거 브라우저 예시이며 이번 release 실기기 검증 증거가 아니다.

전체 경로:

```text
artifacts/action-calendar/mobile-detail.png
artifacts/action-calendar/ui-audit.json
artifacts/action-calendar/windows-detail.png
docs/specs/action-calendar-v1.1.md
docs/verification/action-calendar-release-2026-10-20.md
package-lock.json
package.json
scripts/build-android-arm64.ps1
src/app/App.tsx
src/app/sync/useMemoSyncRuntime.ts
src/app/useLocalSyncMemo.test.tsx
src/app/useLocalSyncMemo.ts
src/features/actions/ActionDetailDialog.tsx
src/features/actions/ActionDialog.tsx
src/features/actions/ActionImportDialog.tsx
src/features/actions/ActionSummary.tsx
src/features/actions/actionCalendar.ts
src/features/actions/actionExample.ts
src/features/actions/actionIdentity.ts
src/features/actions/actionImport.test.ts
src/features/actions/actionImport.ts
src/features/actions/actionMigration.test.ts
src/features/actions/actionModel.ts
src/features/actions/actionSync.test.ts
src/features/actions/actionTime.ts
src/features/actions/taskOwnershipRelease.test.ts
src/features/actions/useActionActions.test.tsx
src/features/actions/useActionActions.ts
src/features/home/HomePanel.test.tsx
src/features/home/HomePanel.tsx
src/features/home/activity.test.ts
src/features/home/activity.ts
src/features/records/RecordCalendar.tsx
src/features/records/RecordsPanel.test.tsx
src/features/records/RecordsPanel.tsx
src/features/records/components/SelectedDateRecords.tsx
src/features/records/recordAggregation.test.ts
src/features/records/recordAggregation.ts
src/features/tasks/components/ChecklistTaskRow.tsx
src/features/tasks/taskService.ts
src/lib/storage/localStorageAdapter.test.ts
src/lib/storage/localStorageAdapter.ts
src/lib/sync/README.codex.md
src/lib/sync/supabase/actionFields.ts
src/lib/sync/supabase/changeFeed.ts
src/lib/sync/supabase/changeFeedMigration.test.ts
src/lib/sync/supabase/deltaPush.ts
src/lib/sync/supabase/deltaSync.test.ts
src/lib/sync/supabase/legacyNoteOwnership.test.ts
src/lib/sync/supabase/mappers.test.ts
src/lib/sync/supabase/mappers.ts
src/lib/sync/supabase/rows.ts
src/lib/sync/supabase/snapshotIo.ts
src/lib/sync/supabase/snapshotMerge.ts
src/lib/sync/supabaseSyncClient.test.ts
src/lib/sync/supabaseSyncClient.ts
src/lib/sync/syncReconciliation.ts
src/lib/sync/syncState.test.ts
src/lib/sync/syncState.ts
src/lib/sync/syncTypes.ts
src/types/action.ts
src/types/entities.ts
supabase/migrations/20261005090000_personal_os_incremental_sync.sql
supabase/migrations/20261018133855_action_calendar_v1_1.sql
supabase/migrations/20261018141855_repair_legacy_note_ownership.sql
supabase/migrations/20261019161235_guard_task_ownership_content_revision.sql
```

## 4. 발견한 문제와 수정

### 소유권 이전이 오프라인 수정을 새 서버 버전보다 오래된 것으로 만드는 문제

기존 `20261018133855_action_calendar_v1_1.sql`은 소유자를 바꾸면서 `updated_at=greatest(clock_timestamp(),updated_at+1 microsecond)`를 적용한다.

실제 로컬 PostgreSQL에서 원래 LWW 함수와 원래 migration SQL을 그대로 실행했다.

1. 서버 원본의 content revision은 T0다.
2. 다른 기기에 T0보다 새로운 T1 수정이 아직 전송되지 않았다.
3. ownership migration은 내용은 그대로 두고 서버 시각을 T2로 올린다(T2 > T1).
4. 기기가 T1 수정을 전송하면 LWW trigger가 이를 거절한다.
5. 과거의 timestamp-only acknowledgment/reconciliation을 적용하면 서버 원본이 남고 로컬 수정과 대기열이 사라진다.

**판정:** 손실 가능한 경로를 재현했다. 이것이 실제 과거 사용자 데이터에 발생했는지는 **historical loss unverifiable**다. migration 이전 payload와 각 기기의 전송·ack 증거가 없어 내용·시각을 추정 복원하지 않았다.

### 아직 대기 중인 Task 수정에 대한 보완

- 일반 Task push에서도 실제 서버 확정 Task를 reconciliation에 넘긴다.
- 같은 내용이면 정확한 revision을 확인하고 대기열을 해제한다.
- 내용이 다르면 오프라인 Task와 서버 Task를 기존 `conflictTask`에 함께 보존한다. 재시작 후에도 유지하며 자동 재전송을 막고 기존 검토 화면으로 보낸다.
- 업로드 중 새 수정이 생긴 경우 그 새 revision을 해제하지 않는다.
- 서버 버전을 고르는 것은 명시적인 선택이다. 로컬 삭제를 고르면 tombstone을 유지한다. 기존 resolver의 `deletedAt=null` 강제 복원을 제거하고 버튼도 ‘내 삭제 유지’로 구분했다.
- 이 보완은 Task 충돌 처리에 한정된다. notes 등 다른 collection의 기존 LWW 동작은 유지한다.

### 향후 ownership invariant

[후속 migration](../../supabase/migrations/20261019161235_guard_task_ownership_content_revision.sql)은 user_id가 바뀌는 UPDATE에서 **user_id 이외의 모든 필드가 같아야 한다**는 AFTER trigger를 추가한다. content revision timestamp를 포함한 필드가 함께 바뀌면 트랜잭션을 거부한다. 기존 API의 owner 불변 guard와 RLS는 유지한다.

이 guard는 32개 기존 Task를 수정하거나 과거 시각을 되돌리지 않는다. 익명·authenticated 역할에 guard 함수 실행 권한을 부여하지 않는다. privileged maintenance가 기존 LWW/owner guard만 임시 비활성화한 경우에도 새 invariant가 검사되는 것을 로컬 PostgreSQL에서 확인했다. 모든 trigger를 끄는 관리 작업까지 보호한다는 의미는 아니다.

### main 접합

두 달력 파일에 원래 feature의 semantic progress UI 의존성이 있었다. 기존 main의 색상/건강 마커·완료 표현은 유지하고, Action projection의 confirmed/candidate 집계만 접합했다. 날짜 상세와 월간 마커는 같은 Action 날짜를 사용한다. 생성일~마감일 전체를 표시하던 옛 테스트 2개는 이 명시된 projection 계약으로 수정했다. 무관한 progress stack 구조는 추가하지 않았다.

## 5. 실행한 검증

| 검증 | 실제 결과 |
|---|---|
| 전체 Vitest | **PASS: 48 files / 287 tests**. `npm.cmd test -- --reporter=dot`. 후속 파일명을 운영 history 버전에 맞춘 최종 소스에서도 재실행 |
| TypeScript | **PASS**, `npm.cmd run typecheck` |
| Production web build | **PASS**, `npm.cmd run build`. 500 kB 초과 기존 chunk 경고 있음 |
| Action import/migration/sync + Task/Records/Home + delta/notes | **PASS: 14 files / 97 tests**, 보완 직후 targeted 실행 |
| ownership regression | **PASS: PostgreSQL 6개 시나리오**. 과거 손실 재현, 새 클라이언트의 양쪽 버전 보존·재시작, 삭제와 진행 중 수정 보존, timestamp invariant, 계정 경계, 두 클라이언트 모델의 전체 수명주기 |
| 사용자 삭제 선택 | **PASS**, 기존 hook 회귀에 ordinary Task tombstone 유지 검증 추가 |
| Windows build | **PASS**, Tauri release EXE와 NSIS 생성. 기존 main 아이콘/런처 그대로 |
| Android build | **PASS**, ARM64 debug APK, Gradle `BUILD SUCCESSFUL`, APK 내부 native library 해시 검증 |
| 기존 migration history | **PASS**, 원래 feature의 두 적용 migration과 `git diff --exit-code` 일치 |
| Scope | **PASS**, 제외 경로의 main 대비 diff 0, feature 전체 merge 없음 |

Windows build log: `action-release-windows-build.log`, Android: `action-release-android-build.log`(로컬 ignored 증거). native 작업 성공 후 통합 실행 wrapper에 conhost만 남아 종료되지 않아 compiler/packager 자식이 없음을 확인하고 wrapper를 중지했다(통합 wrapper exit -1). 개별 build 성공 로그·완료 표식·산출물 해시와 구분해 기록한다.

| 산출물 | SHA-256 |
|---|---|
| Windows EXE | `F60C9375CEFE2E7376DFF91778E89F11AAD22C77B2606376E2B31EEB602BAF08` |
| Windows NSIS | `4F7B678A5043067FAC4B5C8307D5A4357F07E475BDD89AB2FE9B428931AF64B5` |
| Android ARM64 debug APK | `9646579EEB91EA02C467D2E561750EE4CBE237D2846A295FF9A0BB99204B7389` |

## 6. Production DB / real device

### 운영 권한 점검

S/I/U/D는 SELECT/INSERT/UPDATE/DELETE grant다. 아래 값은 실제 운영 catalog와 role 조회 기준이며, anon 쓰기·삭제를 실제 데이터에 실행하지 않았다.

| 테이블 | RLS | anon | authenticated | 판정 |
|---|---|---|---|---|
| tasks | ON | 없음 | S/I/U | 본인 SELECT/INSERT/UPDATE 정책 3개. unrelated subject 조회 0행. hard DELETE 차단 |
| notes | OFF | S/I/U/D | S/I/U/D | 기존 보안 blocker |
| devices | OFF | S/I/U/D | S/I/U/D | 기존 공유 인프라 blocker |
| workout_records | OFF | S/I/U/D | S/I/U/D | 기존 Fitness 공유 DB blocker |
| workout_exercises | OFF | S/I/U/D | S/I/U/D | 기존 Fitness 공유 DB blocker |
| workout_sets | OFF | S/I/U/D | S/I/U/D | 기존 Fitness 공유 DB blocker |
| meal_records | OFF | S/I/U/D | S/I/U/D | 기존 Fitness 공유 DB blocker |
| weight_records | OFF | S/I/U/D | S/I/U/D | 기존 Fitness 공유 DB blocker |

anon 역할로 실제 조회된 행 수: notes 23, devices 20, workout_records 538, workout_exercises 2183, workout_sets 7432, meal_records 73, weight_records 52. 내용은 출력하지 않았다. authenticated 역할도 이 7개 테이블 전체를 볼 수 있었다. 이는 앱의 user_id filter만으로 보안 격리를 보장할 수 없다는 뜻이다. [Supabase RLS 점검 기준](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

이 취약점은 Action Calendar가 새로 만든 것이 아니라 기존 공유 DB의 별도 보안 작업이다. 그러나 현재 환경으로 release하는 데는 blocker다. tasks는 이미 제한되어 추가 RLS 변경이 필요 없다. notes/devices와 Fitness 테이블은 기존 생산자의 Auth/legacy access 및 FK 계약을 확인해야 하므로 이번 범위에서 즉시 일괄 수정 가능하다고 판정하지 않았다. RLS·GRANT를 임의 변경하지 않았다.

### 운영 후속 guard 적용

- 적용 이력: `20261019161235 / guard_task_ownership_content_revision`.
- trigger 활성 `O`, anon/authenticated guard 함수 EXECUTE 모두 false.
- 적용 전후 Task **32행**, tombstone **25행** 동일.
- 모든 Task 필드 집계 해시 전후 동일: `8c9ccd2fc462102ba6c6c61f6e9cc3ec`.
- 원래 Action/notes migration 이력 유지. 과거 내용·시각 복원 없음.
- 보안 advisor 재확인: 기존 RLS OFF 7건 계속 존재. 권고용 SECURITY DEFINER 경고 등 기존 공유 DB 지적도 유지되며, 이번 guard는 SECURITY INVOKER와 빈 search_path를 사용한다.

### 실제 두 기기 흐름

Galaxy A25가 ADB에 연결된 사실은 확인했다. 설치 앱의 인증된 UI를 Windows·Android 양쪽에서 함께 조작하는 경로가 없어 다음 실제 흐름은 실행하지 않았다. 로컬 PostgreSQL의 두 클라이언트 모델 테스트와 혼동하지 않는다.

| 실제 단계 | 결과 |
|---|---|
| Windows Action 생성 | UNVERIFIED |
| Android 수신 | UNVERIFIED |
| Android 수정 | UNVERIFIED |
| Windows 수정 수신 | UNVERIFIED |
| 삭제 및 다른 기기 수신 | UNVERIFIED |
| 재동기화 | UNVERIFIED |
| 동일 external identity 재가져오기 | UNVERIFIED |
| 실제 두 기기에서 사용자 수정·삭제 자동 덮어쓰기 방지 | UNVERIFIED |

이번에 새 APK를 설치하거나 기기 데이터를 초기화하지 않았다.

## 7. UNVERIFIED와 운영 순서

- 실제 Windows↔Android의 위 8단계.
- 실제 앱 세션의 signed HTTP JWT·Realtime 왕복. SQL의 authenticated role 검증은 이를 대체하지 않는다.
- 과거의 실제 미전송 Task 손실 및 복구 가능성: **historical loss unverifiable**.
- 구버전 기기는 아직 과거 acknowledgment 코드를 사용할 수 있다. 모든 참여 기기의 로컬 v1/v2 데이터를 보존한 상태에서 앱을 갱신하고, pending 충돌을 검토해야 한다. 앱 삭제·저장 공간 초기화는 복구 절차가 아니다.
- 운영 증분 sync RPC는 미배포이며 full pull fallback을 사용한다. 이번에 공유 DB의 미적용 migration을 일괄 실행하지 않았다.
- 기존 Action migration을 아직 적용하지 않은 legacy DB에서는 그 migration을 먼저 실행하면 동일 위험이 생긴다. 적용 전 명시적 소유자 매핑과 timestamp-preserving 이전을 검토하는 preflight가 필요하다. 적용된 historical SQL을 편집하거나 재실행해 해결하지 않는다.
- 오래된 snapshot/기기 백업이 실제로 확보되면 ID별로 원본과 pending을 대조할 수 있다. 현재 증거 없이 서버 시각을 낮추거나 본문을 추정하지 않는다.

## 8. 최종 판정

**BLOCKED. main 병합 없음.**

해제 조건:

1. 기존 공유 DB 7개 테이블의 소유 앱·인증·권한 계약을 확정하고, 별도 보안 변경으로 RLS/GRANT 및 계정 격리를 검증한다.
2. 같은 Supabase 계정의 실제 Windows/Android에서 위 전체 흐름을 실행하고 수정·삭제·재가져오기 보존을 확인한다.
3. 참여 기기의 이전 버전·미전송 데이터 보존과 갱신 순서를 확인한다.

새 기능이나 대규모 refactor를 추가하지 않았다. Reminder, GPT/MCP 직접 등록, Source Monitor/Radar, 외부 캘린더 연동은 포함하지 않았다.
