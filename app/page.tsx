"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, BadgeCheck, Check, ChevronDown, CircleAlert, FileSpreadsheet, FileText, Fingerprint, LoaderCircle, LockKeyhole, RotateCcw, Search, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { readExcelFile, makeEmployees } from "@/lib/excel/parseExcel";
import { processPdf } from "@/lib/pdf/processPdf";
import { createOutputPdf, type OverlayPosition } from "@/lib/pdf/createOutputPdf";
import { confirmManualPhone } from "@/lib/matching/matchingEngine";
import { downloadBlob } from "@/lib/utils/download";
import type { Employee, EmployeeImport } from "@/types/employee";
import type { PageResult, ProgressState } from "@/types/pageResult";

const positions: { value: OverlayPosition; label: string }[] = [
  { value: "top-left", label: "Trên trái" }, { value: "top-center", label: "Trên giữa" }, { value: "top-right", label: "Trên phải" },
  { value: "bottom-left", label: "Dưới trái" }, { value: "bottom-center", label: "Dưới giữa" }, { value: "bottom-right", label: "Dưới phải" },
];
const statusNames: Record<string, string> = { MATCHED: "Đã khớp", NOT_FOUND: "Không tìm thấy", OCR_FAILED: "OCR chưa đọc được", MULTIPLE_PHONE: "Nhiều số cần xem", DUPLICATE_PHONE: "SĐT trùng Excel", MULTIPLE_ID: "Nhiều CCCD cần xem", DUPLICATE_ID: "CCCD trùng Excel" };
const statusColor: Record<string, string> = { MATCHED: "bg-[#e7f5ed] text-[#287451]", NOT_FOUND: "bg-[#fff3e6] text-[#9b5b16]", OCR_FAILED: "bg-[#fcebec] text-[#ae4249]", MULTIPLE_PHONE: "bg-[#fff3e6] text-[#9b5b16]", DUPLICATE_PHONE: "bg-[#f1ecfb] text-[#7452a0]", MULTIPLE_ID: "bg-[#fff3e6] text-[#9b5b16]", DUPLICATE_ID: "bg-[#f1ecfb] text-[#7452a0]" };

function FileDrop({ title, subtitle, accept, icon: Icon, file, disabled, onFile, onClear }: {
  title: string; subtitle: string; accept: string; icon: typeof FileText; file: File | null; disabled: boolean;
  onFile: (file: File) => void; onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  return <div className="relative">
    <div className="dropzone flex min-h-[142px] cursor-pointer items-center gap-4 rounded-2xl bg-white px-5 py-5" data-active={active} role="button" tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && !file && input.current?.click()}
      onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !file) input.current?.click(); }}
      onDragOver={(event) => { event.preventDefault(); setActive(true); }} onDragLeave={() => setActive(false)}
      onDrop={(event) => { event.preventDefault(); setActive(false); if (!disabled && event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]); }}>
      <input ref={input} className="hidden" type="file" accept={accept} disabled={disabled} onChange={(event) => { const f = event.target.files?.[0]; if (f) onFile(f); event.target.value = ""; }} />
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf6f0] text-[#387d65]"><Icon size={22} /></div>
      <div className="min-w-0 flex-1">
        {file ? <><div className="truncate text-sm font-semibold text-ink">{file.name}</div><div className="mt-1 text-xs text-[#7a8b84]">{(file.size / 1024 / 1024).toFixed(2)} MB · Đã tải lên</div></> : <><div className="text-sm font-semibold text-ink">{title}</div><div className="mt-1.5 text-xs leading-5 text-[#7a8b84]">{subtitle}</div></>}
      </div>
      {file ? <button type="button" className="rounded-lg p-2 text-[#80918a] hover:bg-[#f1f5f2]" title="Xóa tệp" onClick={(event) => { event.stopPropagation(); onClear(); }}><X size={17} /></button> : <Upload className="mr-1 shrink-0 text-[#98aaa1]" size={19} />}
    </div>
  </div>;
}

