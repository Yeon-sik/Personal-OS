# GPT 일정 등록 진입점 및 Personal OS 연동 앱 점검

기준일: 2026-10-20, Asia/Seoul. 사용자 지정 범위는 **Personal OS 연동 앱**이다.
소스 기준: `feat/action-calendar-20261018`, HEAD `df21a14f8c7ad840234afd9e22222942b81ba292`와 현재 미커밋 구현.
이 보고서는 분석 결과다. 앱 코드·운영 데이터·DB 권한·마이그레이션을 변경하지 않았다.

## 1. 판정

**GPT가 만든 일정을 가져와 Personal OS 달력에 등록하는 경로는 구현되어 있다. 대화에서 자동으로 등록하는 연결은 아직 없다.** FitnessApp과 CashOS의 기존 데이터는 로그인 계정 권한으로 실제 조회된다. 그러나 모든 앱의 신규 등록부터 양 기기 화면 갱신까지 문제없다는 판정은 할 수 없다.

그 이유는 다음과 같다.

- 앱별 연결 방향과 표시 조건이 다르다. 일정 등록과 운동·식사·거래 등록은 서로 다른 계약이다.
- 운영 DB에 Personal OS 증분 동기화 RPC가 없다. 기존 전체 조회 fallback은 있으나 영양 요약 변경을 항상 즉시 가져오는 경로는 확보되지 않았다.
- 기존 테이블 7개의 RLS가 비활성화되어 있다. 익명 역할에서 메모·체중 조회가 실제로 가능했다.
- GitHub 실제 인증 및 저장소 조회, Windows·Android 간 신규 등록과 화면 갱신은 이번 점검에서 실행하지 않았다.

## 2. GPT가 개입하는 지점

```text
GPT가 일정·출처를 구조화한 JSON 작성
  → 기록 → 전체 → 일정 가져오기
  → 내용 검토
  → 후보로 보관 / 일정으로 등록
  → 로컬 저장 성공
  → 기존 달력의 계획·접수기간·마감·시험/행사 표시
  → 계정 로그인·온라인·동기화 성공
  → 다른 Windows / Android 기기에서 수신
```

| 지점 | 현재 가능 범위 | 경계 |
|---|---|---|
| GPT 대화 | 일정 추출, 날짜·출처 정리, 지정 JSON 생성 | 대화 자체가 앱 저장을 실행하지 않는다 |
| 가져오기 UI | 붙여넣기, 항목별 검증·선택, 후보/확정 저장 | 사용자가 검토·저장을 실행한다 |
| 앱 내부 함수 | `parseActionImport` → `prepareImport` → `useActionActions.importActions` → `commitDurably` | 앱 내부 기능이며 외부 GPT 도구로 공개되지 않았다 |
| 서버 생성 RPC | `ensure_action_v1(jsonb)`가 최초 생성 또는 기존 행 반환 | 로그인 권한, 소유자, 기기 FK, 확정된 행 형식과 ID가 필요하다. 가져오기 JSON을 그대로 받는 API가 아니다 |
| 자동 등록 도구 | GPT 전용 MCP/HTTP 도구·딥링크 등록 경로를 현재 소스에서 확인하지 못함 | 구현이 필요하다. DB 편집기로 우회하면 앱의 검증·로컬 저장·대기열 계약을 생략한다 |

현재 외부 입력 형식은 `personal-os.action-import.v1`이다. `schemaVersion`, `requestId`, `items`를 받으며 한 번에 1~100개, 최대 256 KiB다. 설명문이나 Markdown 코드 울타리를 붙이면 JSON 검증에서 거부한다.

지원 종류는 `TASK`, `APPLICATION`, `REGISTRATION`, `DEADLINE`, `EXAM`, `EVENT`, `RENEWAL`이다. 동일한 행동은 `sourceNamespace`와 `externalKey`를 유지해야 한다. 계정과 이 식별자로 UUIDv5를 생성한다. 재가져오기는 사용자 수정·완료·삭제를 덮어쓰지 않고 동일 항목 또는 차이 검토로 처리한다. 식별자가 없으면 사용자가 독립 생성을 선택해야 하며 기기 간 중복 방지를 보장하지 않는다.

외부 공고는 등록 후에도 `UNVERIFIED`다. 출처 확인은 별도 절차다. 후보·날짜 미정 항목은 확정 일정과 구분한다. 로그인 전 기기 전용 일정은 **현재 계정으로 가져오기**를 실행해야 다른 기기로 전송된다. `origin`에는 `CHATGPT` 값이 있지만 현재 붙여넣기 파서는 `IMPORT`로 저장한다.

근거: [가져오기 UI](../../src/features/actions/ActionImportDialog.tsx), [입력 계약](../../src/features/actions/actionImport.ts), [저장 진입점](../../src/features/actions/useActionActions.ts), [식별자](../../src/features/actions/actionIdentity.ts), [서버 생성 RPC](../../supabase/migrations/20261018133855_action_calendar_v1_1.sql).

## 3. 연동별 등록 및 수신 조건

