# Action Calendar release 운영 보안 검증 보고서

2026-10-20, Asia/Seoul. **BLOCKED — 실제 앱 동기화 검증 전 main 병합 금지.**

## 1. Branch / HEAD

- Branch: `feat/action-calendar-release-20261020`.
- 요청 baseline: `4fe7ec686a1bc54ec38fb968ccae4c402a655596`.
- 보안·회귀 코드 검증 commit: `3303fbf2470d0181945dfa00296e415c020c7b4c`.
- 최종 HEAD에는 이 보고서의 후속 문서 commit이 추가된다. 최종 응답에서 실제 HEAD와 원격 일치 여부를 별도로 기록한다.
- 기존 Action Calendar 구조, UI, conflict 처리와 runtime TypeScript/Rust는 변경하지 않았다. 기존 migration도 수정하지 않았다.
- 원래 feature 전체 병합, main 병합, 앱 설치·삭제·데이터 초기화는 실행하지 않았다.

## 2. 변경 migration / files

| 파일 | 목적 |
|---|---|
| `supabase/migrations/20261019165450_secure_shared_personal_os_fitness_tables.sql` | 운영에 적용한 7개 테이블 RLS/GRANT 후속 migration |
| `supabase/tests/shared_security_smoke.sql` | 운영 DB에서 실제 역할을 전환해 실행한 rollback 전용 검증 |
| `src/lib/sync/supabase/fixtures/shared-security-baseline.sql` | 운영 catalog의 테이블·FK·trigger·Fitness batch RPC 정의만 캡처. 사용자 데이터·자격 증명 없음 |
| `src/lib/sync/supabase/sharedSecurityMigration.test.ts` | 위 실제 PostgreSQL 정의에 migration을 적용하는 27개 통합 회귀 |
| `src/lib/storage/localStorageAdapter.test.ts` | v1/v2 pending·conflict·local-only Action·tombstone·저장 실패 보존 3개 추가 |
| 이 보고서 및 앞선 release 보고서의 후속 보고서 링크 | 과거 RLS OFF 판정과 현재 적용 결과 구분 |

새 migration은 CLI로 생성한 후 운영 `apply_migration` 영수증의 version `20261019165450`에 맞췄다. 과거 적용 migration의 이름·내용은 변경하지 않았다.

## 3. 테이블별 owner / reader / writer 계약

모든 일반 동기화는 Supabase Auth가 반환한 `user.id`를 text `user_id`로 사용한다. 아래 canonical owner는 **내용을 관리하는 앱 책임**이며 DB 계정 소유자는 해당 Auth 사용자다. 두 앱은 같은 사용자의 JWT로 연결한다.

| 테이블 | Canonical owner | 일반 reader | 일반 writer | FK / 삭제·sync 계약 |
|---|---|---|---|---|
| notes | Personal OS | Personal OS Windows/Android | Personal OS pending upsert | (user_id,device_id) → devices. LWW updated_at, deleted_at tombstone |
| devices | 각 앱이 생성한 계정별 기기 행 | Personal OS presence, Fitness sync | Personal OS heartbeat, Fitness sync | PK (user_id,id). 여러 데이터 테이블이 참조. hard DELETE 불필요 |
| workout_records | Fitness 상세·세션 내용. legacy source_app=os 행은 그대로 보관 | Fitness 전체 계정 행; Personal OS는 공유 v1 fallback만 | Fitness batch RPC 또는 인증된 REST fallback | 기기 FK. source_app/scope 유지. tombstone 포함 pull |
| workout_exercises | Fitness 운동 상세 | Fitness | Fitness batch/REST | record_id → workout_records.id. 자식 user_id 및 부모 계정 일치 필요 |
| workout_sets | Fitness 세트 상세 | Fitness | Fitness batch/REST | workout_exercise_id → workout_exercises.id. 자식 및 부모 체인의 계정 일치 필요 |
| meal_records | Fitness 식단 상세. legacy OS 행 보존 | Fitness; Personal OS는 security-invoker 영양 요약 view를 통해 읽음 | Fitness batch/REST | 기기 FK. source_app/scope 및 unknown 값 처리 유지. tombstone |
| weight_records | Fitness 체중. legacy OS 행 보존 | Fitness; Personal OS Fitness-owned 읽기 모델 | Fitness batch/REST | 기기 FK. source_app/scope 유지. tombstone |

**익명 접근:** 확인한 현재 producer에는 필요하지 않다. Personal OS는 Auth 세션과 context user 일치를 검사하며, Fitness는 userId와 accessToken 없이는 동기화를 시작하지 않는다. `apikey`에 anon key를 쓰는 것과 익명 role로 동작하는 것은 다르다. Fitness 요청의 Authorization은 로그인 accessToken이다. REST fallback도 동일하다.

