import { ACTION_IMPORT_VERSION } from "./actionImport";
export const ACTION_IMPORT_EXAMPLE = JSON.stringify({
  schemaVersion: ACTION_IMPORT_VERSION, requestId: "sample-import-001", items: [
    { itemKey: "registration", sourceNamespace: "sample-exam", externalKey: "2027:1:registration",
      text: "예시 시험 접수 (가상 일정)", kind: "REGISTRATION",
      schedule: { windowStartDate: "2027-02-01", windowStartTime: "10:00", dueDate: "2027-02-05", dueTime: "18:00", timeZone: "Asia/Seoul" },
      source: { type: "EXTERNAL_NOTICE", url: "https://example.org/sample-exam", label: "가상 공고", excerpt: "설명용 예시이며 실제 시험 일정이 아닙니다." } },
    { itemKey: "exam", sourceNamespace: "sample-exam", externalKey: "2027:1:exam",
      text: "예시 시험 응시 (가상 일정)", kind: "EXAM",
      schedule: { eventStartDate: "2027-03-07", eventStartTime: "10:00", timeZone: "Asia/Seoul" },
      source: { type: "EXTERNAL_NOTICE", url: "https://example.org/sample-exam", label: "가상 공고" } },
  ],
}, null, 2);
export const ACTION_GPT_PROMPT = "Personal OS 일정 가져오기용 JSON만 작성해 줘. 아래 예시의 가상 데이터는 사용하지 말고 내가 요청한 일정과 확인한 근거만 넣어 줘. schemaVersion과 필드 형식은 유지해 줘. 접수와 시험은 별도 항목으로 나누고 같은 행동에는 기존 sourceNamespace/externalKey를 재사용해 줘. 모르는 날짜와 시간은 null, plannedDate는 내가 정한 경우에만 넣어 줘. 종류는 TASK, APPLICATION, REGISTRATION, DEADLINE, EXAM, EVENT, RENEWAL 중 하나야. 외부 공고는 EXTERNAL_NOTICE, 내 계획은 USER_STATEMENT야. 상대 날짜를 해석했다면 source.dateReference에 baseDate와 timeZone을 넣어 줘. 인증정보와 verified, 등록 상태, 알림 필드는 넣지 마. 최대 100개 항목이야.\n\n" + ACTION_IMPORT_EXAMPLE;