| 연결 | 데이터 이동과 조건 | 현재 확인 결과 | 남은 경계 |
|---|---|---|---|
| Windows ↔ Android Personal OS | 같은 Supabase 프로젝트·Auth 사용자. 로컬 저장 후 push/pull 및 Realtime | `tasks` 32행·`notes` 23행 모두 현재 계정 소유. 일정 RPC 실행 권한과 tasks RLS 확인 | 실제 두 기기에서 새 일정 생성·수정·삭제 왕복은 미검증 |
| FitnessApp 운동 → Personal OS | 원앱에서 완료 운동 요약 발행·동기화. Personal OS는 v2 우선, 공유 완료 v1 보완 | 로그인 권한으로 v2 439행 조회, 삭제·버전·완료 조건에 맞는 437행 | 진행 중 운동·상세 세트 전체를 옮기는 구조가 아니다. 원앱 로컬 저장만으로 서버 도착을 보장하지 않는다 |
| FitnessApp 식단 → Personal OS | `meal_records`의 로그인 소유자, `source_app=fitness`, `scope=fitness/both`, 미삭제 조건을 일별 view로 조회 | `fitness_nutrition_summary_v1` 22일 조회, 계약 형식 22/22 충족 | view 자체 Realtime 구독이 없고 증분 RPC도 없어 신규 식단은 수동 동기화·재연결·다음 전체 pull이 필요할 수 있다 |
| FitnessApp 체중 → Personal OS | 같은 계정의 Fitness 소유 미삭제 체중만 수신 | 표시 조건에 맞는 35행 조회 | 건강 화면은 전체 sync 상태가 `synced`가 아니면 체중을 숨긴다. 다른 도메인의 동기화 실패도 표시를 막을 수 있다 |
| CashOS → Personal OS | 같은 프로젝트·계정의 `CONFIRMED`·미삭제 원장을 `finance_summary_daily`로 조회 | 로그인 권한으로 563일 조회, 기본 요약 필드 563/563 충족 | 임시·미확정 거래는 제외. 월 범위 조회, 화면 활성 시 30초 주기·포커스·수동 새로고침. 원앱 기록 전체를 가져오지는 않는다 |
| GitHub → Personal OS | Client ID 설정 → Device Flow 로그인 → GitHub App 설치·저장소 접근 권한 → 프로젝트 저장소/브랜치 연결 | 저장소·브랜치·커밋의 읽기 경로 및 오류 테스트 확인 | 설정 저장만으로 인증·설치 권한이 생기지 않는다. 실제 GitHub API·모바일 자격증명 저장은 미검증. 이슈/마감 → 일정 자동 생성 경로도 확인되지 않았다 |

이 연결들은 일정 등록을 공유하는 공통 쓰기 API가 아니다. Personal OS에 GPT 일정을 저장해도 FitnessApp에 운동 세션이 생기거나 CashOS에 거래가 생기지 않는다. 각 앱에서 기록을 생성하고 동기화한 뒤, Personal OS가 그 앱의 요약 계약을 읽는다.

FitnessApp 발행 코드 `FitnessSummaryPublisher.publish`는 `upsert_fitness_summary_projection_v2`를 호출한다. `SupabaseSyncManager.manualSync`는 기존 기록 동기화 이후 요약을 발행하며, 요약 발행 실패를 별도 결과로 보존한다. CashOS의 일별 view는 현재 운영 정의와 소스 migration 양쪽에서 `CONFIRMED`·미삭제 원장을 사용한다.

CashOS에는 `expense_recovery_krw`, `personal_expense_krw`도 있지만 Personal OS는 현재 기본 수입·지출·순액·건수만 읽는다. 최신 확장 지표까지 모두 통합된 상태는 아니다.

근거: [수신 계약](../../src/lib/sync/supabase/snapshotIo.ts), [운동 표시 조건](../../src/features/fitness-summary/sharedWorkoutSummaries.ts), [영양 계약](../../src/features/fitness-summary/fitnessNutritionContract.ts), [체중 표시 조건](../../src/features/fitness/FitnessPanel.tsx), [CashOS 조회](../../src/lib/sync/supabase/financeSummary.ts), [금융 갱신](../../src/features/finance/useFinanceCalendar.ts), [GitHub 어댑터](../../src/features/dev-control/github/githubApi.ts).

## 4. 설정 화면의 나머지 연결 기능

- **지식 보관함:** 데스크톱 Tauri 전용이다. Markdown 파일 본문은 로컬 보관함이 원본이고 `knowledge_documents`에는 제목·유형·연결·상대 경로만 저장한다. 등록 정보가 동기화되어도 모바일로 Markdown 본문이 전송되는 구조는 아니다.
- **Supabase 데이터 편집기:** 데스크톱 Tauri에서 별도 PAT 권한으로 프로젝트·테이블을 조회하고 기존 행을 갱신한다. 앱 계정 동기화 및 GPT 일정 가져오기와 인증·저장 흐름이 다르다.
- **HealthTrace·PriceTrace 등:** 현재 Personal OS 수신 소스에 직접 연동 어댑터가 확인되지 않았다. 관련 원앱을 설치·등록했다는 사실만으로 Personal OS에 데이터가 나타난다고 볼 수 없다.