export default function Home() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [excel, setExcel] = useState<EmployeeImport | null>(null);
  const [employeeFile, setEmployeeFile] = useState<File | null>(null);
  const [sttIndex, setSttIndex] = useState(0);
  const [phoneIndex, setPhoneIndex] = useState(-1);
  const [idIndex, setIdIndex] = useState(-1);
  const [nameIndex, setNameIndex] = useState(-1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [results, setResults] = useState<PageResult[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState<OverlayPosition>("top-center");
  const [fontSize, setFontSize] = useState(16);
  const [margin, setMargin] = useState(24);
  const [background, setBackground] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [manual, setManual] = useState<Record<number, string>>({});

  const counts = useMemo(() => results.reduce((all, row) => { all[row.status] = (all[row.status] ?? 0) + 1; return all; }, {} as Record<string, number>), [results]);
  const ready = Boolean(pdf && excel && (phoneIndex >= 0 || idIndex >= 0) && employees.length && !processing);
  const setPdfFile = (file: File) => {
    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("Vui lòng chọn file PDF.");
    if (file.size > 80 * 1024 * 1024) return setError("PDF vượt giới hạn 80 MB.");
    setPdf(file); setResults([]); setProgress(null);
  };
  const setExcelFile = async (file: File) => {
    setError("");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setError("Chỉ hỗ trợ .xlsx, .xls hoặc .csv.");
    if (file.size > 20 * 1024 * 1024) return setError("Excel vượt giới hạn 20 MB.");
    try {
      const data = await readExcelFile(file);
      setExcel(data); setEmployeeFile(file); setResults([]);
      const lower = data.columns.map((s) => s.toLocaleLowerCase());
      const suggestedStt = lower.findIndex((s) => /(^stt$|tt\/no|^no\.?$|serial|index)/i.test(s));
      const suggestedPhone = lower.findIndex((s) => /(phone|mobile|điện thoại|dien thoai|sđt|sdt|telephone)/i.test(s));
      const suggestedId = lower.findIndex((s) => /(cccd|căn cước|can cuoc|identity|id number|giấy tờ tùy thân|giay to tuy than)/i.test(s));
      const suggestedName = lower.findIndex((s) => /(họ và tên|ho va ten|full name|name)/i.test(s));
      const stt = suggestedStt >= 0 ? suggestedStt : 0;
      setSttIndex(stt); setPhoneIndex(suggestedPhone); setIdIndex(suggestedId); setNameIndex(suggestedName);
      setEmployees(makeEmployees(data, stt, suggestedPhone, suggestedName, suggestedId));
    } catch (e) { setError(e instanceof Error ? e.message : "Không đọc được file Excel."); }
  };
  const remap = (column: "stt" | "phone" | "name" | "id", index: number) => {
    if (column === "stt") setSttIndex(index);
    if (column === "phone") setPhoneIndex(index);
    if (column === "name") setNameIndex(index);
    if (column === "id") setIdIndex(index);
    if (excel) {
      const nextStt = column === "stt" ? index : sttIndex;
      const nextPhone = column === "phone" ? index : phoneIndex;
      const nextName = column === "name" ? index : nameIndex;
      const nextId = column === "id" ? index : idIndex;
      setEmployees(makeEmployees(excel, nextStt, nextPhone, nextName, nextId));
      setResults([]);
    }
  };
  const start = async () => {
    if (!pdf || !excel || (phoneIndex < 0 && idIndex < 0)) return;
    const mapped = makeEmployees(excel, sttIndex, phoneIndex, nameIndex, idIndex);
    if (!mapped.length) return setError("Không tìm thấy dòng có STT và SĐT hợp lệ hoặc CCCD 12 số theo mapping.");
    setEmployees(mapped); setError(""); setResults([]); setManual({}); setProcessing(true);
    setProgress({ done: 0, total: 0, matched: 0, needsReview: 0, currentText: "Đang khởi tạo xử lý an toàn trong trình duyệt…" });
    try {
      const found = await processPdf({ pdf, employees: mapped, onProgress: setProgress });
      setResults(found);
    } catch (e) { setError(`Không xử lý được tài liệu: ${e instanceof Error ? e.message : "Lỗi không xác định"}`); }
    finally { setProcessing(false); }
  };
  const confirm = (row: PageResult) => {
    const next = confirmManualPhone(row, manual[row.page] ?? "", employees);
    setResults((old) => old.map((item) => item.page === row.page ? next : item));
  };
  const exportPdf = async () => {
    if (!pdf || !results.length) return;
    setBusyExport(true);
    try {
      const bytes = await createOutputPdf(pdf, results, position, fontSize, margin, background);
      const stem = pdf.name.replace(/\.pdf$/i, "");
      const blobBytes = Uint8Array.from(bytes).buffer as ArrayBuffer;
      downloadBlob(new Blob([blobBytes], { type: "application/pdf" }), `${stem}_STT.pdf`);
    } catch (e) { setError(`Không tạo được PDF đầu ra: ${e instanceof Error ? e.message : "Lỗi không xác định"}`); }
    finally { setBusyExport(false); }
  };
  const exportReport = () => {
    const header = ["PDF Page", "Phone Candidates", "CCCD Candidates", "Matched By", "STT", "Status"];
    const lines = [header, ...results.map((r) => [r.page, r.phone || r.candidates.join(" | "), r.id || r.idCandidates.join(" | "), r.matchedBy, r.stt, r.status])]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    downloadBlob(new Blob(["\ufeff", lines], { type: "text/csv;charset=utf-8" }), "bao-cao-doi-chieu.csv");
  };
  const visibleRows = results.filter((row) => filter === "ALL" || row.status === filter);
  const progressPercent = progress?.total ? Math.round(progress.done / progress.total * 100) : 0;

  return <main className="min-h-screen pb-16">
    <header className="border-b border-[#e5ece7] bg-white">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white"><Fingerprint size={21} /></div><div><div className="text-[15px] font-bold tracking-tight">Đối chiếu SMS <span className="text-[#38836a]">1414</span></div><div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#85958d]">Cổng xử lý nội bộ</div></div></div>
        <div className="flex items-center gap-2 rounded-full bg-[#edf7f1] px-3 py-1.5 text-[11px] font-semibold text-[#397c60]"><LockKeyhole size={13} /> Xử lý trên thiết bị</div>
      </div>
    </header>
    <div className="mx-auto max-w-[1180px] px-6 pt-9">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div><div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#dbe8df] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#53826d]"><Sparkles size={12} /> Công cụ nghiệp vụ</div><h1 className="text-[30px] font-bold tracking-[-.04em] text-ink">Đối chiếu & đánh STT</h1><p className="mt-2 max-w-xl text-[13px] leading-6 text-[#71827a]">Khớp số thuê bao trên từng tin nhắn với danh sách Excel. Mỗi STT được lấy nguyên từ dữ liệu gốc.</p></div>
        <div className="mb-1 flex items-center gap-3 text-[11px] text-[#819088]"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#68b890]" />Không gửi tệp lên máy chủ</span><span className="text-[#ccd7d1]">·</span><span>OCR tiếng Việt</span></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.04fr_.96fr]">
        <section className="rounded-[20px] border border-[#e4ebe6] bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">1. Tải lên dữ liệu</h2><p className="mt-1 text-[11px] text-[#85948d]">Chọn PDF tin nhắn và file Excel nhân sự</p></div><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f5f1] text-[12px] font-bold text-[#658171]">01</div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FileDrop title="Chọn PDF SMS" subtitle="PDF · Tối đa 80 MB" accept="application/pdf,.pdf" icon={FileText} file={pdf} disabled={processing} onFile={setPdfFile} onClear={() => { setPdf(null); setResults([]); }} />
            <FileDrop title="Chọn danh sách Excel" subtitle="XLSX, XLS hoặc CSV · Tối đa 20 MB" accept=".xlsx,.xls,.csv" icon={FileSpreadsheet} file={employeeFile} disabled={processing} onFile={(file) => void setExcelFile(file)} onClear={() => { setExcel(null); setEmployeeFile(null); setEmployees([]); setPhoneIndex(-1); setIdIndex(-1); setResults([]); }} />
          </div>
          {excel && <div className="mt-4 rounded-xl border border-[#edf1ee] bg-[#fbfcfb] p-4">
            <div className="mb-3 flex items-center justify-between"><div className="text-xs font-bold">2. Ghép cột Excel <span className="ml-1 font-normal text-[#8b9992]">· {excel.sheetName}</span></div><span className="text-[10px] text-[#88968f]">{excel.rows.length} dòng dữ liệu</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([ ["STT", "stt", sttIndex], ["Số điện thoại", "phone", phoneIndex], ["CCCD (dự phòng)", "id", idIndex], ["Họ tên (tùy chọn)", "name", nameIndex] ] as const).map(([label, key, value]) => <label key={key} className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#75857d]">{label}{(key === "stt" || key === "phone" || key === "id") && <span className="text-[#bd5f5f]">{key === "stt" ? " *" : ""}</span>}</span><div className="relative"><select value={value} onChange={(event) => remap(key, Number(event.target.value))} className="w-full appearance-none rounded-lg border border-[#e0e8e3] bg-white px-2.5 py-2 pr-7 text-[11px] text-ink">
                {(key === "name" || key === "phone" || key === "id") && <option value={-1}>{key === "name" ? "Không chọn" : "Không dùng"}</option>}{excel.columns.map((column, index) => <option key={`${column}-${index}`} value={index}>{column || `Cột ${index + 1}`}</option>)}
              </select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-[#8a9a92]" /></div></label>)}
            </div>
            {<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#edf1ee] pt-3 text-[10px] text-[#6d8077]"><span><b className="text-ink">{makeEmployees(excel, sttIndex, phoneIndex, nameIndex, idIndex).filter((e) => e.normalizedPhone).length}</b> SĐT hợp lệ</span><span><b className="text-ink">{makeEmployees(excel, sttIndex, phoneIndex, nameIndex, idIndex).filter((e) => e.normalizedId).length}</b> CCCD hợp lệ</span><span className="text-[#98a69f]">Ưu tiên SĐT; chỉ tra CCCD khi chưa tìm được SĐT khớp.</span></div>}
            <div className="mt-3 overflow-hidden rounded-lg border border-[#eaf0eb]">
              <div className="grid grid-cols-4 bg-[#f5f8f5] px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-[#87958e]"><span>STT</span><span>Họ tên</span><span>SĐT</span><span>CCCD</span></div>
              {makeEmployees(excel, sttIndex, phoneIndex, nameIndex, idIndex).slice(0, 3).map((person, i) => <div key={`${person.stt}-${i}`} className="grid grid-cols-4 border-t border-[#f0f3f1] px-3 py-2 text-[10px] text-[#465e54]"><span>{person.stt}</span><span className="truncate">{person.name || "—"}</span><span className="font-mono">{person.normalizedPhone || "—"}</span><span className="font-mono">{person.normalizedId || "—"}</span></div>)}
            </div>
          </div>}
        </section>

        <section className="rounded-[20px] border border-[#e4ebe6] bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">3. Cấu hình kết quả</h2><p className="mt-1 text-[11px] text-[#85948d]">Chỉ overlay STT lên trang đã khớp</p></div><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f5f1] text-[12px] font-bold text-[#658171]">02</div></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <label><span className="mb-1.5 block text-[10px] font-semibold text-[#75857d]">Vị trí STT</span><div className="relative"><select value={position} onChange={(e) => setPosition(e.target.value as OverlayPosition)} className="w-full appearance-none rounded-lg border border-[#e0e8e3] bg-white px-3 py-2.5 pr-8 text-xs">{positions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-[#8a9a92]" /></div></label>
            <label><span className="mb-1.5 block text-[10px] font-semibold text-[#75857d]">Cỡ chữ</span><div className="flex items-center rounded-lg border border-[#e0e8e3] px-2"><input type="range" min="10" max="24" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full accent-[#368467]"/><span className="w-8 text-right text-[11px]">{fontSize} pt</span></div></label>
            <label><span className="mb-1.5 block text-[10px] font-semibold text-[#75857d]">Lề trang</span><div className="flex items-center rounded-lg border border-[#e0e8e3] px-2"><input type="range" min="8" max="60" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-[#368467]"/><span className="w-8 text-right text-[11px]">{margin} pt</span></div></label>
            <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-[11px] text-[#556c61]"><input type="checkbox" checked={background} onChange={(e) => setBackground(e.target.checked)} className="accent-[#368467]"/>Nền trắng dễ đọc</label>
          </div>
          <div className="mt-4 rounded-xl bg-[#f5f8f5] p-3.5">
            <div className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 shrink-0 text-[#4c9477]" size={16}/><div><div className="text-[11px] font-bold text-[#365b4a]">Riêng tư theo thiết kế</div><p className="mt-1 text-[10px] leading-5 text-[#74877c]">PDF và Excel được xử lý ngay trong trình duyệt, không tải lên máy chủ. OCR tải engine và dữ liệu tiếng Việt khi cần; nội dung tài liệu vẫn ở trên thiết bị.</p></div></div>
          </div>
          <button onClick={() => void start()} disabled={!ready} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-bold tracking-wide text-white transition hover:bg-[#24524a] disabled:cursor-not-allowed disabled:bg-[#9aaca4]">
            {processing ? <><LoaderCircle size={15} className="animate-spin"/>ĐANG ĐỐI CHIẾU</> : results.length ? <><RotateCcw size={15}/>CHẠY LẠI ĐỐI CHIẾU</> : <>ĐỐI CHIẾU VÀ ĐÁNH STT<ArrowRight size={15}/></>}
          </button>
          {error && <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#fff0f0] p-3 text-[11px] text-[#a34747]"><CircleAlert size={15} className="mt-0.5 shrink-0"/>{error}</div>}
        </section>
      </div>

      {progress && <section className="mt-5 rounded-[20px] border border-[#e4ebe6] bg-white p-5 shadow-card">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">{processing ? "Đang xử lý tài liệu" : results.length ? "Đã xử lý xong" : "Đang chuẩn bị"}</h2><p className="mt-1 text-[11px] text-[#829188]">{progress.currentText}</p></div><div className="text-right"><span className="text-2xl font-bold tracking-tight">{progressPercent}</span><span className="ml-0.5 text-xs text-[#788a81]">%</span></div></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf2ee]"><div className="h-full rounded-full bg-[#55a681] transition-all duration-300" style={{ width: `${progressPercent}%` }} /></div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-[#718279]"><span>Trang <b className="text-ink">{progress.done}</b> / {progress.total || "…"}</span><span>Đã khớp <b className="text-[#39815f]">{progress.matched}</b></span><span>Cần xem lại <b className="text-[#9b6b34">{progress.needsReview}</b></span><span className="ml-auto flex items-center gap-1 text-[#93a098]"><LockKeyhole size={11}/>Xử lý cục bộ</span></div>
      </section>}

      {results.length > 0 && <section className="mt-5 overflow-hidden rounded-[20px] border border-[#e4ebe6] bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9efeb] px-5 py-4">
          <div><div className="flex items-center gap-2"><h2 className="text-sm font-bold">4. Kết quả đối chiếu</h2><span className="rounded-full bg-[#eef4ef] px-2 py-0.5 text-[9px] font-bold text-[#60786b]">{results.length} trang</span></div><p className="mt-1 text-[10px] text-[#819087]">Các trang chưa khớp vẫn được giữ nguyên trong PDF.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={exportReport} className="flex items-center gap-1.5 rounded-lg border border-[#dfe8e2] px-3 py-2 text-[10px] font-semibold text-[#526a5e] hover:bg-[#f7faf7]"><ArrowDownToLine size={13}/>Báo cáo CSV</button><button onClick={() => void exportPdf()} disabled={busyExport} className="flex items-center gap-1.5 rounded-lg bg-[#267355] px-3.5 py-2 text-[10px] font-bold text-white hover:bg-[#1c6146] disabled:opacity-60">{busyExport ? <LoaderCircle size={13} className="animate-spin"/> : <ArrowDownToLine size={13}/>}Tải PDF đã đánh STT</button></div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-b border-[#eef2ef] bg-[#fbfcfb] px-5 py-3 sm:grid-cols-3 lg:grid-cols-6">
          {[["Tổng số trang", results.length, "text-ink"], ["Đã khớp", counts.MATCHED ?? 0, "text-[#36815e]"], ["Không tìm thấy", counts.NOT_FOUND ?? 0, "text-[#9b5b16]"], ["OCR lỗi", counts.OCR_FAILED ?? 0, "text-[#ae4249]"], ["Cần xem lại", results.length - (counts.MATCHED ?? 0), "text-[#9c6d34]"], ["Tỷ lệ khớp", `${results.length ? ((counts.MATCHED ?? 0) / results.length * 100).toFixed(1) : 0}%`, "text-ink"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg border border-[#edf1ee] bg-white px-3 py-2"><div className="text-[9px] text-[#84928a]">{label}</div><div className={`mt-0.5 text-base font-bold ${color}`}>{value}</div></div>)}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3"><div className="flex flex-wrap gap-1.5"><button onClick={() => setFilter("ALL")} className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${filter === "ALL" ? "bg-ink text-white" : "bg-[#f1f5f2] text-[#687970]"}`}>Tất cả · {results.length}</button>{Object.entries(statusNames).filter(([status]) => counts[status]).map(([status, label]) => <button key={status} onClick={() => setFilter(status)} className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${filter === status ? "bg-ink text-white" : statusColor[status]}`}>{label} · {counts[status]}</button>)}</div><div className="hidden items-center gap-1 text-[10px] text-[#94a098] sm:flex"><Search size={12}/>Danh sách trang</div></div>
        <div className="scrollbar-thin max-h-[570px] overflow-auto border-t border-[#eef2ef]"><table className="w-full min-w-[650px] border-collapse text-left text-[11px]"><thead className="sticky top-0 z-10 bg-[#f7f9f7] text-[9px] uppercase tracking-wide text-[#87958e]"><tr><th className="px-5 py-2.5 font-semibold">Trang PDF</th><th className="px-3 py-2.5 font-semibold">Số nhận diện</th><th className="px-3 py-2.5 font-semibold">STT Excel</th><th className="px-3 py-2.5 font-semibold">Trạng thái</th><th className="px-3 py-2.5 font-semibold">Duyệt thủ công</th></tr></thead><tbody>
          {visibleRows.map((row) => <tr key={row.page} className="border-t border-[#f0f3f1] align-middle hover:bg-[#fcfdfc]"><td className="px-5 py-2.5 font-semibold text-[#556b60]">{row.page}</td><td className="px-3 py-2.5"><div className="font-mono text-[10px] text-[#526b5e]">{row.phone || row.candidates.join(", ") || "—"}</div>{(row.id || row.idCandidates.length > 0) && <div className="font-mono text-[10px] text-[#526b5e]">CCCD {row.id || row.idCandidates.join(", ")}</div>}{row.matchedBy && <div className="mt-0.5 text-[9px] text-[#39815f]">Khớp bằng {row.matchedBy === "phone" ? "SĐT" : "CCCD"}</div>}</td><td className="px-3 py-2.5 font-bold text-ink">{row.stt || "—"}</td><td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-semibold ${statusColor[row.status]}`}>{row.status === "MATCHED" && <Check size={10} className="mr-1"/>}{statusNames[row.status]}</span></td><td className="px-3 py-2.5"><div className="flex items-center gap-1"><input value={manual[row.page] ?? ""} onChange={(e) => setManual((old) => ({ ...old, [row.page]: e.target.value }))} placeholder="SĐT hoặc CCCD" className="w-28 rounded-md border border-[#e4eae6] px-2 py-1.5 text-[10px]"/><button title="Xác nhận SĐT hoặc CCCD" onClick={() => confirm(row)} className="rounded-md border border-[#dfe8e2] p-1.5 text-[#378264] hover:bg-[#eff7f2]"><Check size={13}/></button></div></td></tr>)}
        </tbody></table>{visibleRows.length === 0 && <div className="p-8 text-center text-xs text-[#8a9891]">Không có trang trong trạng thái này.</div>}</div>
        <div className="flex items-start gap-2 border-t border-[#e9efeb] bg-[#fbfcfb] px-5 py-3 text-[10px] leading-5 text-[#7b8b82]"><BadgeCheck className="mt-0.5 shrink-0 text-[#5b987b]" size={14}/><span>STT trong PDF lấy trực tiếp từ cột đã chọn của Excel. Chỉ trang <b>Đã khớp</b> được overlay; trang cần xem lại được giữ nguyên nội dung và thứ tự.</span></div>
      </section>}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e9e3] pt-4 text-[10px] text-[#8a9890]"><span className="flex items-center gap-1.5"><LockKeyhole size={12}/>Tệp được giữ trong phiên trình duyệt hiện tại.</span><span>© Công cụ nội bộ · SMS 1414</span></footer>
    </div>
  </main>;
}
