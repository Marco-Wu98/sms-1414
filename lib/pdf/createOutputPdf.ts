import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PageResult } from "@/types/pageResult";

export type OverlayPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export async function createOutputPdf(file: File, results: PageResult[], position: OverlayPosition, fontSize: number, margin: number, background: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  if (pdf.getPageCount() !== results.length) throw new Error("Số trang kết quả không khớp PDF gốc.");
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  results.forEach((result, index) => {
    if (result.status !== "MATCHED" || !result.stt) return;
    const page = pdf.getPage(index);
    const { width, height } = page.getSize();
    const label = `STT: ${result.stt}`;
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const horizontal = position.endsWith("left") ? margin : position.endsWith("right") ? width - margin - textWidth : (width - textWidth) / 2;
    const vertical = position.startsWith("top") ? height - margin - fontSize : margin;
    if (background) page.drawRectangle({ x: horizontal - 5, y: vertical - 3, width: textWidth + 10, height: fontSize + 7, color: rgb(1, 1, 1), opacity: 0.9 });
    page.drawText(label, { x: horizontal, y: vertical, size: fontSize, font, color: rgb(0.05, 0.08, 0.08) });
  });
  return pdf.save({ useObjectStreams: false });
}
