export interface Employee {
  stt: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  id: string;
  normalizedId: string;
}

export interface EmployeeImport {
  rows: string[][];
  columns: string[];
  sheetName: string;
  fileName: string;
}
