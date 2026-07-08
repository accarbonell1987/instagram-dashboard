// ─── Dial codes ───────────────────────────────────────────────────────────────

export const LATAM_DIAL_CODES = [
  { code: '+595', label: 'PY +595' }, // Paraguay — default
  { code: '+54', label: 'AR +54' },
  { code: '+55', label: 'BR +55' },
  { code: '+56', label: 'CL +56' },
  { code: '+57', label: 'CO +57' },
  { code: '+51', label: 'PE +51' },
  { code: '+593', label: 'EC +593' },
  { code: '+591', label: 'BO +591' },
  { code: '+598', label: 'UY +598' },
  { code: '+52', label: 'MX +52' },
] as const;

export type DialCode = (typeof LATAM_DIAL_CODES)[number]['code'];

// Sort descending by code length to avoid prefix collision (+593 before +59x)
export const SORTED_CODES = [...LATAM_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);

export function splitPhone(phone: string): { dialCode: DialCode; localNumber: string } {
  for (const { code } of SORTED_CODES) {
    if (phone.startsWith(code)) {
      return { dialCode: code, localNumber: phone.slice(code.length) };
    }
  }
  return { dialCode: '+595', localNumber: phone };
}

// ─── Phone formats per country ────────────────────────────────────────────────

export const PHONE_FORMATS: Record<DialCode, { digits: number; groups: readonly number[] }> = {
  '+595': { digits: 9, groups: [3, 3, 3] }, // PY: 021 234 567
  '+54': { digits: 10, groups: [3, 3, 4] }, // AR: 011 123 4567
  '+55': { digits: 11, groups: [2, 5, 4] }, // BR: 11 98765 4321
  '+56': { digits: 9, groups: [1, 4, 4] }, // CL: 9 1234 5678
  '+57': { digits: 10, groups: [3, 3, 4] }, // CO: 312 345 6789
  '+51': { digits: 9, groups: [3, 3, 3] }, // PE: 987 654 321
  '+593': { digits: 9, groups: [2, 3, 4] }, // EC: 09 876 5432
  '+591': { digits: 8, groups: [4, 4] }, // BO: 7123 4567
  '+598': { digits: 9, groups: [4, 5] }, // UY: 099 12345
  '+52': { digits: 10, groups: [3, 3, 4] }, // MX: 555 123 4567
} as const;
