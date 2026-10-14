export const redeemCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

/** Codes are stored canonically in upper case so players can type them in any case. */
export function normalizeRedeemCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return redeemCodePattern.test(code) ? code : null;
}
