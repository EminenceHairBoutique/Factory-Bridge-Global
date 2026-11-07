/**
 * Deterministic, conservative input-token estimator used for the per-call token cap BEFORE a
 * request is sent (so an oversized document is refused without spending money). It deliberately
 * over-estimates: CJK code points count as one token each; everything else as ~3 characters per
 * token. The provider's real `usage` numbers are what gets accounted after the call.
 */

/** CJK radicals/symbols/punctuation, kana, CJK unified ideographs (+ ext A), compatibility, full-width forms. */
function isCjk(cp: number): boolean {
  return (
    (cp >= 0x2e80 && cp <= 0x2fdf) ||
    (cp >= 0x3000 && cp <= 0x30ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (isCjk(ch.codePointAt(0) ?? 0)) cjk += 1;
    else other += 1;
  }
  return cjk + Math.ceil(other / 3);
}
