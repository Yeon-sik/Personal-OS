# 통합 홈 설치본 업데이트와 실제 계정 검증

## 범위

- 날짜: 2026-11-06, Asia/Seoul.
- 브랜치: `feat/personal-command-center-20261106`.
- 구현 커밋: `db15cd0`, `64b8395`. 빌드 및 테스트 근거는 [기능 검증 기록](personal-command-center-2026-11-06.md)에 있다.
- 대상: 이 PC의 Windows 앱과 Galaxy A25 / SM-A256N의 `com.yeonsik.note`. 연결된 에뮬레이터는 변경하지 않았다.
- 현재 판정: **두 설치본 업데이트 및 설치 전후 데이터 보존 통과. Windows 실제 계정 읽기 통과. 모바일 로그인과 양방향 동기화는 대기 중.**

## 데이터 보존과 설치

앱을 실행하기 전에 Windows의 기존 Roaming/Local 앱 폴더, 자동 실행 항목, Android의 앱 내부 데이터와 기존 APK를 비공개 로컬 디렉터리에 백업했다. 백업에는 계정 관련 데이터가 포함될 수 있으므로 Git에 넣지 않는다.

| 항목 | 확인 결과 |
| --- | --- |
| Windows Roaming 설정 | 2개 파일 SHA-256 동일 |
| Windows Local WebView 데이터 | 788개 파일 SHA-256 동일 |
| Android 앱 데이터 | 56개 파일 SHA-256 동일, 추가·누락·변경 0개 |
| Android 서명 | 설치본과 후보 인증서 SHA-256 일치 |
| Android 업데이트 | `adb -s <physical-device> install -r <apk>` 성공. uninstall, `pm clear` 사용 없음 |
| Android 최초 설치 시각 | `2026-06-06 18:06:58` 유지 |
| Android 업데이트 시각 | `2026-11-06 22:57:38` |
| Android 설정 화면 | 기존 다크 모드, 마감 알림 사용, 오전 09:00, 알림·정확한 알람 권한 허용 표시 유지 |
| Windows 실행 | 설치 경로의 프로세스와 새 통합 홈 표시 확인 |

파일 해시 비교는 업데이트 직후, 앱 재실행 전에 수행했다. 앱 실행 후 동기화·캐시 갱신으로 파일이 정상 변경되는 것까지 해시 불변이라고 주장하지 않는다.

Windows는 기존 자동 실행 항목이 존재하지 않는 이전 저장소 경로를 가리키고 있었다. 실행 파일을 `%LOCALAPPDATA%/Programs/Yeonsik Note/Yeonsik_Note.exe`에 배치하고 시작 메뉴 바로 가기를 만들었다. 기존 자동 실행 활성 의도를 유지해 현재 앱이 관리하는 항목으로 옮기고 중복된 이전 항목은 제거했다. 공백이 있는 실행 경로를 따옴표로 감쌌으며, 앱 설정에 “Windows 시작 시 자동 실행됩니다.”가 표시되는 것을 확인했다. 실제 Windows 재부팅은 수행하지 않았다.

배포한 파일 SHA-256:

- Windows: `61BC2CFFCBC5BA2C4875FCCFD56C7094BB002CDBAE3143DBF73D9608446BA6B5`
- Android: `79F34E1B359C6E13E687DA68AA7B93DC56911DF5A59410BCA4D013FD0D9BF7F6`
- Android 서명 인증서: `cad84c2b4d6f3ad776d880794e00333953840746fb27424531c9f5a6e2846135`

Windows는 로컬 빌드 실행 파일을 배치한 것이며 새 NSIS 설치 프로그램이나 공개 배포용 코드 서명을 검증한 것은 아니다.

## Windows 실제 계정 수신

저장된 실제 계정 세션이 유지됐고 앱에서 로그인됨·동기화됨 상태를 확인했다. 관리자 SQL 조회만으로 수신 성공을 판정하지 않고 설치된 앱의 진단과 실제 화면을 서버 결과와 비교했다.

| 데이터 | 설치된 앱의 결과 | 서버 대조 |
| --- | --- | --- |
| Fitness 운동 요약 | `fitness_summary_projections_v2` 439개 row, connected | 같은 사용자의 439개 row 일치 |
| Fitness 식단 요약 | `fitness_nutrition_summary_v1` 32개 row, connected | 해당 사용자 claim을 적용한 읽기 전용 트랜잭션에서 32개 row 일치, rollback |
| Fitness 체중 | 42개 row, 삭제되지 않은 row 41개, connected | 같은 사용자의 전체 42개 row 일치 |
| CashOS 현재 월 | 11월 확정 내역 없음 | 마지막 요약 날짜가 10월이므로 정상 빈 결과 |
| CashOS 기존 내역 | 10월 달력 5일에 지출 표시, 10월 14일 선택 시 2건의 금액 표시 | 같은 계정의 10월 5일·6건 집계 및 선택일 수입·지출·순액 일치 |

이 검사는 기존에 게시된 FitnessApp·CashOS 데이터를 실제 Personal OS 계정으로 읽은 증거다. 원본 건강·재무 기록을 새로 작성하거나 수정해 게시 파이프라인을 시험한 것은 아니다. 운영 원본 데이터는 변경하지 않았다.

## 기기 간 검증 상태

Windows UI에서 `[QA sync 20261106-2303] PC to Android`라는 임시 검증 메모를 생성했다. 서버에 같은 제목·본문과 Windows 기기 ID로 저장된 것을 확인했다.

Android는 업데이트 전부터 로그인 세션 없는 로컬 상태였고 업데이트 후에도 그 상태가 유지됐다. 설정에 `local-user`, 로그인 필요 안내가 표시된다. 사용자에게 앱에서 PC와 같은 계정으로 직접 로그인하도록 요청했다. 비밀번호는 채팅·로그·문서에 수집하지 않았다.

아직 확인하지 못한 항목:

- Android의 실제 계정 FitnessApp·CashOS 수신.
- Windows 검증 메모의 Android 수신.
- Android에서 수정한 내용의 Windows 반영.
- 검증 메모 soft-delete의 양쪽 반영 및 재시작 후 유지.

모바일 로그인 전에는 위 항목을 통과로 기록하지 않는다. 임시 메모는 다음 양방향 검증을 위한 식별 가능한 기록으로 남아 있으며, 검증 후 앱의 삭제 기능으로 정리한다.
