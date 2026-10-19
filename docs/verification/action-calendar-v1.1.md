# Action Calendar v1.1 구현 검증 기록

2026-10-18, Asia/Seoul. 브랜치 `feat/action-calendar-20261018`.

## 사용 흐름

1. **기록 → 전체 → 일정 가져오기**를 연다.
2. **GPT 입력 양식 복사**로 받은 양식을 GPT에 전달한다. GPT의 응답 JSON을 붙여넣고 **내용 검토**를 누른다.
3. 날짜·시간대·출처를 확인하고 **후보로 보관** 또는 **일정으로 등록**을 선택한다.
4. **일정 확인**을 누르면 해당 날짜로 이동한다. 접수기간·계획일·마감일·시험/행사를 같은 달력에서 확인한다. 날짜가 없으면 **날짜 미정**에 표시한다.
5. Windows와 Android에서 같은 Supabase 계정으로 로그인하고 동기화한다. 로그인 전에 가져온 항목은 **현재 계정으로 가져오기**를 명시적으로 선택한다.

확정 일정과 출처 대조 여부는 별개다. 출처가 미확인이어도 등록할 수 있고, 출처 대조 기록은 사용자가 상세 화면에서 별도로 남긴다. 시험과 접수는 별도 일정으로 입력한다. 자동 GPT 연결, 알림 예약, 공고 모니터링은 이번 구현에 포함하지 않았다.

## 구현 범위

| 영역 | 결과 |
|---|---|
| 입력 | 버전·항목 수·256 KiB 제한, 필드 검증, 실재 날짜·시간대·DST 검증, 항목별 오류, 독립 생성 선택 |
| 모델 | 기존 Task 확장. 등록 상태와 근거 상태 분리, 원본 시각·시간대·출처 보존 |
| 달력 | 월간 표시와 날짜 상세가 같은 projection 사용. 후보 필터, 완료 필터, 날짜 미정 목록 |
| 편집 | 후보 확정, 계획·공식 날짜 수정, 출처 대조, 변경 시 검증 기록 해제, 삭제 항목 명시적 복원 |
| 중복·충돌 | 계정/namespace/key 기반 UUIDv5. `ensure_action_v1`은 삽입 또는 기존 행 반환. 재가져오기로 사용자 수정·완료·삭제를 덮어쓰지 않음. 같은 시각의 다른 UTC offset 표기는 같은 내용으로 비교 |
| 저장 | v1 원본을 남긴 v2 전환. 저장 성공 이후 등록 완료 표시. 다른 창의 변경을 감지하면 쓰기 중단 |
| 동기화 | 생성 의도와 최초 payload를 대기열에 저장. 서버 응답 유실 재시도, 생성 중 수정 보존, 충돌 양쪽 내용 비교. 기기 전용 일정은 계정 데이터 전송을 막지 않음 |
| 계정 연결 | 로컬 일정 ID·대기열을 함께 전환. 계정에 이미 있는 일정은 충돌 검토로 연결. 계정 쪽 미전송 수정이 있으면 먼저 동기화하도록 안내 |
| 기존 화면 | 후보는 체크리스트·홈 실적에서 제외. 가져온 공식 일정은 체크리스트에서도 읽을 수 있으며 상세 화면에서 수정 |

주요 코드: [actions](../../src/features/actions/), [recordAggregation.ts](../../src/features/records/recordAggregation.ts), [deltaPush.ts](../../src/lib/sync/supabase/deltaPush.ts), [syncReconciliation.ts](../../src/lib/sync/syncReconciliation.ts), [localStorageAdapter.ts](../../src/lib/storage/localStorageAdapter.ts).

## DB 적용과 데이터 보존

