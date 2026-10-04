# Personal-OS | Project Detail

2026-10-05 (Asia/Seoul) 갱신. Primary source boundary는 [main@687c735](https://github.com/Yeon-sik/Personal-OS/tree/687c7358de760f90fd467ecd36d15915163154e4)이다. source 설명과 실제 검증 결과를 구분한다. [빠른 소개](./Project_Intro.md)를 참고한다.

## 1. 문서 목적과 범위

Tauri v2·React 기반 개인 기록 앱이다. 메모·할 일·건강 요약·프로젝트·워크스트림을 local snapshot에 보존하고 설정된 Supabase와 지원 기록을 동기화한다.

하나의 snapshot commit 경계에 local CRUD를 모으고 local hydrate를 Auth보다 먼저 수행한다. 상세 금융·운동은 도메인 앱에 남기며 요약·타임라인과 프로젝트 문맥을 연결한다.

- 최근 main에는 Home·Records·Projects·Settings 네 탭, 건강 날짜·drill-down, 공유 Fitness 운동 요약 복원과 체중·영양 표시, 런처 아이콘이 포함된다.

미병합 branch, 사용자 미커밋 작업과 명시하지 않은 운영 검증은 기능 완료 근거에 포함하지 않는다.

## 2. 시스템 아키텍처

```text
src/app/App -> Home / Records / Projects / Settings
  -> useLocalSyncMemo facade
     -> useMemoSyncRuntime + useSnapshotStore
     -> domain action hooks -> commitSnapshot
  -> localStorage StorageAdapter
  -> LocalOnlySyncClient 또는 SupabaseSyncClient
     -> row mapper / snapshot I/O / LWW / Realtime / presence
Project Workspace / workstreams -> snapshot
Knowledge Vault -> Tauri filesystem Markdown projection
DB Editor -> 별도 온라인 PAT·PK-scoped query/update
Fitness v2 + legacy v1 / meal / weight -> 읽기 모델
CashOS finance_summary_daily -> read-only
Tauri Rust -> tray / shortcut / autostart / native commands
```

## 3. 데이터 모델과 불변식

- local snapshot을 먼저 복원한다. 로컬 읽기 실패 시 remote pull이나 빈 snapshot 덮어쓰기를 진행하지 않는다.
- notes/tasks/fitness/project/workstream/knowledge action은 공통 commitSnapshot을 통과한다.
- LWW는 updatedAt을 비교하고 같으면 tombstone을 우선한다. 계정이 바뀌어도 local data를 다른 owner에 자동 binding하지 않는다.
- Fitness 상세 운동·세트와 CashOS 원장·손익 계산을 복제하지 않는다.
- summary v2와 v1·meal·weight 경로를 분리하고 unknown/null의 의미를 유지한다.
- DB Editor는 local sync의 일부가 아니다. online/PAT, allowlisted table/PK와 changed-column update의 별도 권한 경계를 적용한다.
- Knowledge Vault filesystem projection과 GitHub 조회는 local snapshot의 소유권을 바꾸지 않는다.

## 4. 핵심 기술 의사결정

### 결정 1. 공통 snapshot과 facade

모듈화해도 useLocalSyncMemo 반환 계약과 저장·병합 경계를 유지한다.

### 결정 2. 로컬 복원이 Auth보다 먼저

과거 Auth 예외가 local hydrate를 막는다는 문서 설명은 현재 source 순서와 맞지 않는다. source는 local read 후 Auth를 확인한다.

### 결정 3. 요약과 관리 도구 분리

관제탑은 도메인 앱 요약을 소비하고 Project Workspace·DB Editor는 자기 입력과 권한을 소유한다.


## 5. 테스트와 검증 전략

| 검사 | 결과 | 근거·환경과 한계 |
| --- | --- | --- |
| 현재 main app-quality CI | 통과 | [Personal OS app quality](https://github.com/Yeon-sik/Personal-OS/actions/runs/37117735584): TypeScript·Vitest·frontend build, Rust fmt/check/test. |
| 설치·운영 | 이번 갱신에서 미실행 | Windows 설치·tray·shortcut·autostart, Vault filesystem·Supabase/RLS·두 계정·다중 기기는 별도 smoke 대상이다. |

이번 문서 변경의 순차 검증 명령은 다음과 같다.

```text
node .github/project-docs/validate-project-docs.mjs --config project-docs.config.json --require-tracked
node .github/project-docs/sync-project-docs-to-notion.mjs --config project-docs.config.json
```

두 번째 명령은 render-only dry run이다. source·required sections·Git tracked links와 렌더링을 검증하며 Notion에 쓰지 않는다. 과거 테스트 수와 운영 상태를 현재 revision의 성공 수치로 재사용하지 않는다. 실제 기기·원격 권한·사용자 흐름은 표에 명시한 환경에서 따로 확인한다.

## 6. 배포·운영·복구

- Frontend gate는 npm run typecheck -> npm test -> npm run build다. native는 Rust와 설치 Windows runtime을 별도 검증한다.
- 공유 DB owner·tombstone과 다른 앱의 상세 schema·migration 소유 경계를 유지한다.
- 동기화 오류와 로컬 읽기 오류를 구분한다. snapshot과 account binding을 확인하고 data·token을 섞어 복구하지 않는다.

**문서 발행**: 검토한 문서를 main에 병합하면 on-main-push workflow가 발행한다. GitHub Environment는 notion-production이고 canonical branch는 main이다. 발행용 token과 page map은 Environment secret으로 관리하고 Git에 넣지 않는다. 신규 연결은 dedicated mirror를 만들고 본문 갱신은 설정된 GitHub Actions 정책을 따른다.

발행은 모든 페이지 preflight 뒤 configured Intro·Detail만 교체한다. 동일 source SHA·fingerprint면 skip하고 일부 실패는 같은 revision을 재실행해 수렴시킨다. 수동 메모와 원본 데이터는 미러 밖에 둔다.

## 7. 한계, 기술 부채, 다음 단계

- CI의 Rust/웹 gate는 Windows 설치 runtime이나 Authenticode 서명을 증명하지 않는다.
- Supabase와 Fitness/CashOS 동일 fixture, localStorage 장기 복구·Vault 파일 동작은 별도 검증한다.
- 다음 우선 작업은 설치 바이너리에서 로컬 복원과 공유 Fitness 요약 표시를 확인하는 것이다.

## 8. 근거와 관련 문서

- [기준 source revision](https://github.com/Yeon-sik/Personal-OS/tree/687c7358de760f90fd467ecd36d15915163154e4)
- [Project Intro](./Project_Intro.md)
- [README](../README.md)
- [현재 아키텍처](adr/2026-08-01-current-architecture.md)
- [Fitness summary v2](FITNESS_SUMMARY_PROJECTION_V2.md)
- [릴리스 준비](RELEASE_READINESS.md)
