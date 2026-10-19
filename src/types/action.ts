export const ACTION_KINDS = ["TASK", "APPLICATION", "REGISTRATION", "DEADLINE", "EXAM", "EVENT", "RENEWAL"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export type RegistrationState = "CANDIDATE" | "CONFIRMED";
export interface TaskActionFields {
  kind: ActionKind;
  windowStartDate: string | null;
  windowStartTime: string | null;
  eventStartDate: string | null;
  eventStartTime: string | null;
  eventEndDate: string | null;
  eventEndTime: string | null;
  timeZone: string;
  registrationState: RegistrationState;
  origin: "MANUAL" | "CHATGPT" | "IMPORT";
  sourceType: "USER_STATEMENT" | "EXTERNAL_NOTICE";
  verificationStatus: "UNVERIFIED" | "USER_PROVIDED" | "SOURCE_CHECKED";
  sourceUrl: string | null;
  sourceLabel: string | null;
  sourceExcerpt: string | null;
  sourceReferenceDate: string | null;
  sourceReferenceTimeZone: string | null;
  sourceReportedCheckedAt: string | null;
  sourceCheckedAt: string | null;
  sourceCheckedBy: string | null;
  sourceNamespace: string | null;
  externalKey: string | null;
}