- 연결된 Personal OS Supabase 프로젝트에 [20261018133855_action_calendar_v1_1.sql](../../supabase/migrations/20261018133855_action_calendar_v1_1.sql)을 적용했다. 로컬 파일 버전은 실제 원격 migration history와 맞췄다.
- 사용자가 승인한 대로 기존 할 일 소유자를 유일한 로그인 계정으로 연결했다. ID·본문·날짜·완료·삭제 상태를 유지하고 소유자와 동기화 시각만 갱신했다.
- 적용 전후 **32행, 삭제 표시 25행**이 같고, 기존 필드의 집계 해시도 같았다. 로그인 계정 소유 행은 **0 → 32**다.
- tasks RLS 활성화, 본인 SELECT/INSERT/UPDATE 정책 3개, 익명 테이블 접근 및 생성 RPC 실행 차단을 확인했다.
- 실제 DB에서 authenticated 역할로 생성·사용자 수정 후 재시도·삭제 후 재시도·다른 계정 조회/쓰기 거부를 검증했다. 검증 트랜잭션은 모두 롤백했다.
- 다른 기능의 기존 migrations를 일괄 재적용하지 않았다. 현재 서버의 full-pull fallback과 기존 Realtime 경로를 유지한다.

## 검증 증거

### 후속 동기화 오류 복구 — 2026-10-18

- 신고 오류: `notes: 전송한 행의 서버 확정값을 확인하지 못했습니다.`
- 원인: 할 일의 계정 이전 이후 메모 21행(삭제 표시 19행)이 기존 `VITE_USER_ID` 계정에 남아 있었다. 앱은 로그인 계정으로 전송했으나, `notes_lww_guard`가 동일 수정 시각의 UPDATE를 건너뛰었다. 후속 계정별 조회에서 해당 ID가 보이지 않아 성공을 확인할 수 없었다.
- 실제 DB의 롤백 트랜잭션에서 동일 전송을 재현했다. 복구 전 **21행 전송 / 0행 확인**이었다. 나머지 쓰기 대상 테이블에는 이전 계정 소유 행이 없었다.
- [복구 마이그레이션](../../supabase/migrations/20261018141855_repair_legacy_note_ownership.sql)을 원격 적용했다. 알려진 기존 계정과 유일한 로그인 계정만 연결하며, 기존 할 일 이전 완료 및 LWW 트리거 상태를 먼저 검사한다. 메모 테이블 잠금을 잡은 한 트랜잭션 안에서 필요한 기기 FK를 연결하고 소유자만 수정한다.
- 내용 변경으로 취급해 `updated_at`을 현재 시각으로 올리지 않았다. 기기에 남아 있는 더 최신 오프라인 수정이 이후에도 정상 반영될 수 있도록 모든 기존 시각을 유지했다. LWW 트리거는 트랜잭션 종료 전에 복구한다.
- 복구 전후 **전체 23행 / 삭제 표시 19행** 유지. 로그인 계정 소유는 **2 → 23행**, 기존 계정 잔여는 **21 → 0행**. 소유자 외 모든 필드의 집계 해시 `e60116bc2c0dcf8a1a7c521d22fc9543`가 동일했다. 기기 FK 누락 0건, LWW 트리거 활성 상태 확인.
- 실제 DB에서 `authenticated` 역할로 앱과 같은 upsert 및 소유자별 재조회 수행: **23행 전송 / 23행 확인 / 23행 내용 보존**. 검증 트랜잭션은 롤백했다.
- [실제 PostgreSQL 회귀 테스트](../../src/lib/sync/supabase/legacyNoteOwnership.test.ts) 4개와 기존 delta sync 20개, 총 **24개 통과**. 오류 재현 후 재시도 대기열 해제, 오프라인 최신 수정 보존, 삭제 복원 방지, 복수 계정 시 중단·롤백, 재실행 안전성, 무관한 소유자 보존을 확인했다. TypeScript 검사 통과.
- 앱 실행 코드 변경이나 재설치는 필요하지 않다. 실패 상태인 앱에서 수동 동기화를 다시 실행해야 한다. 네이티브 앱 화면에서의 오류 해제는 사용자 확인을 요청한 상태다.

### 최초 구현 검증

