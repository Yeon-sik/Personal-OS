# Android local deadline notification 검증 — 2026-10-20

> **후속 실기기 결과:** 아래는 최초 구현 시점의 기록이다. 이 APK는 Galaxy A25에서 실제 예약 발송 시 receiver crash가 재현됐다. `ff54ea4`에서 payload 호환성을 수정하고 업데이트·실제 알림 도착·예약 변경을 재검증했다. 최신 결과와 산출물은 [Galaxy A25 실기기 검증 보고서](android-deadline-a25-device-qa-2026-10-20.md)를 따른다. 아래 최초 APK를 배포하지 않는다.

## 범위와 판정

- Baseline: `cffe89df6106eb38a935a4fc938cca22f02fd43b`.
- Branch: `feat/android-deadline-notifications-20261020`.
- 구현 commit: `34b2b50c6102d5f7aa68c27dc7a2b4675759feba`. 아래 검증은 2026-10-20 Windows 개발 환경에서 이 commit에 기록한 코드로 실행했다. 보고서는 후속 docs commit으로 기록한다.
- 코드 구현 및 자동 회귀 검증 완료. **릴리스 판정: BLOCKED — 실기기 알림 검증은 UNVERIFIED이며 main에는 병합하지 않는다.**
- MCP/OAuth 실험의 미커밋 서버 디렉터리와 미적용 migration을 폐기했다. baseline 이후 MCP 전용 커밋이나 운영 배포는 없다. 취소한 migration은 운영 DB에 적용하지 않았다.
- Action Calendar, 기존 Task 모델, import/identity, sync, ownership 및 보안 migration history는 baseline 그대로다. 이번 작업의 DB migration 및 운영 DB 쓰기는 없다.
- ChatGPT 직접 등록, MCP/OAuth, ingestion API, server push, Radar, Windows 알림은 구현 범위에 포함하지 않았다.

## 사용자 흐름과 예약 규칙

Android 앱의 **설정 → 마감 알림**에서 시각을 선택한 뒤 사용을 켠다. 초기값은 비활성, 시각 미지정이다. 설정은 기기별이며 Supabase로 전송하지 않는다.

| 조건 | 동작 |
| --- | --- |
| `registrationState === CONFIRMED`, 미완료, 미삭제 | effective deadline이 있으면 예약 대상 |
| `dueDate` 존재 | `dueDate` / `dueTime` 사용 |
| `dueDate` 없음 + EXAM/EVENT | `eventStartDate` / `eventStartTime` 사용 |
| Candidate, 완료, tombstone, plannedDate-only, window-only | 예약 제외, 기존 소유 예약 취소 |
| D-3, D-2, D-1, D-day | 사용자가 선택한 시각, 각 Action의 `timeZone` 기준으로 하루 한 번 |
| 미래 D-3 이전에 앱 종료 | 미래 네 날짜를 미리 OS에 예약한다. D-4 알림을 추가하지 않는다. |
| 이미 지난 알림 시각 | 새로 예약하지 않는다. native 호출 대기 중 시각이 지난 경우도 다시 확인한다. |
| D-day 알림 시각이 실제 deadline 시간보다 늦음 | 해당 D-day 예약 생략 |
| 날짜만 있고 시간 없음 | 알림 계산에서 해당 날짜의 끝을 cutoff로 사용한다. Task 시간을 생성하거나 저장하지 않는다. |
| DST gap/fold | gap은 앞으로 이동, fold는 먼저 오는 instant 한 번. 테스트로 확인 |
| 잘못된 날짜·시간대 | 추정하지 않고 해당 Action을 제외하고 오류 표시 |

일정 수정·완료·삭제·복원 및 sync/realtime에 따른 snapshot 변경 후 reconcile한다. 로컬 데이터 초기 로드가 끝난 시점과 앱 focus/visible 복귀 시에도 reconcile한다. JS timer로 알림을 발송하지 않는다.

**동작 한계:** Android가 실행·동기화되지 않은 동안 Windows에서 변경한 내용은 Android가 다시 실행되어 수신한 뒤 예약에 반영된다. 서버 push나 백그라운드 sync를 추가하지 않았다. OS에 이미 예약된 미래 알림은 Android 예약 API가 담당하지만, 실제 앱 종료·절전 상태의 전달은 이번 환경에서 관찰하지 않았다.

## 구현과 보존 계약