**앱 간 경계:** Personal OS의 WRITE_COLLECTIONS에는 Fitness 5개 테이블이 없다. 운동 상세는 기존 Fitness canonical ownership을 유지한다. Personal OS는 완료 workout projection, 공유 v1 운동 fallback, 영양 summary, Fitness-owned weight를 읽는다. `source_app`와 `scope`는 기존 출처·공유 메타데이터이며 신뢰할 수 있는 app 인증 claim으로 취급하지 않았다. 같은 Auth 사용자의 두 앱을 DB role만으로 구분하는 새 구조는 추가하지 않았다.

**관리자 예외:** Windows DB Editor는 저장된 관리 PAT로 Supabase Management API를 사용하는 별도 관리 도구다. 일반 앱의 anon/JWT sync 경로가 아니며 이번 정책으로 관리자 SQL 권한을 제한한다고 주장하지 않는다. service_role은 추가·노출하지 않았다.

### 코드 근거

- Personal OS: `src/lib/sync/supabaseSyncClient.ts:268` 세션 user, `:359` 계정 검사, `:452` push gate, `:567` heartbeat gate.
- `src/lib/sync/syncState.ts:4` WRITE_COLLECTIONS; `supabase/presence.ts:38` 기기 upsert; `supabase/snapshotIo.ts:313` Fitness 읽기.
- Fitness: `SupabaseConfig.java:44` 로그인 필수; `SupabaseAuthManager.java:112` Auth 응답 user.id 및 account mismatch 검사.
- `integration/sync/SyncApplicationService.java:26` refresh 후 sync; `integration/personalos/LegacyFitnessSyncAdapter.java:66` 인증 gate, `:300` 비교 후 insert/PATCH, `:602` accessToken header.
- `sync/RoomLegacyFitnessSyncStore.java:44` 계정별 Room store; `app/src/main/kotlin/com/yeonsik/fitnessapp/core/database/FitnessRoomDatabase.kt:419` user_id/device_id 필터 및 tombstone 포함 조회.
- 운영 `sync_fitness_data_v1`: SECURITY INVOKER, auth.uid 필수, payload user_id 일치 검사, devices→workout→exercises→sets 순서, newer timestamp 조건 UPDATE, tombstone 포함 delta/echo. anon EXECUTE 없음.
- CashOS의 현재 `src`에서 7개 테이블의 일반 producer/consumer는 발견하지 못했다. 금융 테이블만 backup/sync한다. 공유 Fitness RPC의 원본 migration은 `CashOS/supabase/migrations/20260821123252_fitness_incremental_batch_sync_v1.sql`.
- HealthTrace 현재 checkout의 `lib/integrations/fitness/fitness_meal_source.dart`는 Fitness 로컬 백업 JSON reader다. 해당 경로의 원격 쓰기 producer는 아니다.

검토한 sibling checkout HEAD: Fitness `16815ceb00138d7a65c0b844a1bbe165726bd3d6`, CashOS `44ce571bf61b4cd95826138c82a92094f8a353ad`, HealthTrace `9e6fa897b42f4b03cd8d1f37c38c6843c3145b73`. 이들 checkout에는 기존 dirty/untracked 파일이 있어 현재 파일을 근거로 조사했으며 수정·커밋하지 않았다. Kotlin symbol 조회 후 한정된 SQL/DAO 본문을 읽었고, SQL·Rust·Dart 경로는 bounded 검색으로 보완했다.

### 운영 데이터 계약 대조

- Auth 사용자 1명. notes 23개 모두 해당 계정 소유.
- 계정 소유 / 전체: devices 8/20, workout_records 488/538, exercises 2183/2183, sets 7432/7432, meals 64/73, weights 36/52.
- legacy OS 운동 50개·식사 9개·체중 16개 및 legacy 기기 행은 원래 owner 그대로 보존했다. 추정 계정 이전을 하지 않았다. 현재 인증 클라이언트의 owner filter와 일치하지 않는 행이다.
- 운동 부모/자식 owner 불일치 0건. 기존 FK는 자식의 부모 ID만 검사하므로 RLS에서 부모 계정도 검사한다.
- 정책 적용 후 현재 owner가 기존 완료 workout projection 439개와 영양 summary 22일을 계속 읽는 것을 운영 DB에서 확인했다.

## 4. RLS / GRANT 변경 전후

