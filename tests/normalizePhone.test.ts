import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "../lib/phone/normalizePhone";

describe("normalizePhoneNumber", () => {
  it.each([
    ["0912345678", "0912345678"], ["0912 345 678", "0912345678"], ["0912.345.678", "0912345678"],
    ["0912-345-678", "0912345678"], ["+84912345678", "0912345678"], ["+84 912 345 678", "0912345678"],
    ["84912345678", "0912345678"],
  ])("normalizes %s", (input, expected) => expect(normalizePhoneNumber(input)).toBe(expected));
  it.each(["1414", "091234567", "09123456789", "0212345678", "abc"]) ("rejects invalid number %s", (input) => expect(normalizePhoneNumber(input)).toBeNull());
});