| 파일 | 책임 |
| --- | --- |
| `src/features/deadline-notifications/deadlinePlanner.ts` | 날짜·시간대 계산, 대상 선별, 결정적 ID 및 충돌 회피, add/cancel/unchanged 계획 |
| `deadlineStorage.ts` | 별도 versioned localStorage 설정 및 예약 ID journal. Task snapshot/pending 키를 수정하지 않음 |
| `deadlineScheduler.ts` | 직렬 reconcile, native pending 대조, 소유 ID만 취소, OS 호출 전 journal 기록, 실패 후 재시도 |
| `tauriDeadlineTransport.ts` | Android Tauri runtime 제한, 알림 플러그인 adapter |
| `useDeadlineNotifications.ts` | 초기화·snapshot 변경·resume 연결, 사용자 요청에서만 권한 신청 |
| `src/components/settings/DeadlineNotificationSettingsSection.tsx` | 시각·사용·권한 상태·오류 표시 |
| `src/app/App.tsx`, `src/components/SettingsPanel.tsx` | 기존 앱에 hook과 설정 영역 연결 |
| `src-tauri/src/deadline_alarm.rs`, `src-tauri/android/DeadlineAlarmPlugin.kt` | Android 정확한 알림 권한 확인 및 사용자 요청에 따른 설정 화면 진입 |
| `scripts/prepare-android-deadline.mjs` | ignored `gen/android`에 tracked Kotlin source와 manifest 권한을 재현 가능하게 반영 |
| Tauri manifest/capability, Cargo/npm lockfiles, Android build script | 플러그인 등록 및 빌드 연결 |

예약 key에는 sync scope, Task ID, 알림 날짜를 포함한다. 재시작해도 저장한 ID를 재사용하며 다른 계정 scope로 전환하면 이전 소유 예약을 취소한다. 다른 기능의 pending ID를 피하고, 소유 ID의 native 내용이 달라졌다면 취소하지 않고 오류로 중단한다. `cancelAll`은 사용하지 않는다.

예약 전 `applied=false` journal을 먼저 저장한다. native 명령 완료 및 pending의 ID/title/body 확인 후에만 applied 상태로 저장한다. 이것은 **native 예약 API와 저장소의 응답 확인**이며 실제 알림 전달 증명은 아니다. 중간 실패·프로세스 중단은 다음 reconcile에서 같은 소유 ID를 취소·재예약하여 회복한다. 손상된 소유권 기록이나 설정은 덮어쓰거나 삭제하지 않는다.

기존 Task ID, content revision, 사용자 수정, 완료, tombstone, local snapshot, pending conflict 및 local-only Action 저장 구조는 변경하지 않았다. UI는 DB에 직접 쓰지 않는다.

## native 선택 및 권한

- JS/Rust 알림 플러그인을 `2.3.3`에 고정했다. baseline의 Rust Tauri `2.11.2`를 유지하기 위한 호환 버전이다. JS API도 baseline lockfile 버전 `2.11.0`으로 고정하여 의도하지 않은 Tauri 2.12 업그레이드를 막았다.
- 날짜 계산은 `@js-temporal/polyfill@0.5.1`을 사용한다.
- Android `POST_NOTIFICATIONS`와 `SCHEDULE_EXACT_ALARM` 모두 확인한다. 권한이 없으면 사용 상태로 표시하지 않는다. 자동 reconcile에서는 권한을 재요청하지 않는다.
- 정확한 알림 설정은 사용자의 버튼 조작에서만 연다. Kotlin bridge는 권한 처리만 하며 별도 scheduler를 만들지 않았다.
- Rust 권한 command는 공식 알림 플러그인처럼 async로 실행하여 native 응답 대기로 UI 스레드를 막지 않도록 했다.
- `Schedule.at(date, false, true)`로 일회성·idle 허용 예약을 전달한다. 실제 절전 정책에 따른 전달 시각은 실기기 확인이 필요하다.
- pinned 2.3.3의 Android `show/notify` 경로는 예약을 pending 저장소에 추가하지 않는다. 해당 버전의 `batch` 명령과 `sourceJson`을 사용하여 await 및 pending 확인이 가능하도록 adapter를 구성했다. 이 내부 명령 호환성은 버전 고정과 adapter 테스트로 제한한다.
- Tauri desktop의 schedule 동작은 즉시 알림이므로 Windows와 일반 모바일 브라우저에서는 native 알림 API를 호출하지 않는다.
- APK에 `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` 및 `DeadlineAlarmPlugin`, notification plugin/restore receiver가 포함된 것을 확인했다. 패키징 증거이며 실행 증거는 아니다.
- pinned plugin의 boot restore 구현에는 기기가 꺼진 동안 놓친 예약을 재부팅 후 catch-up하는 경로가 있다. 앱 reconcile의 과거 예약 제외 규칙과 별개인 native 동작이다. 재부팅 후 전달·중복 여부는 UNVERIFIED이며 엄격한 재부팅 catch-up 금지를 보장하지 않는다.

