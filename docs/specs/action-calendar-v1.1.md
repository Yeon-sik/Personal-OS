# Personal OS — Action & Calendar Layer 설계 보고서 v1.1

GPT가 정리한 접수기간·시험일·마감을 **기존 달력에서 통합 확인**하기 위한 설계다. 첫 구현 단위는 구조화 입력, 사용자 검토, 로컬 저장, 기존 달력 표시다. 기기 간 동기화까지 검증한 뒤 첫 릴리스로 제공한다.

| 문서 항목 | 내용 |
|---|---|
| 상태 | 리드 검토 반영 설계. 2026-10-18 구현 후 검증 범위는 별도 [구현 검증 기록](../verification/action-calendar-v1.1.md) 참조 |
| 작성·검토일 | 2026-10-18, Asia/Seoul |
| 문서 버전 | v1.1, 같은 버전의 설계 검토 보완 |
| 독자 | 제품 결정자, 구현 담당자, 검증 담당자 |
| 대상 | Personal OS의 Task, 일정 입력, 기존 달력, 기존 동기화 |
| 이 문서의 범위 | 설계 계약과 검토 이력. 후속 구현·DB 적용·플랫폼 검증은 구현 검증 기록에서 구분 |

## 1. 검토 판정과 보완사항

**기존 Task 확장 방향은 적절하다. 다만 입력·확정·중복·날짜·호환성 계약을 함께 적용해야 기존 달력과 일관되게 동작한다.** 이 문서는 그 계약을 정리한다. 실제 동작 가능성의 최종 판정은 14절의 구현 단계와 15절의 수용 기준으로 한다.

| 우선순위 | 검토 중 발견한 문제 | 반영한 결정 |
|---|---|---|
| P1 | 등록 여부와 출처 검증을 분리한다고 했으나, 미확인 일정은 확정하지 못하게 제한 | 사용자의 등록 결정과 출처 확인 상태를 독립 관리. 미확인 출처를 유지한 채 등록 가능 |
| P1 | 외부 일정을 개인 계획으로 채택할 때 출처 유형이 바뀌어 근거를 잃음 | 원래 외부 출처 유지. 계획일과 등록 결정만 사용자 의사로 변경 |
| P1 | 상대 날짜의 기준을 요구하면서 입력 계약에는 기준 필드가 없음 | 절대 날짜만 입력받고, 상대 날짜 해석의 기준은 별도 근거 필드로 보존 |
| P1 | `Upsert`라는 이름과 실제 생성·기존 항목 찾기 동작이 불일치 | `ImportActionBatchV1`로 명명. 기존 내용 변경은 명시적 편집으로 분리 |
| P1 | 같은 ID를 만들어도 현재 `upsert(id)`가 사용자 수정을 덮을 수 있음 | 최초 생성 전용 `ENSURE_ACTION`과 일반 수정 경로 분리 |
| P1 | 새 저장 형식만으로 구버전 실행을 막을 수 있는 것처럼 기술 | 로컬 저장 key 분리와 복구 절차 명시. 구버전 혼용은 미지원 출시 조건으로 관리 |
| P2 | 후보를 별도 진입점에 숨겨 달력 통합의 효용이 약함 | 기본 달력에서 확정·후보를 구분해 함께 표시. 집계는 분리 |
| P2 | 입력 화면이 Quick Capture 또는 Records로 미결정 | 기록 탭의 ‘일정 가져오기’ 하나로 시작 |
| P2 | 알림 상세 설계가 첫 릴리스의 필수 범위와 섞임 | 후속 확장 제약만 유지하고 별도 단계로 이동 |
| P2 | 수용 기준과 구현 순서의 연결이 약함 | 요구사항 ID, 세로 기능 단위, 통과 기준을 연결 |

P1은 데이터 의미·보존·중복에 영향을 주는 문제, P2는 범위·사용성·검증 가능성의 문제다. 문서에서 보완했다는 사실을 구현에서 해결됐다는 뜻으로 사용하지 않는다.

## 2. BASELINE과 확인된 사실

- Repository: `Yeon-sik/Personal-OS`
- 검토한 로컬 HEAD: `df21a14f8c7ad840234afd9e22222942b81ba292`
- 검토 브랜치: `feat/incremental-sync-20261005`
- v1 보고서 기준 HEAD: `0b0153ee01aa1bc37d7645b5bfbd18cdd3e408de`
- 위 로컬 HEAD는 원격 최신 main 확인을 뜻하지 않는다. 구현 착수 시 대상 브랜치와 실제 적용된 migration을 다시 확인한다.

| 영역 | 코드에서 확인한 사실 | 근거 |
|---|---|---|
| Task | `text`, `isDone`, `orderIndex`, `dueDate`, `dueTime`, `plannedDate`와 동기화 메타데이터 존재 | [entities.ts](../../src/types/entities.ts) |
| 쓰기 | Task service에서 생성·수정하며 `updatedAt` 갱신 | [taskService.ts](../../src/features/tasks/taskService.ts) |
| 로컬 저장 | localStorage snapshot과 명시적인 필드 정규화 사용. 현행 key는 `localsyncmemo:snapshot:v1` | [localStorageAdapter.ts](../../src/lib/storage/localStorageAdapter.ts) |
| 달력 집계 | marker는 계획일·마감일, 날짜 상세는 생성일~마감일 범위도 사용 | [recordAggregation.ts](../../src/features/records/recordAggregation.ts) |
| 기존 화면 | RecordsPanel, RecordCalendar 존재 | [RecordsPanel.tsx](../../src/features/records/RecordsPanel.tsx), [RecordCalendar.tsx](../../src/features/records/RecordCalendar.tsx) |
| Push | 변경 대기열을 전송하고 서버 확정값 재조회. 일반 행 전송은 `upsert(id)` | [syncState.ts](../../src/lib/sync/syncState.ts), [deltaPush.ts](../../src/lib/sync/supabase/deltaPush.ts) |
| Pull·Realtime | 증분 source와 구독 대상의 명시적 목록 사용 | [changeFeed.ts](../../src/lib/sync/supabase/changeFeed.ts), [realtime.ts](../../src/lib/sync/supabase/realtime.ts) |
| DB | Task 소유자, 날짜, tombstone, 기기 FK 존재 | [schema.sql](../../supabase/schema.sql) |
| 플랫폼 | Windows Tauri, Web, Android 및 local-only 경로 유지 | [platform-compatibility.md](platform-compatibility.md) |
| 알림 | JS·Rust 의존성에 notification plugin 없음 | [package.json](../../package.json), [Cargo.toml](../../src-tauri/Cargo.toml) |

이하의 신규 필드·서비스·화면 동작은 **제안**이다. 원격 DB, 배포 앱, 실기기의 현재 동작까지 확인한 사실로 확대하지 않는다.