근거: [설정 목록](../../src/components/SettingsPanel.tsx), [지식 보관함 지원 범위](../../src/features/knowledge-vault/knowledgeVaultService.ts), [문서 메타데이터](../../src/types/entities.ts), [DB Editor 환경 제한](../../src/features/db-editor/window.ts).

## 5. 확인된 문제와 우선순위

| 우선순위 | 확인된 문제 | 영향과 다음 조치 |
|---|---|---|
| P0 | `notes`, `devices`, `workout_records`, `workout_exercises`, `workout_sets`, `meal_records`, `weight_records`의 RLS 비활성 | `anon` 역할로 메모 23행·체중 52행 조회 가능함을 확인했다. 연결 정상 운영 판정 전에 소유 앱별 기존 접근 계약을 분석하고 RLS·GRANT를 정리해야 한다 |
| P1 | `get_personal_os_sync_cursor_v1`, `read_personal_os_sync_changes_v1` 미배포 | 전체 pull fallback으로 기존 읽기는 가능하다. 영양 요약 등의 변경 감지와 기기 복귀 후 수신을 보장하려면 기존 migration을 운영 계약과 대조한 뒤 적용·검증해야 한다 |
| P1 | 신규 일정 등록의 실제 두 기기 왕복 증거 부족 | 같은 테스트 일정을 Windows 생성 → Android 수신 → 수정 → Windows 수신 → 삭제·재시도까지 확인해야 한다 |
| P1 | GPT 자동 등록 도구 미연결 | 현재 JSON 가져오기를 쓸 수 있다. 자동화가 필요하면 기존 검증·식별·로컬 저장·사용자 인증을 재사용하는 한 개의 등록 어댑터를 먼저 만든다 |
| P1 | GitHub 실제 인증·설치 권한 및 모바일 경로 미검증 | 설정 저장, 로그인, 저장소 선택, 실제 읽기까지 각각 검증해야 한다 |
| P2 | CashOS 확장 요약 지표 미수신, 건강 체중의 전역 동기화 상태 의존 | 표시 범위·오류 분리를 보완할 항목이다 |

RLS 점검 출처: [Supabase Database Linter — RLS Disabled](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public). 익명 조회는 내용을 출력하지 않고 행 수만 확인했다. 이번 요청은 점검·보고이므로 운영 권한을 변경하지 않았다.

## 6. 검증 범위와 제한

| 확인 | 결과 |
|---|---|
| 코드 경로·원앱 계약 | Personal OS TypeScript는 Serena 심볼 탐색, FitnessApp Java는 실제 Java 프로젝트 활성화 후 발행 심볼 확인. CashOS SQL은 LSP 대상이 아니므로 경로를 한정한 검색으로 확인 |
| DB 실제 사용자 권한 | 유일 로그인 사용자의 JWT claim 문맥과 `authenticated` 역할로 수신 view·테이블 조회. 세션 설정은 트랜잭션 종료 시 롤백 |
| 익명 접근 | `anon` 역할로 notes·weight 행 수 조회 후 롤백 |
| 기존 관련 테스트 | `npm.cmd test -- src/features/actions src/lib/sync/supabase/legacyNoteOwnership.test.ts src/lib/sync/supabase/deltaSync.test.ts src/lib/sync/supabase/financeSummary.test.ts src/features/fitness-summary src/features/dev-control/github --reporter=dot`: **13개 파일, 81개 통과** |
| 타입 검사 | `npm.cmd run typecheck` 통과 |
| 현재 브라우저 | 기존 탭은 동적 모듈 로딩 실패 상태였고 새로고침 시 localhost 연결 거부. 1420 포트 listener도 확인되지 않았다. 이 개발 서버 상태를 설치된 Windows·Android 앱 실패 증거로 보지는 않는다 |
| 이번에 실행하지 않은 항목 | 원앱의 신규 기록 입력, 실제 사용자 세션의 HTTP 왕복, 설치된 Windows/Android 화면·Realtime, GitHub 인증·권한 부여, 지식 보관함 파일 생성, DB Editor PAT 연결 |

운영 tasks는 32행 모두 `MANUAL`이며 이번 점검에서는 GPT 테스트 일정을 실제 계정에 생성하지 않았다. 로컬 PostgreSQL 테스트의 등록·중복·수정·삭제·계정 격리 검증과 실계정 앱 왕복 검증은 별개다. 영양 view는 내부에서 `auth.uid()`로 필터링하므로 인증 문맥이 없는 관리자 조회의 0행을 데이터 부재로 판단하면 안 된다.

**지금 우선할 작업은 기존 공유 테이블의 접근 권한 정리다.** 그다음 증분 동기화 배포 여부를 결정하고, 원앱 신규 등록 → Personal OS Windows → Android 수신을 같은 시험 항목으로 검증해야 “모든 연동 정상” 판정을 낼 수 있다.