| 대상 7개 테이블 전체 | 변경 전 | 변경 후 |
|---|---|---|
| RLS | OFF, 정책 없음 | ON, 테이블별 SELECT/INSERT/UPDATE 정책 3개 |
| PUBLIC / anon | anon에 SELECT/INSERT/UPDATE/DELETE 및 TRUNCATE/REFERENCES/TRIGGER | 모두 revoke |
| authenticated | 위 전체 권한 | SELECT/INSERT/UPDATE만 허용, owner RLS 적용 |
| hard DELETE | 가능 | 거부. deleted_at UPDATE 보존 |
| 계정 변경 UPDATE | 경계 정책 없음 | 기존 행 USING 및 새 행 WITH CHECK로 거부 |
| 운동 상세 부모 | FK가 ID 존재만 검사 | 현재 사용자 소유의 부모 및 상위 체인 확인 |
| content / owner / timestamps / IDs | 기존 값 | migration에서 변경하지 않음 |

Notes와 devices는 확인된 계정 계약을 사용한다. 운동 상세 두 테이블에는 부모 소유권 검사를 추가했다. 동일 식을 근거 없이 일괄 적용하지 않았다. 기존 view/RPC/FK/trigger, Fitness의 source/scope 규칙은 변경하지 않았다.

운영 적용 및 rollback probe 전후 아래 **전체 row JSON의 MD5**가 같았다. 이 비교는 변경 감지용이며 암호학적 무결성 보증 용도가 아니다.

| 테이블 | 행 수 전후 | 동일 fingerprint |
|---|---:|---|
| notes | 23 | 487526550078c6ceb982dd0121595e65 |
| devices | 20 | 4fcaf6d55edbd4f010a5c567e67f966f |
| workout_records | 538 | f78f9d5212650a5a7e0d311777e76b40 |
| workout_exercises | 2183 | a1fbe18a327dbbcc3be53c4dfb7aaa8f |
| workout_sets | 7432 | c1648ecbbfb7805c34701b0283e7bc4a |
| meal_records | 73 | 39ddee527b52f4311218861d9fc2b3ad |
| weight_records | 52 | 2ee59136313562e7c4c2d8a9e394ac85 |
| tasks | 32 | 8c9ccd2fc462102ba6c6c61f6e9cc3ec |

과거 Task migration의 실제 historical loss 판정은 여전히 **historical loss unverifiable**다. 이번 작업은 새 복원을 추정하지 않는다.

## 5. 실행 검증과 실제 결과

| 검증 | 결과 | 증거 범위 |
|---|---|---|
| 전체 Vitest | PASS: 49 files / 317 tests | Action, Task/Records/calendar, sync, ownership, storage, 새 PostgreSQL 테스트 포함 |
| targeted Action/sync/ownership/security/storage | PASS: 8 files / 94 tests | 별도 targeted 실행 |
| 새 RLS PostgreSQL 통합 | PASS: 27 tests | PGlite PostgreSQL 엔진에 운영 schema·RPC·trigger 및 실제 후속 migration 적용 |
| typecheck | PASS, exit 0 | npm run typecheck |
| production web build | PASS, exit 0 | 기존 536.35 KB chunk warning 유지 |
| Windows Tauri/NSIS build | PASS, exit 0 | release profile 37.76s, NSIS 생성. 기존 dead_code warning 3개 |
| Android arm64 debug build | PASS, exit 0 | 기존 build script, Gradle 100 tasks / 4 executed, BUILD SUCCESSFUL. 기존 symlink fallback 및 라이브러리 일치 검증 사용 |
| 운영 DB migration | PASS | apply_migration 성공, migration history version 확인 |
| 운영 rollback SQL | PASS | 실제 anon/authenticated 역할에서 owner/타 subject read/write, forged owner, 부모 scope, Fitness RPC, notes LWW, tombstone. 테스트 행은 전부 rollback |
| REST anon SELECT | PASS: 7/7 | 각 테이블 HTTP 401 + PostgreSQL code 42501. 잘못된 API key 오류와 구분 |
| 운영 row 보존 | PASS | 위 8개 테이블 count/fingerprint 동일 |
| 기존 앱의 실제 sync | UNVERIFIED | 서버 RPC/쿼리 통과와 설치 앱의 인증 세션 실행은 별개 |

운영 role 테스트의 두 번째 계정은 다른 JWT subject를 설정한 DB 역할 검증이다. 실제 두 번째 Auth 계정으로 로그인한 테스트가 아니다. 실제 사용자·비밀번호·새 Auth 계정을 만들지 않았다. 익명 INSERT/UPDATE/DELETE/TRUNCATE 거부는 운영 transaction 안에서 실행했다.

### Upgrade safety

v1과 v2 저장 envelope에서 미전송 수정, pending revision, ENSURE_ACTION 최초 payload, 서버 conflict 사본, local-only Action, Task tombstone을 load→save→재시작 후 비교했다. 다른 계정으로 queue를 열려는 시도는 실패하고 기존 queue는 남는다. v1→v2 저장 실패 시 v1 원본이 유지되는 것도 확인했다.