## 3. 목표·범위·요구사항

첫 사용자 흐름은 다음과 같다.

> GPT가 정리한 일정을 붙여넣는다 → 출처와 날짜를 검토한다 → 후보로 보관하거나 일정으로 등록한다 → 기존 달력에서 다른 기록과 함께 확인한다 → 다시 입력하거나 다른 기기에서 열어도 데이터가 보존된다.

| ID | 필수 요구사항 |
|---|---|
| R1 | 기존 Task와 다른 앱 소유 기록을 보존하면서 기존 달력에 통합 |
| R2 | GPT의 구조화 텍스트를 검증·미리보기 후 저장. 등록 의사와 출처 신뢰 분리 |
| R3 | 접수기간·계획일·마감·시험일과 시간 미상을 서로 다른 의미로 표현 |
| R4 | 같은 외부 식별자의 재입력·재시도·동시 생성에서 중복 및 자동 덮어쓰기 방지 |
| R5 | 오프라인 저장, 재시작, 증분 동기화, 완료·삭제·계정 분리 유지 |
| R6 | 달력 marker, 날짜 상세, 후보, 날짜 미정 목록의 일관성 |
| R7 | 기존 데이터 전환·복구·호환성의 검증 가능한 출시 경계 |
| R8 | Windows Tauri·Web·Android에서 동일한 핵심 입력·조회 흐름 |

첫 릴리스에는 OS 알림, MCP 직접 쓰기, Source Monitor, Radar, 외부 캘린더 연동, 반복 일정, 첨부파일, 앱 내 유료 AI 호출을 포함하지 않는다. 별도 서버나 별도 모바일 프로젝트도 추가하지 않는다. ‘GPT가 파악함’만으로 자동 전달되지는 않으며, 첫 전달 수단은 구조화 텍스트 붙여넣기다.

## 4. 사용자 흐름과 책임 경계

입력 진입점은 **기록 탭 → 일정 가져오기**로 고정한다. Desktop/Web은 앱 안의 검토 dialog, Android는 검토 sheet를 제안한다. 기존 Quick Capture의 플랫폼별 동작은 유지하며, 추가 진입점 연결은 후속 사항이다.

1. JSON을 붙여넣으면 파싱·검증 결과와 기존 일정 일치 여부를 보여준다. 이 단계는 저장하지 않는다.
2. 항목마다 내용, 종류, 날짜·시간대, 출처 확인 상태, 중복·변경 경고를 보여준다.
3. 사용자는 항목별로 ‘후보로 보관’ 또는 ‘일정으로 등록’을 선택한다. 오류가 있는 항목은 저장할 수 없다.
4. 선택한 항목을 한 로컬 저장 단위로 반영한다. 실패하면 성공으로 알리지 않는다.
5. 저장한 일정으로 이동할 수 있게 한다. 날짜가 없으면 날짜 미정 목록으로 이동한다.
6. 로컬 저장과 서버 반영 상태를 별도로 표시한다. 서버 응답을 기다리지 않고 달력에서 조회할 수 있다.

```text
GPT 구조화 텍스트
  → Import adapter: 파싱·크기 제한
  → Action application service: 날짜·식별·등록 규칙, 미리보기 재검증
  → Task + pending operation: 한 로컬 snapshot으로 저장
       ├─ Calendar projection → 기존 달력 · 날짜 상세 · 날짜 미정
       └─ 기존 Sync + ENSURE_ACTION → Supabase → 다른 기기

후속 확장: 같은 application service ← 인증된 MCP adapter
후속 알림: Task + TaskReminder → 기기별 scheduler
```

Personal OS는 사용자 일정과 행동의 원본을 소유한다. 공고 원본은 발행처에 있으며, Fitness·CashOS 등 다른 앱의 상세 데이터 소유권은 변경하지 않는다. 일정 원본은 `tasks` 하나로 유지한다. 별도 Calendar DB나 종류별 원본 테이블, 기존 Dev Control Action의 통합은 이번 범위가 아니다.

UI는 직접 DB에 쓰지 않는다. 입력 adapter는 데이터 형식만 바꾸며 권한을 부여하지 않는다. Calendar projection은 저장·네트워크 호출 없이 snapshot과 표시 설정을 계산한다.

## 5. 데이터 모델과 불변식

### 5.1 기존 Task 의미

| 필드 | 의미 |
|---|---|
| `planned_date` | 사용자가 실제로 처리하려는 달력 날짜 |
| `due_date/time` | 마감. 시험·행사 시작 시점으로 재해석하지 않음 |
| `is_done` | 사용자가 완료로 처리했는지 여부 |
| `updated_at` | 동기화 변경 시각. 일정일 또는 완료일이 아님 |
| `deleted_at` | 삭제 전파를 위한 tombstone |

### 5.2 추가 필드

저장소는 snake_case, TypeScript와 입력 계약은 camelCase를 사용한다. 아래는 논리 모델이며 실제 DDL은 구현 단계에서 작성한다.

| 묶음 | 필드 | 규칙 |
|---|---|---|
| 종류 | `kind` | TASK, APPLICATION, REGISTRATION, DEADLINE, EXAM, EVENT, RENEWAL |
| 접수 시작 | `window_start_date/time` | nullable. 종료는 기존 due 사용 |
| 시험·행사 | `event_start_date/time`, `event_end_date/time` | nullable. 미상 종료를 만들어내지 않음 |
| 시간대 | `time_zone` | IANA 식별자. 기존 데이터 기본은 Asia/Seoul |
| 등록 | `registration_state` | CANDIDATE 또는 CONFIRMED |
| 입력 경로 | `origin` | MANUAL, CHATGPT, IMPORT. 이번 화면은 IMPORT, 모델 정체를 신뢰 근거로 사용하지 않음 |
| 근거 종류 | `source_type` | USER_STATEMENT 또는 EXTERNAL_NOTICE |
| 근거 상태 | `verification_status` | UNVERIFIED, USER_PROVIDED, SOURCE_CHECKED |
| 근거 내용 | `source_url/label/excerpt` | nullable. 필요한 짧은 근거만 저장 |
| 상대 날짜 근거 | `source_reference_date/time_zone` | 둘 다 null 또는 둘 다 존재. 원문 해석의 기준일·시간대 |
| 확인 시각 | `source_reported_checked_at` | 입력자가 주장한 시각. 검증 완료 아님 |
| 앱 내 확인 | `source_checked_at/by` | 앱에서 기록한 사용자 확인 시각·주체. JSON으로 지정 불가 |
| 외부 식별 | `source_namespace`, `external_key` | 둘 다 null 또는 둘 다 존재. 같은 계정 안의 행동 식별 |

### 5.3 종류별 허용 조합

