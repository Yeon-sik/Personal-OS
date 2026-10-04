# Personal OS | 개인 기록과 프로젝트를 연결하는 로컬 우선 관제탑

Tauri v2·React 기반 개인 기록 앱이다. 메모·할 일·건강 요약·프로젝트·워크스트림을 local snapshot에 보존하고 설정된 Supabase와 지원 기록을 동기화한다.

| 항목 | 내용 |
| --- | --- |
| 문서 갱신 | 2026-10-05 (Asia/Seoul) |
| 기준 소스 | [main@687c735](https://github.com/Yeon-sik/Personal-OS/tree/687c7358de760f90fd467ecd36d15915163154e4) |
| 저장소 | [Yeon-sik/Personal-OS](https://github.com/Yeon-sik/Personal-OS) |
| 범위 | 병합된 main의 source와 명시한 검증 근거. 개발 branch·미커밋 작업은 제외. |

## 1. 30초 요약

Tauri v2·React 기반 개인 기록 앱이다. 메모·할 일·건강 요약·프로젝트·워크스트림을 local snapshot에 보존하고 설정된 Supabase와 지원 기록을 동기화한다.

- 최근 main에는 Home·Records·Projects·Settings 네 탭, 건강 날짜·drill-down, 공유 Fitness 운동 요약 복원과 체중·영양 표시, 런처 아이콘이 포함된다.

## 2. 문제와 해결

**문제**: 기록이 여러 앱·기기에 흩어지면 하루 상태와 프로젝트의 다음 행동을 파악하기 어렵다. 원격 Auth 실패가 로컬 복원을 막으면 개인 데이터 신뢰성도 깨진다.

**해결**: 하나의 snapshot commit 경계에 local CRUD를 모으고 local hydrate를 Auth보다 먼저 수행한다. 상세 금융·운동은 도메인 앱에 남기며 요약·타임라인과 프로젝트 문맥을 연결한다.

## 3. 핵심 기능과 결과

| 영역 | 현재 source에서 확인한 범위 |
| --- | --- |
| 탐색 | 네 탭과 날짜 기반 건강 요약·활동 drill-down. |
| 개인 기록 | 메모·할 일·운동·식사·체중, quick capture, soft delete·undo와 local persistence. |
| Fitness 조회 | 완료 운동 summary v2, 체중·영양 표시와 legacy workout v1 호환 경로. |
| 프로젝트·지식 | 프로젝트·마일스톤·작업·아이디어·이력, 워크스트림, Knowledge Vault Markdown projection과 Project Workspace. |
| 외부 관리 | GitHub 정보와 CashOS 금융 요약 read-only, 별도 온라인 Supabase DB Editor, native tray·단축키·autostart. |

## 4. 검증 현황

| 항목 | 상태 | 근거와 한계 |
| --- | --- | --- |
| 현재 main app-quality CI | 통과 | [Personal OS app quality](https://github.com/Yeon-sik/Personal-OS/actions/runs/37117735584): TypeScript·Vitest·frontend build, Rust fmt/check/test. |
| 설치·운영 | 이번 갱신에서 미실행 | Windows 설치·tray·shortcut·autostart, Vault filesystem·Supabase/RLS·두 계정·다중 기기는 별도 smoke 대상이다. |

위 결과는 연결한 기준 source revision의 증거다. 이번 변경은 문서·게시 설정만 갱신하며 제품 runtime을 새로 검증한 작업으로 설명하지 않는다. 문서 validator, tracked path·link 검사와 Notion render-only dry run을 수행한다. 병합 뒤 반영은 별도 게시 workflow와 source fingerprint로 확인한다.

## 5. 현재 한계와 다음 단계

- CI의 Rust/웹 gate는 Windows 설치 runtime이나 Authenticode 서명을 증명하지 않는다.
- Supabase와 Fitness/CashOS 동일 fixture, localStorage 장기 복구·Vault 파일 동작은 별도 검증한다.
- 다음 우선 작업은 설치 바이너리에서 로컬 복원과 공유 Fitness 요약 표시를 확인하는 것이다.

## 6. 관련 문서

- [프로젝트 상세](./Project_Detail.md)
- [README](../README.md)

Git Markdown이 원본이며 Notion은 생성 미러다. 검토한 문서를 main에 병합하면 on-main-push workflow가 발행한다. 개인 원본과 인증 정보는 게시하지 않는다.