이는 **저장 형식/동기화 회귀**다. 구버전 실행 파일을 실제 설치 교체한 검증은 아니다. 기존 v1 복구 사본과 v2 pending 데이터를 지우지 않았고, 설치 앱의 저장소·계정·앱 데이터는 건드리지 않았다.

### Security advisor 재확인

- `rls_disabled_in_public` ERROR: **7건 → 0건**. [해당 linter 설명](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
- 잔존 기존 항목: RLS ON/no policy INFO 5, mutable search_path WARN 3, anon security-definer executable WARN 1, authenticated security-definer executable WARN 16, leaked password protection WARN 1.
- 이 항목들이 모두 취약하다고 단정하지 않는다. 인증된 Fitness projection/금융 RPC에는 정당한 실행 계약이 있다. 금융 trigger 함수 warning을 포함해 이번 7개 테이블을 다루지 않는 기존 공유 DB 항목은 변경하지 않았으며 별도 보안 검토 대상이다.
- [mutable search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anon security-definer](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated security-definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### 산출물 SHA-256

- Windows EXE: `C19317DF78F4D034C43E8F9FB2D1A5D87C4E9823401234600A05F5568F5710D7`.
- Windows NSIS: `AB163469E33312D81B68888C28E724AFD0ACC87BB665A62B9FBDB6E01C49ACB1`.
- Android APK: `9646579EEB91EA02C467D2E561750EE4CBE237D2846A295FF9A0BB99204B7389`.
- 경로: 기존 `src-tauri/target/release/`, `bundle/nsis/`, `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/`. 빌드 산출물은 Git에 추가하지 않았다.

## 6. Windows↔Android 실제 검증

Galaxy A25 (SM_A256N) ADB 연결은 확인했다. 설치된 Personal OS는 `com.yeonsik.note` 1.0.0 / code 1000000, 마지막 업데이트 2026-10-18 22:59:29다. Fitness는 `com.yeonsik.fitnessapp` 1.1.0 / code 2, 마지막 업데이트 2026-10-19 18:12:52다. 버전 정보만으로 빌드 commit이나 인증 상태가 같다고 판정하지 않았다.

현재 도구의 네이티브 UI 제어가 비활성화되어 Windows 앱·Galaxy 앱의 로그인 세션을 직접 조작할 수 없다. Windows의 실행 중인 Personal OS 세션도 확보하지 못했다. 설치·초기화나 비공개 토큰 추출로 이를 우회하지 않았다.

| 실제 흐름 | 결과 |
|---|---|
| 1. Windows Action 생성 | UNVERIFIED |
| 2. Android 수신 | UNVERIFIED |
| 3. Android 수정 | UNVERIFIED |
| 4. Windows 수정 수신 | UNVERIFIED |
| 5. 한 기기에서 삭제 | UNVERIFIED |
| 6. 상대 기기 삭제 수신 | UNVERIFIED |
| 7. 재동기화 | UNVERIFIED |
| 8. 동일 external identity 재가져오기 | UNVERIFIED |
| 9. 기존 사용자 수정·삭제 자동 덮어쓰기 방지 | UNVERIFIED |

앞선 Action/sync 자동 회귀는 유지되어 통과했지만 위 실기기 결과를 대체하지 않는다.

## 7. UNVERIFIED

- 같은 실제 Supabase 계정의 Windows↔Galaxy A25 전체 9단계.
- 설치된 Personal OS/Fitness의 실제 로그인·refresh·네트워크·Realtime을 포함한 sync.
- 실제 다른 Auth 계정의 JWT로 로그인한 REST 격리. 운영 DB role/subject 격리는 PASS.
- 실제 구버전→신버전 설치 교체 전후 pending conflict/local-only Action 비교.
- 잔존 공유 DB advisor warning의 전체 exploitability 감사. 이번 7개 테이블의 RLS OFF 및 anon 권한 blocker는 해소했다.

## 8. 판정

**BLOCKED. main merge 금지.**

요청한 7개 테이블의 현재 코드·DB 계약은 확인했고 최소 RLS/GRANT를 운영에 적용했다. 서버 수준 정상 producer 경로와 데이터 보존·전체 회귀·플랫폼 빌드는 통과했다. 실제 앱의 인증 세션으로 양방향 sync 및 설치 upgrade가 검증되지 않았으므로 release-ready로 판정할 근거가 부족하다.

다음 단일 작업은 UI를 직접 조작할 수 있는 환경에서 기존 로컬 데이터와 pending을 보존한 채 위 9단계 및 실제 Fitness sync를 실행하고 결과를 이 보고서에 추가하는 것이다.