| 종류 | 허용 일정 필드 | 금지 조합 |
|---|---|---|
| TASK, DEADLINE, RENEWAL | planned, due | windowStart, event |
| APPLICATION, REGISTRATION | planned, windowStart, due | event |
| EXAM, EVENT | planned, eventStart, eventEnd | windowStart, due |

날짜가 없는 항목도 저장할 수 있다. 다만 eventEnd만 있거나 날짜 없이 time만 있는 입력은 거부한다. 접수와 시험은 서로 다른 Task로 만든다. 접수를 완료해도 응시 완료가 되지 않기 때문이다. 그룹·반복 회차 모델은 추가하지 않는다.

## 6. 등록 상태와 출처 확인 상태

두 상태는 독립이다. **등록 확정은 “내 일정에 포함한다”는 뜻이며 “공식 사실을 검증했다”는 뜻이 아니다.**

| 상황 | 등록 상태 | 근거 상태·처리 |
|---|---|---|
| 외부 공고를 가져와 후보로 보관 | CANDIDATE | UNVERIFIED |
| 외부 일정을 출처 미확인 상태로 명시적 등록 | CONFIRMED | UNVERIFIED 유지, 달력에서 ‘출처 미확인’ 표시 |
| 사용자가 출처와 날짜를 대조했다고 표시 | 기존 등록 상태 유지 | SOURCE_CHECKED, 사용자 확인 기록 생성 |
| 사용자가 직접 정한 계획을 저장 | 선택에 따라 후보 또는 확정 | USER_PROVIDED. 외부 검증을 뜻하지 않음 |
| 출처 간 일정 충돌 | 기본 CANDIDATE | 선택되지 않은 값을 자동 채택하지 않음. 사용자가 값을 선택해 등록하면 미확인 상태로 보존 |
| 날짜 미정 | 후보 또는 명시적 확정 | 날짜 미정 목록. 임의 날짜로 달력 배치 금지 |

붙여넣은 `verified`, 사용자 승인 문장, 사용자·기기 ID는 권한이나 확인 증거로 쓰지 않는다. 일반 붙여넣기에서는 검토 화면의 저장 동작이 등록 의사를 제공한다.

SOURCE_CHECKED는 사용자의 출처 대조 기록이다. 앱의 독립적인 웹페이지 인증을 뜻하지 않는다. 첫 릴리스에서 자동 검증 주체는 없다. 외부 출처 확인에는 확인 가능한 URL이 필요하고, label만 있을 때는 UNVERIFIED를 유지한다.

외부 일정을 개인적으로 채택해도 `source_type`과 출처를 바꾸지 않는다. 확인된 내용·공식 날짜·시간대·출처가 변경되면 현재 확인 기록을 해제하고 UNVERIFIED로 돌린다. **등록 상태는 유지**하므로 일정이 달력에서 사라지지 않는다. 계획일·완료·정렬만 바꾸면 출처 상태는 유지한다.

후보의 완료 전환은 제공하지 않는다. 확정으로 전환한 다음 완료할 수 있다. `CANDIDATE`이면 `is_done=false`를 유지한다. 완료 Task를 후보로 되돌릴 때는 완료 상태도 해제한다는 결과를 미리 보여주고 한 편집으로 적용한다. 삭제는 등록 상태와 무관하게 tombstone으로 처리한다.

## 7. 날짜·시간·계산 상태

### 7.1 입력과 정밀도

- 날짜는 유효한 `YYYY-MM-DD`, 시간은 24시간제 `HH:mm`이다. 존재하지 않는 날짜·시간은 거부한다.
- 시간 미상은 null이다. `00:00`, `23:59`, 임의 행사 길이를 원본에 채우지 않는다. 시간 미상을 종일 행사로 확정하지 않는다.
- `schedule.timeZone`은 필수다. 입력 화면에서 명시적으로 확인하며 기기의 현재 timezone으로 대체하지 않는다. 원본 시간대를 모르면 정확한 시각을 확정하지 않는다.
- 접수 시작은 마감보다 늦을 수 없다. 행사 종료는 시작보다 빠를 수 없다. 날짜가 같고 한쪽 시간이 없으면 시간 순서 미확정으로 표시한다.
- DST 때문에 존재하지 않거나 두 번 존재하는 현지 시각은 입력 오류다. 시각을 명확히 하거나 time을 null로 바꾸어야 저장할 수 있다. 원문은 excerpt에 남긴다.
- 앱은 ‘내일’ 같은 자연어 날짜를 재해석하지 않는다. GPT가 기준을 확보해 절대 날짜를 제안했다면 `source.dateReference`에 기준일·시간대를 함께 담는다. 기준을 모르면 날짜를 null로 제안한다. 근거의 진실성은 형식 검사만으로 보장하지 않는다.
- plannedDate는 사용자의 계획 날짜다. 입력한 날이나 접수 시작일로 자동 생성하지 않는다.

### 7.2 달력 배치

첫 릴리스의 표시 timezone은 모든 기기에서 `Asia/Seoul`이다. 사용자별 표시 timezone 설정은 후속 범위다.

| 정밀도 | 배치 규칙 |
|---|---|
| 날짜만 있는 단일 일정 | 원본 날짜 유지, ‘시간 미확인’ 표시 |
| 정확한 시각이 있는 단일 일정 | 표시 timezone으로 변환. 상세에 원본 날짜·시각·timezone 함께 표시 |
| 양 끝이 정확한 기간 | 변환한 시간 구간과 겹치는 날짜에 표시 |
| 한쪽 이상 시간이 미상인 기간 | 양 끝 모두 원본 날짜 기준으로 배치. 개별 경계도 같은 날짜 기준을 사용해 marker 불일치 방지 |
| 시작만 있는 접수 | 시작일 표시 + ‘마감 미확인’. 무한한 기간을 만들지 않음 |
| 마감만 있는 접수 | 마감 표시만 생성 |
| 종료 없는 행사 | 시작 날짜·시점만 표시. 기간 또는 종료 시각 추측 금지 |

정확한 기간은 `[start, end)`로 날짜 겹침을 계산한다. 종료가 자정이면 그 다음 날에 기간을 늘리지 않는다. 마감 marker는 실제 마감 시점의 날짜에 별도로 표시한다. start=end는 기간이 아닌 단일 시점이다. 날짜만 있는 기간은 시작일과 마지막 날짜를 모두 포함한다.

혼합 정밀도의 외국 일정은 원본 날짜 기준임을 표시한다. 시간을 모르는데 한국 날짜로 정밀 변환했다고 표현하지 않는다. 이 규칙은 marker와 상세에 똑같이 적용한다.

### 7.3 현재 상태와 완료

계산 상태는 저장하지 않고, 일정 값·현재 시각·등록·완료 상태로 계산한다. 후보와 완료 표시가 우선하며, 나머지는 ‘예정’, ‘접수 중’, ‘기간·시간 확인 필요’, ‘마감 지남’, ‘행사 종료·완료 확인 필요’로 구분한다.

