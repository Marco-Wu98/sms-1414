import { describe, expect, it } from "vitest";
import { extractPhoneCandidates } from "../lib/phone/extractPhone";

describe("extractPhoneCandidates", () => {
  it("reads formatted mobile numbers and ignores 1414", () => {
    expect(extractPhoneCandidates("Gui 1414, so thue bao 0912 345 678.").map((x) => x.normalized)).toEqual(["0912345678"]);
  });
  it("supports +84 and unformatted 84 prefixes", () => {
    expect(extractPhoneCandidates("+84 912 345 678 / 84987654321").map((x) => x.normalized)).toEqual(["0912345678", "0987654321"]);
  });
  it("does not take a ten digit substring from a longer identifier", () => {
    expect(extractPhoneCandidates("035099003770 012345678901")).toEqual([]);
  });
  it("deduplicates repeated appearances", () => {
    expect(extractPhoneCandidates("0912345678; 0912-345-678")).toHaveLength(1);
  });
});
