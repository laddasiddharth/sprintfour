export interface DocumentData {
  id: string;
  title: string;
  text: string;
}

export type PiiType =
  | "name"
  | "phone"
  | "email"
  | "address"
  | "dob"
  | "ssn"
  | "account"
  | "financial"
  | "url"
  | "org"
  | "job"
  | "other";

export type SuggestionStatus = "pending" | "confirmed" | "rejected";

export interface PiiSpan {
  id: string;
  text: string; // exact substring to match in the document
  type: PiiType;
  confidence: number; // 0-1, as returned by the detector
  status: SuggestionStatus;
  reason?: string; // populated when rejected, Sam's stated reason
  reasoning?: string; // AI's provided reasoning for flagging
}

export interface ManualSpan {
  id: string;
  text: string;
  type: PiiType;
  start: number;
  end: number;
  addedBy: "sam";
  confidence?: number;
}

export interface CandidateMiss {
  id: string;
  text: string;
  start: number;
  end: number;
  pattern: "digit-sequence" | "capitalized-name-like";
  dismissed: boolean;
}