정확한 접수 중은 `start <= now < due`로 판단한다. 시간이 없는 마감은 원본 timezone의 해당 날짜까지 ‘오늘 마감·시간 미확인’, 다음 날짜부터 ‘마감일 지남’이다. 행사 시작이 지났다고 마감 초과로 표시하거나 자동 완료하지 않는다.

마감 임박은 마감 날짜까지 0~3 calendar days인 미완료 확정 일정의 추가 표시다. 정확한 마감이 이미 지났으면 임박 표시 대신 마감 경과를 적용한다. 계획과 실제 수행 실적은 별개이며, 현행 모델에 없는 완료 일시를 `updatedAt`으로 대신하지 않는다.

## 8. 기존 달력의 조회 계약

| 역할 | 원본 | 표시 |
|---|---|---|
| PLAN | plannedDate | 내가 처리할 날 |
| WINDOW | windowStart~due | 접수기간, 시작·종료 구분 |
| DEADLINE | due | 마감 |
| EVENT | eventStart와 선택적 eventEnd | 시험·행사 |
| UNDATED | 모든 날짜 null | 달력의 날짜 미정 목록 |

월 marker와 날짜 상세는 동일한 projection 결과를 사용한다. 입력은 snapshot·표시 월·현재 시각·필터이며, 결과에는 원본 taskId와 날짜별 역할을 포함한다. 범위 밖 기간은 렌더링 전에 잘라낸다.

같은 날짜에 계획일과 마감일이 겹치면 상세 한 행에 ‘계획·마감’을 붙인다. 일정 수는 날짜별 고유 taskId 수이며 역할 수를 합산하지 않는다. 기존 기록 marker는 각 기록의 의미를 유지하고 일정 수와 혼합하지 않는다.

기본값은 **확정 일정 + 후보 표시**다. 후보는 점선과 ‘후보’ 문구로 구분하고 색상만으로 상태를 전달하지 않는다. 수량은 ‘확정 2 · 후보 1’처럼 구분한다. ‘확정만’ 필터를 제공하고, 날짜 미정 목록도 같은 필터를 따른다. 출처 미확인인 확정 일정에는 별도 상태 문구를 붙인다.

기존 생성일~마감일 반복 노출은 일정 상세에서 제거한다. 이는 의도적인 동작 변경이다. 날짜 없는 기존 Task는 체크리스트와 날짜 미정에서 계속 조회한다. 체크리스트의 실행 대상과 완료 집계에는 확정 Task만 포함하고, 후보는 달력·후보 필터·날짜 미정에서 검토한다. 기존 Task는 전환 시 확정 상태이므로 조회 대상에서 빠지지 않는다.

완료 Task는 원래 일정 날짜에 완료 표시를 유지하며 선택적으로 숨길 수 있다. 완료 때문에 기간을 줄이지 않는다. 삭제된 Task는 모든 역할·목록에서 제외한다. 후보와 단순한 미래 일정은 수행 실적으로 집계하지 않으며 기존 메모·운동·금융 표시도 보존한다.

클릭한 일정은 같은 Task 상세에서 계획일, 공식 일정, 원본 timezone, 출처, 확인 상태, 저장·동기화 상태를 보여준다.

## 9. 입력 계약 — ImportActionBatchV1

### 9.1 형식

이 계약은 아직 구현·배포되지 않았다. 이전 초안의 `UpsertActionCommandV1` 명칭을 사용하지 않는다. ‘가져오기’는 생성 또는 기존 일정 찾기이며, 기존 항목 수정·삭제·복원 명령을 포함하지 않는다.

| 경로 | 형식·필수 여부 |
|---|---|
| schemaVersion | 필수. `personal-os.action-import.v1` |
| requestId | 필수, 비어 있지 않은 문자열. 요청 추적용이며 일정 식별자가 아님 |
| items | 필수 배열, 1~100개 |
| items[].itemKey | 필수 문자열. 요청 안에서 유일 |
| items[].text | 필수, 앞뒤 공백 제거 후 1~500자 |
| items[].kind | 5절의 enum |
| items[].sourceNamespace, externalKey | 각각 선택적 string 또는 null. 둘 다 존재하거나 둘 다 없음 |
| items[].schedule | 필수 object. timeZone 필수; 나머지 날짜·시간 필드는 선택적 string 또는 null |
| items[].source | 필수 object. type 필수; url, label, excerpt, reportedCheckedAt, dateReference 선택적 또는 null |

schedule의 허용 필드는 `plannedDate`, `dueDate`, `dueTime`, `windowStartDate`, `windowStartTime`, `eventStartDate`, `eventStartTime`, `eventEndDate`, `eventEndTime`, `timeZone`이다.

source.type은 USER_STATEMENT 또는 EXTERNAL_NOTICE다. dateReference가 있으면 `baseDate`와 `timeZone`을 모두 포함한다. reportedCheckedAt은 offset이 명시된 RFC 3339 시각이며 그대로 주장 값으로 보존한다. 현재 근거 확인 기록으로 승격하지 않는다.

생략과 null은 새 제안에서 ‘미상’이라는 같은 의미다. 기존 값을 지우라는 의미가 아니다. 객체의 알 수 없는 필드는 오류로 반환한다. 사용자·기기 ID, 등록·검증 상태, SQL, reminders는 입력받지 않는다. 저장 시 인증·실행 문맥과 사용자 선택으로 상태를 결정한다.

총 입력은 UTF-8 기준 256 KiB 이하로 제한한다. requestId·itemKey는 각 128자, namespace는 80자, externalKey는 256자, URL은 2,048자, label은 200자, excerpt는 2,000자 이내로 제한한다. 문자 수는 Unicode code point 기준이다. URL은 http/https만 허용하고 자동 열기·자동 fetch하지 않는다. 입력은 일반 텍스트로 표시하며 HTML이나 지시문으로 실행하지 않는다.

### 9.2 예시

다음 시험명·날짜·URL은 계약 설명용 가상 데이터다. 실제 공식 일정이 아니다. 생략된 날짜는 null로 정규화한다.

