# Personal-OS | Project Detail

2026-10-30 (Asia/Seoul) 갱신. Primary source boundary는 [main@d1ff789](https://github.com/Yeon-sik/Personal-OS/tree/d1ff789b36268b25ac69b2d2fa68560a0c7367b0)이다. source 설명과 실제 검증 결과를 구분한다. [빠른 소개](./Project_Intro.md)를 참고한다.

## 1. 문서 목적과 범위

Tauri v2·React 기반 개인 기록 앱이다. 메모·할 일·건강 요약·프로젝트·워크스트림·Action Calendar를 local snapshot에 보존하고 설정된 Supabase와 지원 기록을 동기화한다.

local hydrate를 Auth보다 먼저 수행하고 local CRUD를 공통 snapshot commit 경계에 모은다. 상세 금융·운동은 도메인 앱에 남기며 요약·타임라인·일정과 프로젝트 문맥을 연결한다.

2026-10-05 이후 main에는 Action Calendar v1.1, durable incremental sync/change feed, ownership repair·shared table security migration과 Android deadline notification transport/scheduler가 추가됐다. 기존 Task 구조와 사용자 수정·완료·삭제 상태를 재가져오기보다 우선한다.

미병합 branch, 사용자 미커밋 작업과 명시하지 않은 운영 검증은 기능 완료 근거에 포함하지 않는다.

## 2. 시스템 아키텍처

```text
src/app/App -> Home / Records / Projects / Settings
  -> useLocalSyncMemo facade
     -> local hydrate -> snapshot store -> commitSnapshot
     -> Supabase change feed / delta push / reconciliation
Action Calendar
  -> action import / identity / ownership
  -> confirmed + candidate schedule projection
Deadline Notifications
  -> effective deadline planner -> scheduler/storage
  -> Tauri Android DeadlineAlarmPlugin
Fitness / CashOS -> read-only summary models
Knowledge Vault -> Tauri filesystem Markdown projection
Tauri Rust -> native commands / Android plugin bridge
```

## 3. 데이터 모델과 불변식

- local snapshot을 먼저 복원한다. 로컬 읽기 실패 시 remote pull이나 빈 snapshot 덮어쓰기를 진행하지 않는다.
- notes/tasks/actions/project/workstream/knowledge 변경은 공통 commit 경계를 통과한다.
- Action import identity와 사용자의 로컬 수정 상태를 분리한다. 재가져오기가 완료·삭제·수정·후보/확정 상태를 조용히 덮어쓰지 않는다.
- LWW는 updatedAt과 tombstone을 구분하고 ownership 변경 중 오프라인 수정도 명시적 reconciliation을 거친다.
- deadline notification은 effective deadline에서 파생한다. 수정·완료·삭제·복원 시 기존 예약을 reconcile하고 payload 교체 시 예약 identity를 보존한다.
- Fitness 상세 운동·세트와 CashOS 원장·손익 계산을 복제하지 않는다.
- shared Supabase table은 owner/RLS/GRANT 경계를 유지하며 migration history를 재작성하지 않는다.

## 4. 핵심 기술 의사결정

### 결정 1. 로컬 복원이 Auth보다 먼저
원격 인증 실패가 개인 기록 열람을 막지 않게 local snapshot을 우선한다.

### 결정 2. Task를 지우지 않는 Action Calendar
기존 Task 의미를 유지하고 일정 projection을 별도 모델로 추가해 후보/확정·import source·사용자 override를 표현한다.

### 결정 3. incremental sync와 ownership-aware reconciliation
전체 snapshot 덮어쓰기 대신 change feed/delta push와 tombstone/ownership 규칙으로 충돌 범위를 줄인다.

### 결정 4. 알림은 파생 상태
알림 자체를 truth로 저장하지 않고 effective deadline과 action 상태에서 예약을 재구성한다.

## 5. 테스트와 검증 전략

| 검사 | 결과 | 근거·환경과 한계 |
| --- | --- | --- |
| 최신 main source 감사 | 저장소 검증 | `main@d1ff789`까지 Action Calendar, deadline notification, sync/RLS source·migration·tests·verification 문서를 확인했다. |
| 자동 검증 | 통과 기록 | merge commit에 Vitest 350개, Rust 46개, typecheck, 웹 build와 GitHub quality 통과가 기록돼 있다. 이번 작업에서 독립 재실행하지 않았다. |
| Android 실기기 | 사용자/저장소 검증 기록 | 2026-10-20 Galaxy A25 데이터 보존 업데이트·알림 도착·설정 화면 증거가 저장소 verification에 있다. 최신 문서 작업에서 재실행하지 않았다. |
| 인증된 Windows↔Android sync | 미검증 | 실제 계정·운영 Supabase에서의 다중 기기 수렴은 별도 검증 대상이다. |

## 6. 배포·운영·복구

- frontend/Rust gate는 저장소의 현재 quality workflow를 따른다.
- Android deadline transport는 OS 예약의 best-effort 특성과 permission/runtime 경계를 분리한다.
- Supabase migration은 forward-only로 유지하고 기존 데이터 초기화나 migration history 재작성을 하지 않는다.
- ownership 전환·offline edit·tombstone 충돌 시 단순 last-write 덮어쓰기로 해결하지 않고 sync state/reconciliation 규칙을 따른다.

**문서 발행**: Git Markdown이 canonical이다. main 병합 후 설정된 project-docs workflow가 검증·발행하며 Notion은 read-only mirror다.

## 7. 한계, 기술 부채, 다음 단계

- Android 기기 한 종류의 알림 검증을 모든 제조사·OS 조합으로 일반화하지 않는다.
- migration 및 security fixture는 운영 Supabase 적용 완료의 증거가 아니다.
- 다음 우선 검증은 인증된 Windows↔Android에서 import→사용자 수정→offline sync→ownership/reconciliation→deadline notification까지 실제 계정으로 확인하는 것이다.

## 8. 근거와 관련 문서

- [기준 source revision](https://github.com/Yeon-sik/Personal-OS/tree/d1ff789b36268b25ac69b2d2fa68560a0c7367b0)
- [Project Intro](./Project_Intro.md)
- [Action Calendar spec](specs/action-calendar-v1.1.md)
- [Action Calendar release verification](verification/action-calendar-release-2026-10-20.md)
- [Android deadline verification](verification/android-deadline-notifications-2026-10-20.md)
- [README](../README.md)
