export type PageStatus = "MATCHED" | "NOT_FOUND" | "OCR_FAILED" | "MULTIPLE_PHONE" | "DUPLICATE_PHONE" | "MULTIPLE_ID" | "DUPLICATE_ID";

export interface PageResult {
  page: number;
  extractedText: string;
  candidates: string[];
  phone: string;
  normalizedPhone: string;
  idCandidates: string[];
  id: string;
  normalizedId: string;
  matchedBy: "phone" | "id" | "";
  stt: string;
  status: PageStatus;
  source: "auto" | "manual";
}

export interface ProgressState {
  done: number;
  total: number;
  matched: number;
  needsReview: number;
  currentText: string;
}