```json
{
  "schemaVersion": "personal-os.action-import.v1",
  "requestId": "sample-import-001",
  "items": [
    {
      "itemKey": "registration",
      "sourceNamespace": "sample-exam",
      "externalKey": "2027:1:registration",
      "text": "예시 시험 1회 접수",
      "kind": "REGISTRATION",
      "schedule": {
        "windowStartDate": "2027-02-01",
        "windowStartTime": "10:00",
        "dueDate": "2027-02-05",
        "dueTime": "18:00",
        "timeZone": "Asia/Seoul"
      },
      "source": {
        "type": "EXTERNAL_NOTICE",
        "url": "https://example.org/sample-exam",
        "label": "예시 공고",
        "excerpt": "접수 2월 1일 10시부터 2월 5일 18시까지",
        "dateReference": null
      }
    },
    {
      "itemKey": "exam",
      "sourceNamespace": "sample-exam",
      "externalKey": "2027:1:exam",
      "text": "예시 시험 1회 응시",
      "kind": "EXAM",
      "schedule": {
        "eventStartDate": "2027-03-07",
        "eventStartTime": "10:00",
        "timeZone": "Asia/Seoul"
      },
      "source": {
        "type": "EXTERNAL_NOTICE",
        "url": "https://example.org/sample-exam",
        "label": "예시 공고",
        "excerpt": "시험 3월 7일 10시, 종료 시각 미확인"
      }
    }
  ]
}
```

등록 후 2월 1~5일은 접수기간, 2월 5일은 마감, 3월 7일은 시험으로 표시한다. 사용자가 계획일을 2월 2일로 추가하면 접수 Task의 PLAN 역할이 더해진다. 접수와 응시의 완료는 독립이다.

### 9.3 검증·저장·결과

상위 JSON, 버전, 용량, 중복 itemKey 오류는 배치 전체를 거부한다. 같은 배치의 정규화된 외부 식별자가 중복되면 해당 항목들을 검토 대상으로 돌려 저장 전에 하나를 선택하게 한다. 나머지는 항목별 오류를 보여주고 유효한 항목을 사용자가 선택해 저장한다. 전체가 저장된 것처럼 부분 성공을 숨기지 않는다. 저장 직전에 현재 로컬 revision을 다시 확인하고, 미리보기 이후 변경된 항목은 다시 검토한다.

기존 행을 찾은 항목에는 현재 등록 상태를 표시한다. 재입력만으로 후보를 확정하거나 검증 상태를 바꾸지 않는다. 사용자가 원하면 그 행의 별도 편집 동작으로 처리한다.

항목 결과는 `itemKey`, `taskId`, `outcome`, `registrationState`, `syncState`, `issues[]`다. issues는 code·fieldPath·message를 가진다.

| 구분 | 값·의미 |
|---|---|
| outcome | CREATED, MATCHED, REVIEW_REQUIRED, DELETED_MATCH, REJECTED |
| registrationState | 실제 저장 행의 CANDIDATE/CONFIRMED. 행이 없으면 null |
| syncState | LOCAL_ONLY, PENDING, SYNCED, ERROR. 행이 없으면 null |
| 대표 오류 | INVALID_DATE, INVALID_RANGE, TIME_AMBIGUOUS, INVALID_COMBINATION, UNSUPPORTED_FIELD, IDENTITY_REQUIRED, LOCAL_SAVE_FAILED |

outcome과 syncState를 혼동하지 않는다. CREATED는 로컬 생성이고 SYNCED는 해당 revision의 서버 반영 확인이다. REVIEW_REQUIRED는 기존 행을 변경하지 않았다는 의미이며, taskId가 있으면 현재 행의 상태를 반환한다. 연결된 행이 없으면 taskId와 상태는 null이다. 변경 경고가 있어도 기존 행의 저장 성공을 새 제안의 저장 성공으로 표시하지 않는다.

## 10. 중복·재입력·오프라인 생성

### 10.1 식별 범위

동일 행동은 `(user_id, source_namespace, external_key)`로 찾는다. 접수와 시험처럼 별도 행동은 다른 key다. 이 유일성은 tombstone에도 적용한다.

namespace는 사용자가 검토한 소문자 ASCII 식별자로 제한하며 형식은 `[a-z0-9][a-z0-9._-]{0,79}`다. 중앙 registry를 새로 만들지 않는다. externalKey는 앞뒤 공백 제거와 Unicode NFC 정규화 후 비어 있지 않아야 하며 내부 공백·대소문자를 보존한다. 길이 제한은 정규화 후 적용한다. 제목·URL·날짜 변경만으로 key를 바꾸지 않는다.

**중복 방지 보장은 같은 식별자를 재사용할 때 적용된다.** GPT가 매번 다른 key를 만들면 의미상 동일한 일정까지 자동 판별하지 못한다. 미리보기에서 기존 식별자를 재사용하게 하고, 유사 제목은 연결 제안에만 쓴다.

외부 식별자가 없거나 모호하면 기존 Task 연결 또는 독립 일정 생성을 사용자가 선택한다. 독립 생성은 UUID 기반 일반 Task이며 외부키 기반 기기 간 중복 보장 대상이 아니다. 식별자를 기존 행에 자동 덧씌우지 않는다. 저장된 외부 식별자는 변경하지 않으며 잘못된 연결은 기존 Task를 명시적으로 삭제하고 올바른 key로 새로 만든다.

### 10.2 같은 계정의 동시 생성

계정이 확인된 기기에서는 정규화된 소유 범위·외부 식별자로 같은 UUIDv5를 만든다. 제목·날짜·URL은 ID 입력에 포함하지 않는다. 일반 수동 Task의 ID 생성 방식은 유지한다.

고정 UUID namespace, 구조화된 문자열 인코딩, 계정 식별 형식은 S0에서 고정하고 모든 플랫폼의 공통 golden fixture로 검증한다. 임의 문자열 연결로 구분자 충돌을 만들지 않는다. ID의 owner·외부 식별자가 예상과 다르면 덮어쓰지 않고 오류로 처리한다.

이 방식을 유지하는 이유는 오프라인 양 기기의 같은 외부키가 같은 Task를 참조하도록 하기 위해서다. 임의 UUID와 서버 유일성만 사용하면 충돌 후 ID·참조 재연결이 추가로 필요하다. 결정적 ID도 **내용 덮어쓰기 방지 수단은 아니므로** 아래 전용 경로가 필요하다.

### 10.3 최초 생성과 수정의 분리

`ENSURE_ACTION`은 외부키가 있는 새 Task를 위한 내부 pending operation이다. Supabase에서 **INSERT 또는 기존 행 반환**으로 처리하고, 충돌 시 UPDATE하지 않는다. 이 의미를 기존 transport와 전용 DB 함수 중 어디에 둘지는 S0에서 동시성 검증 후 확정한다. 일반 앱의 관리자 권한·별도 서버는 요구하지 않는다.

Task와 pending operation을 같은 로컬 snapshot에 저장한다. operation에는 최초 전송 payload와 그 revision을 보존한다. 이후 편집을 최초 생성 payload에 섞어 재시도하지 않는다. 전체 sync·fallback을 포함한 모든 전송 경로에서 ENSURE_ACTION을 일반 upsert로 우회시키지 않는다.

