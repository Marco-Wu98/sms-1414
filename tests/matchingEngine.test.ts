import { describe, expect, it } from "vitest";
import { confirmManualPhone, matchPage } from "../lib/matching/matchingEngine";
import type { Employee } from "../types/employee";

const employees: Employee[] = [
  { stt: "1", name: "A", phone: "0912345678", normalizedPhone: "0912345678", id: "012345678901", normalizedId: "012345678901" },
  { stt: "2", name: "B", phone: "0987654321", normalizedPhone: "0987654321", id: "098765432109", normalizedId: "098765432109" },
  { stt: "3", name: "C", phone: "0901234567", normalizedPhone: "0901234567", id: "090123456789", normalizedId: "090123456789" },
];

describe("matchingEngine", () => {
  it("takes the original Excel STT independent of page order", () => {
    expect(["0987654321", "0901234567", "0912345678"].map((phone, i) => matchPage(i + 1, phone, employees).stt)).toEqual(["2", "3", "1"]);
  });
  it("leaves unknown phones unmatched", () => expect(matchPage(1, "0912345679", employees).status).toBe("NOT_FOUND"));
  it("keeps multiple matching employees in manual review", () => {
    const duplicate = [...employees, { ...employees[0], stt: "4" }];
    expect(matchPage(1, "0912345678", duplicate).status).toBe("DUPLICATE_PHONE");
  });
  it("flags multiple Excel hits on one page", () => expect(matchPage(1, "0912345678 / 0987654321", employees).status).toBe("MULTIPLE_PHONE"));
  it("matches CCCD only when no Excel phone matches", () => expect(matchPage(1, "Số liên hệ không khớp; CCCD: 012345678901", employees)).toMatchObject({ stt: "1", status: "MATCHED", matchedBy: "id", normalizedId: "012345678901" }));
  it("prefers a matching phone over a different CCCD", () => expect(matchPage(1, "0912345678 / 098765432109", employees)).toMatchObject({ stt: "1", matchedBy: "phone", status: "MATCHED" }));
  it("keeps duplicate CCCD entries in manual review", () => expect(matchPage(1, "012345678901", [...employees, { ...employees[0], stt: "4" }]).status).toBe("DUPLICATE_ID"));
  it("supports manual CCCD confirmation", () => {
    const confirmed = confirmManualPhone(matchPage(1, "OCR không đọc được", employees), "012345678901", employees);
    expect(confirmed).toMatchObject({ stt: "1", status: "MATCHED", matchedBy: "id", source: "manual" });
  });
  it("confirms the user's exact manual selection", () => {
    const page = matchPage(125, "OCR missed this", employees);
    const confirmed = confirmManualPhone(page, "0901234567", employees);
    expect(confirmed).toMatchObject({ page: 125, phone: "0901234567", stt: "3", status: "MATCHED", source: "manual" });
  });
});
