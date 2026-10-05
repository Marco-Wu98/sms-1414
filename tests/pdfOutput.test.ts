import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createOutputPdf } from "../lib/pdf/createOutputPdf";
import type { PageResult } from "../types/pageResult";

describe("createOutputPdf", () => {
  it("preserves page count and only adds Excel STT to matched pages", async () => {
    const input = await PDFDocument.create(); input.addPage([420, 600]); input.addPage([600, 420]); input.addPage([300, 300]);
    const sourceBytes = Uint8Array.from(await input.save()).buffer as ArrayBuffer;
    const file = new File([sourceBytes], "input.pdf", { type: "application/pdf" });
    const results: PageResult[] = [
      { page: 1, extractedText: "", candidates: [], phone: "", normalizedPhone: "", idCandidates: [], id: "", normalizedId: "", matchedBy: "phone", stt: "58", status: "MATCHED", source: "auto" },
      { page: 2, extractedText: "", candidates: [], phone: "", normalizedPhone: "", idCandidates: [], id: "", normalizedId: "", matchedBy: "", stt: "", status: "NOT_FOUND", source: "auto" },
      { page: 3, extractedText: "", candidates: [], phone: "", normalizedPhone: "", idCandidates: [], id: "", normalizedId: "", matchedBy: "id", stt: "12", status: "MATCHED", source: "manual" },
    ];
    const output = await PDFDocument.load(await createOutputPdf(file, results, "top-center", 16, 24, true));
    expect(output.getPageCount()).toBe(3);
    expect(output.getPages().map((page) => page.getSize())).toEqual([{ width: 420, height: 600 }, { width: 600, height: 420 }, { width: 300, height: 300 }]);
    expect(output.getPages()[0].node.Contents()).toBeTruthy();
    expect(output.getPages()[1].node.Contents()).toBeUndefined();
    expect(output.getPages()[2].node.Contents()).toBeTruthy();
  });
});
