/**
 * swissValidators — Validation and formatting for Swiss healthcare identifiers.
 *
 * GLN   (EAN-13):       13-digit global location number, check-digit validated
 * AHV   (NAVS13):       Swiss social security number; starts with 756, 13 digits, dots optional
 * VEKA  (EKVK/EHIC):   20-digit European health insurance card number; starts with 80 + ISO-3166-1 numeric
 * UID   (CHE):          Swiss company identifier: CHE-XXX.XXX.XXX
 * ZSR   (Zahlstelle):   Letter + 6 digits, e.g. Z123456
 * BUR   (Betriebs-ID):  8 digits
 *
 * Regex overrides via NEXT_PUBLIC_ env vars (all optional, hard-coded defaults apply):
 *   NEXT_PUBLIC_REGEX_GLN   — override GLN digit pattern (without anchors)
 *   NEXT_PUBLIC_REGEX_AHV   — override AHV pattern
 *   NEXT_PUBLIC_REGEX_VEKA  — override VEKA pattern
 *   NEXT_PUBLIC_REGEX_UID   — override UID pattern
 *   NEXT_PUBLIC_REGEX_ZSR   — override ZSR pattern
 *   NEXT_PUBLIC_REGEX_BUR   — override BUR pattern
 *
 * Identifier FHIR systems:
 *   AHV  → urn:oid:2.16.756.5.32
 *   GLN  → urn:oid:2.51.1.3
 *   UID  → urn:oid:2.16.756.5.35
 *   ZSR  → urn:oid:2.16.756.5.30.1.123.100.2.1.1
 *   BUR  → urn:oid:2.16.756.5.45
 *   VEKA → urn:oid:2.16.756.5.30.1.123.100.1.1
 */

// ── ENV-overridable regex factory ────────────────────────────────────────────

function envRegex(envKey: string, fallback: string): RegExp {
  const raw = typeof process !== "undefined"
    ? process.env[envKey]
    : undefined;
  try {
    return raw ? new RegExp(raw) : new RegExp(fallback);
  } catch {
    console.warn(`[swissValidators] Invalid regex in ${envKey}, using default`);
    return new RegExp(fallback);
  }
}

// Lazily evaluated so Next.js can inject NEXT_PUBLIC_ vars at module load time
const REGEX = {
  get gln()  { return envRegex("NEXT_PUBLIC_REGEX_GLN",  "^\\d{13}$"); },
  get ahv()  { return envRegex("NEXT_PUBLIC_REGEX_AHV",  "^756\\d{10}$"); },
  get veka() { return envRegex("NEXT_PUBLIC_REGEX_VEKA", "^80\\d{18}$"); },
  get uid()  { return envRegex("NEXT_PUBLIC_REGEX_UID",  "^CHE-\\d{3}\\.\\d{3}\\.\\d{3}$"); },
  get zsr()  { return envRegex("NEXT_PUBLIC_REGEX_ZSR",  "^[A-Z]\\d{6}$"); },
  get bur()  { return envRegex("NEXT_PUBLIC_REGEX_BUR",  "^\\d{8}$"); },
};

/** FHIR OID system URLs for each identifier type */
export const IDENTIFIER_SYSTEMS = {
  AHV:  "urn:oid:2.16.756.5.32",
  GLN:  "urn:oid:2.51.1.3",
  UID:  "urn:oid:2.16.756.5.35",
  ZSR:  "urn:oid:2.16.756.5.30.1.123.100.2.1.1",
  BUR:  "urn:oid:2.16.756.5.45",
  VEKA: "urn:oid:2.16.756.5.30.1.123.100.1.1",
} as const;

// ── Country map (ISO-3166-1 numeric → display name) ───────────────────────────