| 검증 | 결과·증거 범위 |
|---|---|
| 전체 Vitest | 47개 파일, 279개 테스트 통과. `npm.cmd test -- --reporter=dot` |
| TypeScript | strict 타입 검사 통과 |
| 로컬 PostgreSQL | 실제 migration SQL을 PGlite에서 실행. 계정 연결, RLS, 재시도, tombstone, 불변식 6개 테스트 통과 |
| 원격 DB | 실제 authenticated 역할로 권한과 생성 RPC 검증. Supabase MCP 적용 성공 및 이력 확인 |
| Web production | `tsc && vite build` 통과. 기존 대형 청크 경고는 남음 |
| 브라우저 UI | 480×720 및 390×844에서 가져오기·후보 저장·확정 전환·달력 표시·새로고침 후 보존·동일 입력 재가져오기 확인. 모바일 document/scroll/dialog 폭 모두 390px |
| UI detector | 선택 날짜의 기존 hover 색 조합에 대한 경고 2개. 선택 날짜는 teal 계열 전경, 나머지는 흰색/검정 배경이며 실제 화면에서 가독성 확인 |
| Windows | Tauri release 실행 파일과 NSIS 설치 파일 생성. 검증 실행에서 프로세스 응답 및 창 핸들 확인. Authenticode는 미서명 |
| Android | ARM64 debug APK 및 패키지 내부 라이브러리 해시 검증. Galaxy A25(SM-A256N)의 기존 설치본과 패키지·versionCode·인증서 일치 확인 후 `adb install -r` 성공. 최종 APK MainActivity cold start `Status: ok`, 1098ms 및 프로세스 실행 확인. 삭제·데이터 초기화 없음 |

브라우저 화면: [Windows 상세](../../artifacts/action-calendar/windows-detail.png), [모바일 상세](../../artifacts/action-calendar/mobile-detail.png). 화면의 가상 예시는 검증 후 개발 브라우저에서 삭제 표시했으며 실제 DB에 등록하지 않았다.

## 빌드 재현

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run tauri:build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-android-arm64.ps1
```

Android 스크립트는 Tauri의 Rust 컴파일 성공을 확인한 뒤, Windows 심볼릭 링크 권한 오류에 한해 라이브러리 복사와 Gradle 패키징으로 이어간다. APK 안의 라이브러리 SHA-256도 컴파일 결과와 비교한다. 개발자 모드나 시스템 보안 설정을 변경하지 않는다.

- Windows 실행: `src-tauri/target/release/Yeonsik_Note.exe`
- Windows 설치: `src-tauri/target/release/bundle/nsis/Yeonsik_Note_1.0.0_x64-setup.exe`
- Android APK: `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`

## 남은 검증과 운영 조건

- 브라우저 반응형 검증은 네이티브 앱의 모든 입력 장치·키보드·접근성을 입증하지 않는다. Windows와 Android 실계정 간 실시간 왕복 동기화는 별도 실사용 검증이 필요하다.
- Windows 빌드는 개인 실행용 미서명 산출물이고 Android는 debug 서명이다. iOS 빌드는 이번 Windows 환경에서 생성하지 않았다.
- 같은 기기의 여러 창은 Web Locks 지원 환경에서 직렬화하고 저장 전 원본 비교를 수행한다. Web Locks가 없는 구형 WebView에서는 단일 창 사용을 전제로 한다.
- 구버전 앱은 새 필드를 이해하지 못하므로 두 기기를 함께 갱신해야 한다. v1 저장소는 복구 원본이며 v2에서 이루어진 변경을 구버전으로 역변환하지 않는다.
- 원격 보안 점검에서 기존 notes/devices/건강 기록 등 7개 테이블의 RLS 비활성화가 확인됐다. 이번 작업은 tasks와 일정 RPC 권한을 보완했다. 공유 DB의 다른 앱 소유 테이블은 별도 소유권 분석이 필요하다. [Supabase RLS 점검 기준](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)

커밋·푸시는 수행하지 않았다. 이 기록은 설계의 모든 수용 기준을 실기기에서 통과했다는 선언이 아니다.