| 상태 | 다음 처리 |
|---|---|
| 미전송 또는 응답 유실 | 같은 식별자·최초 payload로 재시도 |
| 서버의 생성 확정값이 최초 제안과 일치 | 최초 revision만 확인 처리. 후속 로컬 편집은 별도 대기로 유지 |
| 서버의 기존 행 내용이 다름 | 원격값·로컬 제안을 모두 보존하고 검토 대기. 자동 후속 수정 금지 |
| 서버에 tombstone 존재 | 자동 복원 금지. 삭제 상태와 로컬 제안을 함께 검토 |
| 로컬 편집·삭제가 진행 중인데 늦은 응답 도착 | 현재 revision 확인. 응답으로 최신 로컬 변경을 되돌리지 않음 |

검토 대기는 재시작 후에도 유지한다. 원격값과 다른 로컬 제안을 하나의 Task에 차례로 덮어써서 한쪽을 잃지 않는다. 검토 전까지 동기화 완료로 표시하지 않는다.

### 10.4 재입력과 local-only 계정 전환

같은 key·같은 내용은 기존 Task 반환, 다른 내용은 차이 검토다. 사용자의 계획일·완료·직접 수정값을 재입력으로 초기화하지 않는다. 삭제된 key는 DELETED_MATCH이며 복원은 별도의 명시적 편집으로 같은 ID에 수행한다.

가져온 변경을 적용할 때는 바뀔 필드만 선택해 사용자 편집으로 저장한다. 기존 수동 동시 편집에는 행 단위 LWW가 적용되므로 서로 다른 필드의 동시 수정이 모두 보존된다고 보장하지 않는다.

인증 이력이 없는 local-only 환경은 저장된 로컬 소유 범위를 사용한다. 같은 저장소 안에서는 재입력을 식별할 수 있지만, 다른 기기와의 동일 계정 수렴은 계정 연결 이후에 성립한다. 로그인만으로 데이터를 자동 이관하지 않는다.

사용자가 계정 가져오기를 선택하면 외부키 일정의 ID, Task 참조, pending operation을 한 저장 단위로 전환한다. 기존 원격 행은 위 ENSURE_ACTION 규칙으로 조정한다. 전환 실패 시 이전 snapshot과 대기열을 유지한다. 다른 계정의 데이터는 자동 재귀속하지 않는다. 이 경로는 S2 필수 검증이며 초기 로컬 시연 성공으로 완료 처리하지 않는다.

## 11. 동기화·보안·실패 처리

| 계층 | 구현 시 필수 연결 |
|---|---|
| 로컬 | 새 필드 정규화, pending operation·검토 대기 보존, 계정 범위, 저장 실패 |
| Task service | 날짜·상태·종류 조합, 출처 확인 해제, 식별자 보호 |
| mapper | 새 필드의 로컬↔원격 왕복 보존 |
| Push | ENSURE_ACTION과 일반 수정 분리, device FK 순서, revision별 확인 |
| Pull·merge | 전체·증분 조회 모두에서 미확정 편집·검토 대기 보호 |
| Realtime | Task 변경 수신 후 공통 projection 갱신 |
| 복구 | 응답 유실, 부분 실패, cursor 초기화, 재시작, schema 미적용 |
| DB | owner, 날짜·상태 불변식, 외부키 유일성, 권한, 기존 LWW와 변경 피드 호환 |

Task는 기존 테이블이므로 컬렉션을 추가하지 않고 기존 tasks 변경 피드를 사용한다. 신규 필드가 mapper 또는 normalizer 한 곳에서 빠지면 저장·동기화 중 손실되므로 왕복 검증을 포함한다.

Task와 대기열을 한 snapshot으로 저장하는 것과 여러 창의 동시 쓰기를 안전하게 병합하는 것은 별개다. importer는 공통 저장 경로를 사용하며, Quick Capture·다른 탭·sync와 겹칠 때 오래된 전체 snapshot으로 최신 변경을 덮지 않아야 한다. S0에서 현재 쓰기 조정 경로를 확인하고 공통 단일 writer 또는 플랫폼에서 검증한 동시성 제어를 선택한다. 현재 adapter의 한 번의 setItem만으로 이 조건을 충족했다고 판단하지 않는다.