export const VEKA_COUNTRIES: Record<string, string> = {
  "040": "Österreich (AT)",
  "056": "Belgien (BE)",
  "100": "Bulgarien (BG)",
  "191": "Kroatien (HR)",
  "196": "Zypern (CY)",
  "203": "Tschechien (CZ)",
  "208": "Dänemark (DK)",
  "233": "Estland (EE)",
  "246": "Finnland (FI)",
  "250": "Frankreich (FR)",
  "276": "Deutschland (DE)",
  "300": "Griechenland (GR)",
  "348": "Ungarn (HU)",
  "372": "Irland (IE)",
  "380": "Italien (IT)",
  "428": "Lettland (LV)",
  "438": "Liechtenstein (LI)",
  "440": "Litauen (LT)",
  "442": "Luxemburg (LU)",
  "470": "Malta (MT)",
  "528": "Niederlande (NL)",
  "578": "Norwegen (NO)",
  "616": "Polen (PL)",
  "620": "Portugal (PT)",
  "642": "Rumänien (RO)",
  "703": "Slowakei (SK)",
  "705": "Slowenien (SI)",
  "724": "Spanien (ES)",
  "752": "Schweden (SE)",
  "756": "Schweiz (CH)",
  "826": "Vereinigtes Königreich (GB)",
};

export interface ValidationResult {
  valid:   boolean;
  error?:  string;
  hint?:   string;
}

// ── GLN (EAN-13) ──────────────────────────────────────────────────────────────

/** EAN-13 check digit validation */
function ean13CheckDigit(digits: string): boolean {
  if (digits.length !== 13) return false;
  const sum = digits
    .slice(0, 12)
    .split("")
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

export function validateGln(raw: string): ValidationResult {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return { valid: false };
  if (digits.length !== 13) {
    return { valid: false, error: `GLN muss 13 Stellen haben (aktuell: ${digits.length})` };
  }
  if (!ean13CheckDigit(digits)) {
    return { valid: false, error: "GLN Prüfziffer ungültig" };
  }
  return { valid: true };
}

/** Strip non-digits, enforce max 13, allow only digits in input */
export function sanitizeGln(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 13);
}

// ── AHV (NAVS13) ─────────────────────────────────────────────────────────────

/** Normalize AHV: strip dots and spaces → 13 raw digits */
export function normalizeAhv(raw: string): string {
  return raw.replace(/[\s.]/g, "");
}

/** Format AHV as 756.XXXX.XXXX.XX */
export function formatAhv(raw: string): string {
  const d = normalizeAhv(raw);
  if (d.length !== 13) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 7)}.${d.slice(7, 11)}.${d.slice(11)}`;
}

export function validateAhv(raw: string): ValidationResult {
  const d = normalizeAhv(raw);
  if (d.length === 0) return { valid: false };
  if (!/^\d+$/.test(d)) {
    return { valid: false, error: "AHV darf nur Ziffern und Punkte enthalten" };
  }
  if (!d.startsWith("756")) {
    return { valid: false, error: "AHV muss mit 756 beginnen (Schweizer Ländercode)" };
  }
  if (d.length !== 13) {
    return { valid: false, error: `AHV muss 13 Stellen haben (aktuell: ${d.length})` };
  }
  return {
    valid: true,
    hint:  `Formatiert: ${formatAhv(d)}`,
  };
}

/** Allow digit and dot input; auto-insert dots at positions 3, 8, 13 */
export function sanitizeAhv(raw: string): string {
  // Remove everything except digits and dots
  const clean = raw.replace(/[^\d.]/g, "");
  // If user typed dots themselves, normalize through format
  const digits = clean.replace(/\./g, "").slice(0, 13);
  if (digits.length === 0) return "";
  // Auto-format with dots as digits are typed
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 7)}.${digits.slice(7)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 7)}.${digits.slice(7, 11)}.${digits.slice(11)}`;
}

// ── VEKA (European Health Insurance Card) ────────────────────────────────────

/** Detect country from VEKA number (returns ISO numeric code or null) */
export function detectVekaCountry(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits.startsWith("80") || digits.length < 5) return null;
  const code = digits.slice(2, 5);
  return VEKA_COUNTRIES[code] !== undefined ? code : null;
}

