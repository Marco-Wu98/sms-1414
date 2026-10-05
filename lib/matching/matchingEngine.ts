import type { Employee } from "../../types/employee";
import type { PageResult, PageStatus } from "../../types/pageResult";
import { extractCccdCandidates } from "../phone/extractCccd";
import { extractPhoneCandidates } from "../phone/extractPhone";
import { normalizeCccd } from "../phone/normalizeCccd";
import { normalizePhoneNumber } from "../phone/normalizePhone";

export interface EmployeeMaps { phones: Map<string, Employee[]>; ids: Map<string, Employee[]> }
function addToMap(map: Map<string, Employee[]>, key: string, employee: Employee) {
  if (!key) return;
  const list = map.get(key) ?? [];
  list.push(employee);
  map.set(key, list);
}
export function buildEmployeeMaps(employees: Employee[]): EmployeeMaps {
  const phones = new Map<string, Employee[]>();
  const ids = new Map<string, Employee[]>();
  for (const employee of employees) { addToMap(phones, employee.normalizedPhone, employee); addToMap(ids, employee.normalizedId, employee); }
  return { phones, ids };
}
export function buildPhoneMap(employees: Employee[]) { return buildEmployeeMaps(employees).phones; }
function resolve(page: number, text: string, candidates: string[], idCandidates: string[], maps: EmployeeMaps): PageResult {
  let status: PageStatus = "NOT_FOUND";
  let phone = "", id = "", stt = "", matchedBy: PageResult["matchedBy"] = "";
  if (!text.trim()) status = "OCR_FAILED";
  else {
    const phoneHits = candidates.filter((candidate) => maps.phones.has(candidate));
    if (phoneHits.length > 1) status = "MULTIPLE_PHONE";
    else if (phoneHits.length === 1) {
      phone = phoneHits[0];
      const employees = maps.phones.get(phone)!;
      if (employees.length > 1) status = "DUPLICATE_PHONE";
      else { status = "MATCHED"; stt = employees[0].stt; matchedBy = "phone"; }
    } else {
      const idHits = idCandidates.filter((candidate) => maps.ids.has(candidate));
      if (idHits.length > 1) status = "MULTIPLE_ID";
      else if (idHits.length === 1) {
        id = idHits[0];
        const employees = maps.ids.get(id)!;
        if (employees.length > 1) status = "DUPLICATE_ID";
        else { status = "MATCHED"; stt = employees[0].stt; matchedBy = "id"; }
      } else if (candidates.length > 1) status = "MULTIPLE_PHONE";
    }
  }
  return { page, extractedText: text, candidates, phone, normalizedPhone: phone, idCandidates, id, normalizedId: id, matchedBy, stt, status, source: "auto" };
}
export function matchPage(page: number, text: string, employeesOrMaps: Employee[] | EmployeeMaps | Map<string, Employee[]>): PageResult {
  const maps: EmployeeMaps = Array.isArray(employeesOrMaps) ? buildEmployeeMaps(employeesOrMaps) : employeesOrMaps instanceof Map ? { phones: employeesOrMaps, ids: new Map() } : employeesOrMaps;
  return resolve(page, text, extractPhoneCandidates(text).map((item) => item.normalized), extractCccdCandidates(text).map((item) => item.normalized), maps);
}

export function confirmManualPhone(result: PageResult, input: string, employees: Employee[]): PageResult {
  const maps = buildEmployeeMaps(employees);
  const phone = normalizePhoneNumber(input);
  if (phone) {
    const matches = maps.phones.get(phone) ?? [];
    if (matches.length > 1) return { ...result, phone, normalizedPhone: phone, stt: "", status: "DUPLICATE_PHONE", matchedBy: "", source: "manual" };
    if (matches.length === 1) return { ...result, phone, normalizedPhone: phone, id: "", normalizedId: "", stt: matches[0].stt, status: "MATCHED", matchedBy: "phone", source: "manual" };
  }
  const id = normalizeCccd(input);
  const matches = id ? maps.ids.get(id) ?? [] : [];
  if (matches.length > 1) return { ...result, id, normalizedId: id, stt: "", status: "DUPLICATE_ID", matchedBy: "", source: "manual" };
  if (matches.length === 1) return { ...result, id, normalizedId: id, phone: "", normalizedPhone: "", stt: matches[0].stt, status: "MATCHED", matchedBy: "id", source: "manual" };
  return { ...result, phone: phone || input, normalizedPhone: phone || "", id, normalizedId: id, stt: "", status: "NOT_FOUND", matchedBy: "", source: "manual" };
}
