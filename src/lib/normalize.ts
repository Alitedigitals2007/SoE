/**
 * Answer normalisation. The system groups plausibly-equivalent answers
 * (Newton / newton / NEWTON / "Newton" ) but the referee is always the
 * final authority — normalisation only aids their review.
 */

const DIACRITICS = /[\u0300-\u036f]/g;
const PUNCTUATION = /[^\p{L}\p{N}\s'.\-/\u00b0]/gu;

export function normalizeAnswer(raw: string): string {
  return (
    raw
      .normalize("NFKD")
      .replace(DIACRITICS, "")
      .replace(PUNCTUATION, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      // strip a single trailing full stop after the last word (e.g. "newton.")
      .replace(/\.$/, "")
      .trim()
  );
}

/** Two answers are "the same" when normalised equal. */
export function sameAnswer(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}