참고: [Tauri notification plugin](https://v2.tauri.app/plugin/notification/), [JavaScript API](https://v2.tauri.app/reference/javascript/notification/). 호환 adapter 판단은 실제 설치한 2.3.3의 Android source와 JS package를 기준으로 했다.

## 실행한 검증

| 검증 | 결과 |
| --- | --- |
| `npm.cmd test` | **PASS — 52 files / 349 tests**. 기존 317개와 새 알림 테스트 32개 포함 |
| Action import/migration/sync/ownership, 기존 Task/Records/calendar, shared RLS PostgreSQL integration tests | 위 전체 Vitest에서 PASS. 운영 DB나 실기기 sync를 대신하지 않음 |
| 새 알림 테스트 | 25 planner/scheduler + 4 native adapter + 3 설정 UI 테스트 PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build` | PASS. 기존 대형 chunk 경고 있음 |
| `cargo check --lib` | PASS |
| `npm.cmd run tauri:build` | PASS — Windows x64 NSIS 생성. 기존 dead-code 경고 3개 |
| `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-arm64.ps1` | PASS — Android ARM64 debug APK. Rust compile 성공 후 기존 Windows symlink 권한 제한에 대한 검증된 copy/Gradle fallback 사용, APK native library hash 확인 |
| APK manifest / dex inspection | 필요한 권한과 plugin class 포함 확인 |
| Impeccable detector, 추가 설정 UI와 SettingsPanel | PASS — findings `[]` |
| 로컬 브라우저 기본 viewport 및 390×844 설정 화면 | 알림 카드 표시, 빈 시각, 비활성 사용 상태, Android 전용 안내 확인. 실제 Android 권한 UI는 미실행 |
| 프로젝트 문서 validator / Notion render-only dry run | PASS — 문서 오류·경고 0. 외부 Notion 쓰기 없음 |

회귀 범위에는 D-3..D-day, clock 경계, deadline cutoff, candidate/완료/삭제 제외, restore, EXAM/EVENT fallback, plannedDate-only 제외, timezone/DST, ID 충돌, 계정 scope 전환, restart 중복 방지, 쓰기 실패와 journal 회복, native 확정값 누락, 다른 알림 보호, 권한 거부/회수 및 desktop 차단을 포함했다.

중간 실패도 구분한다. adapter 테스트의 ISO milliseconds 표기 기대값을 SDK의 실제 직렬화 형식에 맞춘 후 전체 재실행이 통과했다. 하위 Windows PowerShell 5 프로세스는 개발 환경의 `Get-FileHash` 모듈을 찾지 못해 실패했고, 현재 PowerShell 7 환경에서 동일 build script를 실행해 exit 0을 확인했다. 최초 native dependency mismatch는 JS API를 baseline 버전으로 고정한 뒤 해소했다. 실패를 우회하기 위해 데이터나 앱 저장소를 삭제하지 않았다.

최종 산출물 SHA-256:

| 산출물 | SHA-256 |
| --- | --- |
| `src-tauri/target/release/bundle/nsis/Yeonsik_Note_1.0.0_x64-setup.exe` | `CE736C0D863E2E2C272F2A66F53643822143D39745AFFAE66163E1136CE1EF92` |
| `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk` | `E1E31E85D6C8339F76665EDD6C77A749D168968BD0A40834480CFCCFB2F2CD64` |

## UNVERIFIED / 배포 전 남은 확인

실기기의 인증된 앱 UI 및 Android OS 설정을 직접 조작하지 못했다. 이 APK를 기기에 설치하거나 앱 데이터를 초기화하지 않았다.

1. Galaxy A25에서 시각 지정, POST_NOTIFICATIONS/정확한 알림 허용·거부·회수와 복귀 후 상태.
2. 앱 종료 및 Doze 상태에서 실제 D-3/D-2/D-1/D-day 알림 도착.
3. 실기기에서 deadline 수정·완료·삭제·복원 후 native 예약 취소·교체.
4. 재부팅, 강제 종료, 제조사 배터리 제한, 날짜·시간대 변경에 따른 실제 전달.
5. 기존 설치본 → 새 APK의 실제 upgrade 및 local pending/conflict/local-only Action 보존. 기존 자동 snapshot 회귀 테스트는 통과했으나 실기기 upgrade 증거는 아니다.
6. 실제 동일 계정 Windows↔Android 수정·삭제·재가져오기 흐름. baseline에서 남은 미검증 항목을 이번 빌드로 VERIFIED로 변경하지 않는다.

실기기 검증 시 기존 package/signature/version 호환을 먼저 확인하고 데이터 보존 update를 사용해야 한다. 앱 삭제, `pm clear`, local snapshot/pending 삭제를 검증이나 복구 수단으로 사용하지 않는다.
