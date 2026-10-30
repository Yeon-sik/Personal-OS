# Personal OS | 개인 기록과 프로젝트를 연결하는 로컬 우선 관제탑

Tauri v2·React 기반 개인 기록 앱이다. 메모·할 일·건강 요약·프로젝트·워크스트림과 확정·후보 일정을 local snapshot에 보존하고 설정된 Supabase와 지원 기록을 동기화한다.

| 항목 | 내용 |
| --- | --- |
| 문서 갱신 | 2026-10-30 (Asia/Seoul) |
| 기준 소스 | [main@d1ff789](https://github.com/Yeon-sik/Personal-OS/tree/d1ff789b36268b25ac69b2d2fa68560a0c7367b0) |
| 저장소 | [Yeon-sik/Personal-OS](https://github.com/Yeon-sik/Personal-OS) |
| 범위 | 2026-10-30 감사 시점에 병합된 main source와 저장소에 남은 검증 근거. 개발 branch·미커밋 작업은 제외. |

## 1. 30초 요약

Personal OS는 여러 도메인 앱의 상세 데이터를 다시 소유하기보다 개인 기록·프로젝트·일정·요약을 한 관제 화면에 연결하는 local-first 앱이다.

- 10월 main에는 Action Calendar가 추가되어 기존 Task를 유지한 채 확정 일정과 후보 일정을 달력에 통합한다.
- 재가져오기는 사용자 수정·완료·삭제를 덮어쓰지 않도록 identity와 ownership을 보존하고, incremental sync/change feed로 원격 변경을 처리한다.
- Android에서는 effective deadline 기준 D-3·D-2·D-1·당일 로컬 알림을 예약하고 수정·완료·삭제·복원에 따라 reconcile한다.
- Fitness 요약·체중·영양, CashOS 금융 요약과 기존 Home·Records·Projects·Settings 흐름은 도메인 소유권을 유지한 채 소비한다.

## 2. 문제와 해결

**문제**: 기록·할 일·일정이 여러 앱과 기기에 흩어지면 하루 상태와 다음 행동을 파악하기 어렵다. 동기화가 사용자 수정이나 삭제를 덮어쓰거나 Auth 실패가 로컬 복원을 막으면 개인 데이터 신뢰성이 깨진다.

**해결**: local snapshot hydrate를 우선하고 모든 local CRUD를 공통 commit 경계로 통과시킨다. Action Calendar import는 원본 identity와 사용자 override를 분리하며 incremental sync, tombstone, ownership 규칙으로 수렴시킨다.

## 3. 핵심 기능과 결과

| 영역 | 현재 source에서 확인한 범위 |
| --- | --- |
| 탐색 | Home·Records·Projects·Settings 네 탭, 날짜 기반 건강·활동 drill-down. |
| 개인 기록 | 메모·할 일·운동·식사·체중, quick capture, soft delete·undo와 local persistence. |
| Action Calendar | 확정·후보 일정, import, 상세/수정, 기존 Task 보존, 사용자 override와 ownership-aware 재가져오기. |
| 마감 알림 | Android effective deadline 기준 D-3·D-2·D-1·당일 예약과 수정·완료·삭제·복원 reconcile. |
| 동기화 | incremental change feed/delta push, tombstone, legacy ownership repair와 shared table security migration. |
| 외부 요약 | Fitness 완료 운동/체중/영양과 CashOS 금융 요약 read-only 소비. |
| 프로젝트·지식 | 프로젝트·마일스톤·작업·아이디어·워크스트림, Knowledge Vault Markdown projection과 Project Workspace. |

## 4. 검증 현황

| 항목 | 상태 | 근거와 한계 |
| --- | --- | --- |
| 최신 main source | 저장소 검증 | `main@d1ff789`의 Action Calendar, deadline notification, sync/RLS migration, tests와 verification 문서를 대조했다. |
| 2026-10-20 기기 검증 기록 | 저장소 기록 | Galaxy A25 데이터 보존 업데이트·실제 알림 도착 등은 저장소 verification 문서 범위에서 확인된다. 이번 갱신에서 재실행하지 않았다. |
| 자동 검증 기록 | 통과 기록 | merge commit 메시지에 Vitest 350개, Rust 46개, typecheck, 웹 build와 GitHub quality 통과가 기록돼 있다. 독립 재실행은 하지 않았다. |
| Windows↔Android 인증 sync | 미검증 | 실제 인증된 다중 기기 sync와 운영 Supabase/RLS는 이번 문서 갱신에서 새로 검증하지 않았다. |

## 5. 현재 한계와 다음 단계

- 로컬 알림 성공 기록은 제조사·OS별 background 동작 전체를 보장하지 않는다.
- migration/test 존재와 실제 운영 Supabase 적용 상태는 별도다.
- 다음 우선 검증은 인증된 Windows↔Android 환경에서 Action Calendar import→수정→동기화→알림 reconcile과 ownership 이전을 종단 확인하는 것이다.

## 6. 관련 문서

- [프로젝트 상세](./Project_Detail.md)
- [Action Calendar spec](specs/action-calendar-v1.1.md)
- [Action Calendar release verification](verification/action-calendar-release-2026-10-20.md)
- [README](../README.md)

Git Markdown이 원본이며 Notion은 생성 미러다. main 병합 후 설정된 project-docs 정책에 따라 검증·발행한다.
