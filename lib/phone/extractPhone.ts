import { normalizePhoneNumber } from "./normalizePhone";

export interface PhoneCandidate { raw: string; normalized: string; index: number }

// Preserve separators during capture, then normalize. 1414, IDs of other lengths,
// dates, and service numbers fail the strict Vietnamese mobile-number check.
const PHONE_LIKE = /(?<!\d)(?:\+?84[\s().-]*[35789](?:[\s().-]*\d){8}|0[35789](?:[\s().-]*\d){8})(?![\s().-]*\d)/g;

export function extractPhoneCandidates(text: string): PhoneCandidate[] {
  const candidates: PhoneCandidate[] = [];
  for (const match of text.matchAll(PHONE_LIKE)) {
    const normalized = normalizePhoneNumber(match[0]);
    if (normalized && !candidates.some((candidate) => candidate.normalized === normalized)) {
      candidates.push({ raw: match[0].trim(), normalized, index: match.index ?? 0 });
    }
  }
  return candidates;
}
