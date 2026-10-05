import * as XLSX from "xlsx";
import type { Employee, EmployeeImport } from "@/types/employee";

export function readExcelFile(file: File): Promise<EmployeeImport> {
  return file.arrayBuffer().then((buffer) => {
    const book = XLSX.read(buffer, { type: "array", cellDates: false });
    const sheetName = book.SheetNames[0];
    if (!sheetName) throw new Error("Workbook không có sheet dữ liệu.");
    const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], { header: 1, raw: false, defval: "" })
      .map((row) => row.map((cell) => String(cell ?? "").trim()));
    const headerIndex = grid.findIndex((row) => row.some(Boolean));
    if (headerIndex < 0) throw new Error("Không tìm thấy hàng tiêu đề trong sheet đầu tiên.");
    const columns = grid[headerIndex].map((label, index) => label || `Cột ${index + 1}`);
    const rows = grid.slice(headerIndex + 1).filter((row) => row.some(Boolean));
    return { rows, columns, sheetName, fileName: file.name };
  });
}

export function makeEmployees(data: EmployeeImport, sttIndex: number, phoneIndex: number, nameIndex = -1, idIndex = -1): Employee[] {
  return data.rows.flatMap((row) => {
    const stt = (row[sttIndex] ?? "").trim();
    const phone = phoneIndex >= 0 ? (row[phoneIndex] ?? "").trim() : "";
    const id = idIndex >= 0 ? (row[idIndex] ?? "").trim() : "";
    if (!stt || (!phone && !id)) return [];
    const digits = phone.replace(/\D/g, "");
    let normalizedPhone = digits;
    if (digits.startsWith("84") && digits.length === 11) normalizedPhone = `0${digits.slice(2)}`;
    if (!/^0[35789]\d{8}$/.test(normalizedPhone)) normalizedPhone = "";
    const normalizedId = /^\d{12}$/.test(id.replace(/\D/g, "")) ? id.replace(/\D/g, "") : "";
    if (!normalizedPhone && !normalizedId) return [];
    return [{ stt, phone, name: nameIndex >= 0 ? row[nameIndex] ?? "" : "", normalizedPhone, id, normalizedId }];
  });
}
