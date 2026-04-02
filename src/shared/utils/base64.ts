/**
 * Shared Base64 utilities.
 *
 * Previously duplicated in:
 *  - app/patient/[id]/befunde/page.tsx
 *  - app/patient/[id]/PatientDetailClient.tsx
 *  - presentation/components/ResultList.tsx
 */

/**
 * Wrap a raw Base64 string in a data: URI so it can be used as an
 * `<iframe src>` or `<a href>` for inline rendering.
 */
export function b64toDataUrl(b64: string, mime: string): string {
  return `data:${mime};base64,${b64}`;
}

/**
 * Decode a Base64-encoded UTF-8 string to a plain JavaScript string.
 * Falls back to a simple `atob` call if the percent-decoding fails.
 */
export function decodeB64Utf8(b64: string): string {
  try {
    return decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch {
    return atob(b64);
  }
}
