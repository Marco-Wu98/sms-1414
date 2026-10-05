export function normalizeCccd(value: string): string {
  const digits = value.replace(/\D/g, "");
  return /^\d{12}$/.test(digits) ? digits : "";
}
