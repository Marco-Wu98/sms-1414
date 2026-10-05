import { normalizeCccd } from "./normalizeCccd";

export interface CccdCandidate { raw: string; normalized: string; index: number }
const CCCD_LIKE = /(?<!\d)(?:\d[\s.-]*){11}\d(?![\s.-]*\d)/g;

export function extractCccdCandidates(text: string): CccdCandidate[] {
  const candidates: CccdCandidate[] = [];
  for (const match of text.matchAll(CCCD_LIKE)) {
    const normalized = normalizeCccd(match[0]);
    if (normalized && !candidates.some((candidate) => candidate.normalized === normalized)) {
      candidates.push({ raw: match[0].trim(), normalized, index: match.index ?? 0 });
    }
  }
  return candidates;
}
