const VN_MOBILE = /^0(?:3|5|7|8|9)\d{8}$/;

/** Normalize formatting and Vietnam's +84 country prefix; never repairs digits. */
export function normalizePhoneNumber(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0084")) digits = digits.slice(2);
  if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;
  return VN_MOBILE.test(digits) ? digits : null;
}

export function isVietnameseMobile(input: string): boolean {
  return normalizePhoneNumber(input) !== null;
}