export function validateVeka(raw: string): ValidationResult {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return { valid: false };
  if (!digits.startsWith("80")) {
    return { valid: false, error: "Versicherungskartennummer muss mit 80 beginnen" };
  }
  if (digits.length < 5) {
    return { valid: false, error: "Zu kurz — Ländercode fehlt" };
  }
  const code = digits.slice(2, 5);
  const country = VEKA_COUNTRIES[code];
  if (!country) {
    return {
      valid: false,
      error: `Unbekannter Ländercode 80${code} — bekannte Codes: 756 (CH), 438 (LI), 276 (DE) …`,
    };
  }
  if (digits.length !== 20) {
    return {
      valid: false,
      error: `Versicherungskartennummer muss 20 Stellen haben (aktuell: ${digits.length})`,
      hint: `Land erkannt: ${country}`,
    };
  }
  return {
    valid: true,
    hint: `Land: ${country}`,
  };
}

export function sanitizeVeka(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 20);
}

// ── UID (Unternehmens-Identifikationsnummer) ──────────────────────────────────

/** Format UID as CHE-XXX.XXX.XXX */
export function formatUid(raw: string): string {
  const digits = raw.replace(/[^0-9CHEche\-\.]/g, "");
  const nums = digits.replace(/\D/g, "").slice(0, 9);
  if (nums.length === 0) return "";
  if (nums.length <= 3) return `CHE-${nums}`;
  if (nums.length <= 6) return `CHE-${nums.slice(0, 3)}.${nums.slice(3)}`;
  return `CHE-${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
}

export function sanitizeUid(raw: string): string {
  // Allow CHE- prefix and dots; auto-format as user types digits
  return formatUid(raw);
}

export function validateUid(raw: string): ValidationResult {
  const v = raw.trim().toUpperCase();
  if (!v) return { valid: false };
  if (!REGEX.uid.test(v)) {
    return { valid: false, error: "Format: CHE-XXX.XXX.XXX (9 Ziffern nach CHE-)" };
  }
  return { valid: true, hint: `UID: ${v}` };
}

// ── ZSR (Zahlstellenregister) ─────────────────────────────────────────────────

export function sanitizeZsr(raw: string): string {
  // First char letter, rest digits, max 7 chars
  const upper = raw.toUpperCase();
  if (upper.length === 0) return "";
  const letter = /^[A-Z]/.test(upper) ? upper[0] : "";
  const digits = upper.slice(letter ? 1 : 0).replace(/\D/g, "").slice(0, 6);
  return letter + digits;
}

export function validateZsr(raw: string): ValidationResult {
  const v = raw.trim().toUpperCase();
  if (!v) return { valid: false };
  if (!REGEX.zsr.test(v)) {
    return { valid: false, error: "Format: Buchstabe + 6 Ziffern, z.B. Z123456" };
  }
  return { valid: true, hint: `ZSR: ${v}` };
}

// ── BUR (Betriebs- und Unternehmensregister) ──────────────────────────────────

export function sanitizeBur(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function validateBur(raw: string): ValidationResult {
  const v = raw.trim();
  if (!v) return { valid: false };
  if (!REGEX.bur.test(v)) {
    return { valid: false, error: `BUR muss 8 Ziffern haben (aktuell: ${v.length})` };
  }
  return { valid: true };
}

// ── Also update existing validators to use REGEX object ───────────────────────
// (GLN uses its own EAN-13 algorithm, REGEX.gln is a fallback for override only)

/** Known country prefixes for dropdown, sorted by relevance */
export const VEKA_COUNTRY_OPTIONS = [
  { code: "756", label: "Schweiz (CH) — 80756…" },
  { code: "438", label: "Liechtenstein (LI) — 80438…" },
  { code: "276", label: "Deutschland (DE) — 80276…" },
  { code: "040", label: "Österreich (AT) — 80040…" },
  { code: "250", label: "Frankreich (FR) — 80250…" },
  { code: "380", label: "Italien (IT) — 80380…" },
  { code: "528", label: "Niederlande (NL) — 80528…" },
  { code: "056", label: "Belgien (BE) — 80056…" },
  { code: "724", label: "Spanien (ES) — 80724…" },
  { code: "442", label: "Luxemburg (LU) — 80442…" },
  ...Object.entries(VEKA_COUNTRIES)
    .filter(([c]) => !["756","438","276","040","250","380","528","056","724","442"].includes(c))
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, label]) => ({ code, label })),
];
