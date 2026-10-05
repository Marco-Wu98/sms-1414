import type { Employee } from "@/types/employee";
import type { PageResult, ProgressState } from "@/types/pageResult";
import { buildEmployeeMaps, matchPage } from "@/lib/matching/matchingEngine";

export interface PdfRunOptions {
  pdf: File;
  employees: Employee[];
  onProgress: (progress: ProgressState) => void;
}

export async function processPdf({ pdf, employees, onProgress }: PdfRunOptions): Promise<PageResult[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const pdfDocument = await pdfjs.getDocument({ data: await pdf.arrayBuffer() }).promise;
  const { createWorker, PSM } = await import("tesseract.js");
  const employeeMaps = buildEmployeeMaps(employees);
  const worker = await createWorker("vie", 1, {
    langPath: process.env.NEXT_PUBLIC_TESSERACT_LANG_PATH || "https://tessdata.projectnaptha.com/4.0.0",
    logger: () => undefined,
  });
  const results: PageResult[] = [];
  let matched = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      let page: Awaited<ReturnType<typeof pdfDocument.getPage>> | undefined;
      let canvas: HTMLCanvasElement | undefined;
      let result: PageResult;
      try {
        page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();
        let text = textContent.items.map((item) => "str" in item ? item.str : "").join(" ").trim();
        // Keep useful text-layer extraction, but OCR pages with no text or no phone candidate.
        if (!text || !/\d{9,}/.test(text)) {
          const viewport = page.getViewport({ scale: 1.65 });
          canvas = window.document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error(`Không thể tạo ảnh trang ${pageNumber}.`);
          await page.render({ canvasContext: context, viewport }).promise;
          const ocr = await worker.recognize(canvas, {}, { blocks: true });
          text = ocr.data.text;

          // A centered message-body crop enlarged with digit-only recognition can recover
          // small/link-blue phone strings that sparse full-page OCR often misses.
          const sourceX = canvas.width * 0.14;
          const sourceY = canvas.height * 0.25;
          const sourceWidth = canvas.width * 0.72;
          const sourceHeight = canvas.height * 0.6;
          const cropCanvas = window.document.createElement("canvas");
          cropCanvas.width = Math.ceil(sourceWidth * 1.8);
          cropCanvas.height = Math.ceil(sourceHeight * 1.8);
          const cropContext = cropCanvas.getContext("2d", { alpha: false });
          try {
            if (cropContext) {
              cropContext.imageSmoothingEnabled = true;
              cropContext.imageSmoothingQuality = "high";
              cropContext.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, cropCanvas.width, cropCanvas.height);
              await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: "0123456789+- .()" });
              const cropOcr = await worker.recognize(cropCanvas);
              text = `${text}\n${cropOcr.data.text}`;
            }
          } catch {
            // Preserve whole-page OCR if the optional zoomed pass fails.
          } finally {
            await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: "" }).catch(() => undefined);
            cropCanvas.width = 0;
            cropCanvas.height = 0;
          }
        }
        result = matchPage(pageNumber, text, employeeMaps);
      } catch {
        // A damaged/unreadable page must not abort the job or disappear from the output.
        result = matchPage(pageNumber, "", employeeMaps);
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        page?.cleanup();
      }
      results.push(result);
      if (result.status === "MATCHED") matched++;
      onProgress({ done: pageNumber, total: pdfDocument.numPages, matched, needsReview: pageNumber - matched, currentText: `Đang đọc trang ${pageNumber} / ${pdfDocument.numPages}` });
    }
  } finally {
    await worker.terminate();
    await pdfDocument.destroy();
  }
  return results;
}