원격 owner는 인증 세션에 묶는다. RLS와 API 접근 권한은 별개로 확인하며, 필요한 SELECT·INSERT·UPDATE만 부여한다. 입력 JSON을 권한 근거로 사용하거나 앱에 service-role key를 넣지 않는다. [Supabase RLS 안내](https://supabase.com/docs/guides/database/postgres/row-level-security), [명시적 테이블 권한 변경 안내](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

공통 service의 입력 검증과 DB 제약은 각각 필요하다. DB는 owner·유일성·기본 날짜 조합을 강제하고, 앱은 상세 사용자 오류·표시·검토 흐름을 제공한다. 불변 외부 식별자와 출처 확인 메타데이터의 쓰기 경계도 DB 정책 또는 전용 쓰기 경로에서 검증한다.

부분 실패 시 확인된 operation만 해제한다. 실패·충돌·미확정 항목은 대기열에 남기고 재시도 또는 검토를 제공한다. 로그에는 원문 전체 대신 requestId, itemKey, Task ID, 오류 코드를 사용한다.

## 12. 데이터 전환·호환성·복구

기존 Task는 kind=TASK, registrationState=CONFIRMED, origin=MANUAL, sourceType=USER_STATEMENT, verificationStatus=USER_PROVIDED로 정규화한다. ID·내용·날짜·완료·tombstone을 보존하며 외부 검증 이력을 만들어내지 않는다. 기존 시간은 Asia/Seoul로 해석하되 다른 시간대 사용 근거가 발견되면 전환을 멈추고 확인한다.

현행 localStorage normalizer는 알 수 없는 필드를 버릴 수 있다. envelope의 version 숫자만 올려서는 구버전 실행을 막을 수 없다. 다음 전환을 설계한다.

1. 새 저장 key `localsyncmemo:snapshot:v2`를 사용한다. v1은 원본 복구 사본으로 보존한다.
2. v2가 없을 때만 v1을 읽어 메모리에서 변환·검증한다. Task뿐 아니라 기존 모든 컬렉션·sync 상태를 보존한다.
3. v2 저장과 재읽기 검증이 끝나기 전에는 전환 성공으로 처리하지 않는다. 용량 부족·손상 시 v1을 유지하고 오류를 표시한다.
4. v2가 있으면 v1을 다시 자동 병합하지 않는다. v2 손상을 발견하면 조용히 과거 v1로 돌아가지 않고 복구 상태를 표시한다.
5. 새 앱은 v1에 역으로 쓰지 않는다. v2 이후의 변경은 오래된 v1 사본만으로 복원할 수 없음을 복구 안내에 명시한다.

key 분리는 로컬 파일 형식 충돌을 줄일 뿐이다. **구버전 바이너리 실행과 구버전의 원격 쓰기를 기술적으로 차단했다고 주장하지 않는다.** 첫 릴리스는 사용 중인 모든 기기의 호환 버전 전환을 완료한 단일 사용자 운영을 전제로 한다. 혼용이 필수 요구가 되면 서버의 capability/version 기반 쓰기 통제를 별도 설계해야 한다.

배포 순서는 백업·복구 검증 → 추가형 DB migration → 호환 클라이언트 전환 → 동기화 검증 → 기능 사용이다. 원격 schema가 미적용이면 로컬 데이터와 pending operation을 유지하고 동기화 오류를 표시한다. 구버전 payload로 축소해 보내지 않는다.

롤백 시 신규 입력과 관련 원격 쓰기를 먼저 중지하고 최신 v2 데이터를 보존한다. 새 컬럼을 삭제하거나 오래된 v1로 자동 복귀하지 않는다. 검증한 복구 절차 또는 수정 버전으로 전진 복구한다.

## 13. 후속 확장의 경계

첫 릴리스의 구현 범위에 다음 기능의 테이블·UI·plugin을 선행 추가하지 않는다.

| 확장 | 다음 설계에서 지켜야 할 조건 |
|---|---|
| Reminder | Task 1:0..N 자식. WINDOW_START, DUE, EVENT_START, EVENT_END, ABSOLUTE 기준을 구분 |
| 알림 시간 | 정확한 시각의 분 offset과 날짜 기준 전날 오전 9시를 구분. 날짜만 있고 사용자 시각 정책도 없으면 예약하지 않음 |
| 알림 저장 | 상대 알림 계산값은 파생값. 원본 규칙과 중복 동기화하지 않음 |
| Reminder sync | 새 컬렉션의 normalizer·mapper·pending·merge·전체/증분 pull·변경 피드·Realtime·LWW·RLS·동일 owner 부모 FK 모두 연결 |
| 기기 예약 | 수정·완료·삭제·후보 전환·로그아웃 시 예약 조정. 발송 기록과 규칙 revision으로 재예약 중복 방지 |
| 전달 한계 | 해당 기기에 이미 수신·예약된 알림과, 종료 중 원격에서 새로 생성·변경된 일정을 구분 |
| MCP | 기존 application service를 재사용하되 인증·실행 권한·endpoint·재시도·실제 결과 반환을 추가 검증 |
| Source Monitor | 변경 감지와 제안 생성의 별도 기능. 기존 사용자 일정을 자동 덮어쓰지 않음 |

Tauri 모바일 예약과 데스크톱 즉시 알림은 실행 모델이 다르다. Android 일반 종료·강제 중지·재부팅·절전·권한 철회는 각각 실기기 검증해야 한다. Windows 앱 완전 종료나 Web 탭 종료 중의 알림은 이 로컬 설계로 보장하지 않는다. [Tauri notification API](https://v2.tauri.app/reference/javascript/notification/#schedule), [Android 알람 가이드](https://developer.android.com/develop/background-work/services/alarms)

기기별 수신 설정은 가능하지만 전체 기기에서 정확히 한 번 전달된다고 보장하지 않는다. 원격 변경을 받지 못한 기기의 옛 예약도 즉시 취소할 수 없다. 이 요구는 remote push/background sync의 별도 검토 대상이다.

ChatGPT 연결은 계정·워크스페이스 정책·실제 연결 환경을 확인하고 진행한다. 특정 요금제의 쓰기 가능 여부를 이 설계에 고정하지 않는다. [OpenAI MCP 연결 안내](https://developers.openai.com/plugins/deploy/connect-chatgpt)

## 14. 구현 순서와 미결정 게이트

이번 문서 검토에서는 아래 작업을 실행하지 않는다. 계층별로 모델만 대량 추가하기보다 사용자 흐름이 끝까지 연결되는 단위로 구현한다.

| 단계 | 단일 결과물 | 범위 | 종료 기준 |
|---|---|---|---|
| S0 계약·동기화 위험 확인 | 구현 가능한 계약 고정 | UUID namespace·인코딩, ENSURE_ACTION transport/DB 함수 선택, sync fallback·다중 창 저장 점검, 전환·복구 계획 | 동시 INSERT·응답 유실·로컬 writer 검증 방식과 공통 identity fixture 확정. 미해결 P1 없음 |
| S1 로컬 일정 통합 | 붙여넣기부터 기존 달력까지 | 최소 Task 확장, parser, 검토·저장, local-only pending, projection, 날짜 미정, 기존 Task 보존 | 예시 접수·시험 입력 → 달력 → 편집 → 재시작 전체 흐름 통과 |
| S2 기기 간 일관성 | 두 기기의 같은 일정 | DB·mapper·ENSURE_ACTION·증분/전체 sync·Realtime·계정 가져오기 | 중복·삭제·응답 유실·후속 편집·계정 분리 검증 |
| S3 첫 릴리스 검증 | 사용할 수 있는 일정 통합 | 모든 플랫폼 검증, 구버전 종료·전환, 백업·복구, 회귀 | R1~R8과 아래 C01~C22 통과, 남은 제한 명시 |
| S4 이후 | 필요한 확장별 결과물 | 알림 → 필요 시 MCP·모니터·Radar·외부 캘린더 | 기능별 새 설계·수용 기준·실행 증거 |

S0는 전체 구현 승인을 다시 받기 위한 절차가 아니라 데이터 손실을 막기 위한 구현 전 기술 확인이다. 아직 선택하지 않은 transport 방식과 identity 상수를 구현 완료처럼 숨기지 않는다. S1은 로컬 기능 검증 경계이며, 기기 간 통합 완료를 주장하는 경계는 S3다.

| 남은 위험 | 대응과 판정 기준 |
|---|---|
| GPT가 다른 key를 만들거나 잘못 연결 | 미리보기에서 key·기존 항목 표시. 의미 기반 완전 중복 제거는 보장하지 않음 |
| 최초 생성 경로가 기존 fallback에서 upsert로 바뀜 | 모든 전송 진입점의 ENSURE_ACTION 불변식 검증 후 S2 종료 |
| local-only 데이터의 계정 전환 중 중단 | ID·참조·대기열 동시 저장과 실패 복구 테스트 |
| 구버전 클라이언트가 다시 접속 | 혼용 미지원 명시, 전 기기 전환 확인. 필요 시 별도 서버 버전 통제 설계 |
| 수동 다기기 동시 수정 | 기존 행 LWW의 한계 명시. 필드별 병합은 후속 요구가 있을 때 도입 |

## 15. 수용 기준과 추적

아래는 **구현 후 통과해야 하는 기준**이다. 이 문서에서는 모두 미실행이다.

| ID | 요구 | 시나리오와 통과 조건 | 단계 |
|---|---|---|---|
| C01 | R1,R7 | 기존 snapshot 전환 후 모든 컬렉션·Task ID·날짜·완료·tombstone·sync 대기 보존 | S1,S3 |
| C02 | R2,R3 | 예시 JSON이 접수·시험 두 Task로 저장되고 근거가 보존 | S1 |
| C03 | R2,R3 | 상대 날짜 기준·시간 미상은 추측 없이 근거 또는 null로 처리. 날짜 미정에서 조회 | S1 |
| C04 | R3 | 잘못된 날짜·역전 기간·종류 조합·DST 모호 시각은 해당 항목 저장 거부 | S1 |
| C05 | R2 | JSON으로 검증·승인·owner 위조 불가. 미확인 외부 일정 등록 후에도 출처 유지 | S1 |
| C06 | R6 | marker와 상세 일치, 한 Task의 여러 역할 중복 집계 없음. 후보 수 별도 | S1 |
| C07 | R3,R6 | 월 경계·자정 종료·시간 미상·혼합 정밀도·해외 시간대 배치가 7절과 일치 | S1 |
| C08 | R1,R6 | 생성일부터 미래 일정일까지 반복 노출 없음. 날짜 없는 기존 Task는 계속 조회 | S1 |
| C09 | R4 | 같은 key 재입력 시 새 행 없음. 사용자 내용·계획일·완료 유지 | S1,S2 |
| C10 | R4,R5 | 같은 계정 두 기기의 오프라인 동일 key 생성이 Task 하나로 수렴. 내용 다르면 검토 | S2 |
| C11 | R4,R5 | 최초 생성 응답 유실 후 재시도에서 중복·기존 값 덮어쓰기 없음 | S2 |
| C12 | R4,R5 | 생성 대기 중 편집·삭제·늦은 응답·재시작에서 최신 로컬 변경과 원격 차이 보존 | S2 |
| C13 | R4 | 삭제한 key 재입력은 자동 복원 없음. 명시적 복원은 같은 ID | S2 |
| C14 | R2,R5 | 저장 실패를 성공으로 표시하지 않음. 항목·대기열 동시 저장, Quick Capture·다른 탭·sync 동시 쓰기에서도 최신 변경 보존 | S1,S2 |
| C15 | R5 | 부분 sync 실패·cursor 복구·전체 fallback에서도 미확정 변경 보존, ENSURE_ACTION 우회 없음 | S2 |
| C16 | R5,R6 | 다른 기기의 완료·삭제·변경 수신 후 모든 달력 역할·상세·미정 목록 일치 | S2 |
| C17 | R5 | 계정 변경 시 대기열 혼입 없음. 원격 타 사용자 조회·쓰기 거부 | S2 |
| C18 | R4,R5 | local-only 계정 가져오기에서 ID·참조·대기열 일괄 전환, 중단 시 복구 가능 | S2 |
| C19 | R7 | schema 미적용·저장 공간 부족·v2 손상·구버전 혼용을 정상 동기화로 표시하지 않음 | S3 |
| C20 | R1,R6 | 체크리스트·메모·운동·금융 회귀 없음. 후보·미래 계획이 수행 실적으로 집계되지 않음 | S3 |
| C21 | R8 | Windows Tauri·Web·Android의 붙여넣기→검토→저장→달력 조회 통과 | S3 |
| C22 | R1~R8 | typecheck·관련 unit/integration·build 통과. RLS·다기기·플랫폼 검증은 별도 증거 첨부 | S3 |

앱 자동화 테스트만으로 원격 RLS 또는 실기기 동작을 대체하지 않는다. 후속 알림은 예약 성공과 실제 전달을 별도 기준으로 검증한다.

## 16. 구현 대상과 이번 검토의 증거

| 책임 | 구현 시 주요 대상 |
|---|---|
| 모델·저장 | src/types/entities.ts, src/lib/storage/localStorageAdapter.ts, snapshot 초기화·버전 |
| 입력·편집 | src/features/tasks/, 기록 탭 입력 진입점, 신규 공통 import service |
| 달력 | src/features/records/recordAggregation.ts, RecordCalendar.tsx, RecordsPanel.tsx, 날짜 상세 |
| 동기화 | src/lib/sync/syncState.ts, supabase/rows.ts, mappers.ts, snapshotIo.ts, deltaPush.ts, changeFeed.ts, snapshotMerge.ts, realtime.ts |
| DB | 추가형 migration, tasks 불변식·외부 식별자·최초 생성 경로·권한 |

이 목록은 설계 검토 시 정한 구현 범위다. 후속 구현 결과와 변경 목록은 [구현 검증 기록](../verification/action-calendar-v1.1.md)에서 관리한다.

설계 검토의 코드 근거는 2절의 로컬 HEAD에서 확인했다. 당시 기존 코드의 TypeScript 검사는 통과했으며, 달력·동기화 테스트 4개 파일은 임시 캐시의 EPERM으로 실행 전에 중단됐다. 아래 표는 그 설계 검토 시점의 이력이며 후속 구현 테스트 결과와 구분한다.

관련 기존 테스트는 [recordAggregation.test.ts](../../src/features/records/recordAggregation.test.ts), [RecordsPanel.test.tsx](../../src/features/records/RecordsPanel.test.tsx), [deltaSync.test.ts](../../src/lib/sync/supabase/deltaSync.test.ts), [changeFeedMigration.test.ts](../../src/lib/sync/supabase/changeFeedMigration.test.ts)다. 새 동작에 맞춘 의미 있는 검증을 추가·수정해야 하며, 기존 테스트 통과만으로 C01~C22를 충족하지 않는다.

문서 검수는 제목 계층, 필수 계약·예시의 일치, 요구사항 추적, 상대 링크, JSON 구문을 대상으로 한다. 저장소의 Project Intro/Detail 검증과 Notion dry-run은 이 신규 설계의 기능 검증이나 배포가 아니다.

2026-10-18 Windows/Node 환경에서 수행한 문서 검수 결과는 다음과 같다.

| 검수 | 결과·범위 |
|---|---|
| 이 문서의 구조·참조·예시 검사 | 통과. 본문 16절, 요구사항 8개, 수용 기준 22개, 로컬 링크 18개, JSON 예시 1개·항목 2개 |
| `node .github/project-docs/validate-project-docs.mjs --config project-docs.config.json --require-tracked` | 통과, 오류·경고 0. 설정된 기존 소개·상세 문서 대상 |
| `node .github/project-docs/sync-project-docs-to-notion.mjs --config project-docs.config.json` | 로컬 dry-run 통과. 외부 Notion 쓰기 없음 |
| 앱·DB·실기기 검증 | 이번 문서 수정에서 실행하지 않음. 신규 기능은 미구현 |
