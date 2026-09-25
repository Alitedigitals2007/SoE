/**
 * Answer normalisation. The system groups plausibly-equivalent answers
 * (Newton / newton / NEWTON / "Newton" ) but the referee is always the
 * final authority — normalisation only aids their review.
 *
 * Science answers need special care: chemistry (H2SO4, 2H2 + O2 → 2H2O, SO4^2-)
 * and maths (x² + 5x + 6 = 0, 3/4, 6.02e23) all arrive in different spellings,
 * so every unicode variant of an operator/digit is folded to one ASCII form
 * before comparing.
 */

const DIACRITICS = /[̀-ͯ]/g;
/** Letters, digits, whitespace, and the handful of symbols worth keeping. */
const PUNCTUATION = /[^\p{L}\p{N}\s'.\-/°]/gu;

/** Unicode superscripts (U+00B2, U+2070–U+209F block) → ASCII. */
const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "ⁿ": "n", "ⁱ": "i",
};

/** Unicode subscripts → ASCII (chemists type H₂O as often as H2O). */
const SUBSCRIPTS: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "₊": "+", "₋": "-", "ₙ": "n",
};

/** Every spelling of "minus" people use: − – — ‐ ‑. */
const MINUSES = /[−–—‐‑‒]/g;
/** Every spelling of "times". */
const MULTIPLIES = /[×·∙⋅∗✕✖]/g;
/** Every spelling of "divided by". */
const DIVIDES = /[÷∕⁄]/g;
/** Reaction/equality arrows — all fold to a bare separator. */
const ARROWS = /(<->|<=>|→|⇒|⟶|➜|➔|⇾|↦|➜)|[-–—]>|=/g;

/**
 * LaTeX sources → plain text before folding, so an answer typed as
 * `$\frac{3}{4}$` matches "3/4" and `\times` behaves like ×. One brace level
 * is unwrapped (quiz answers rarely nest deeper); any other macro name is
 * dropped so `\left(`, `\mathrm{...}` etc. leave only their payload.
 */
function stripLatex(raw: string): string {
  return raw
    .replace(/\$\$?/g, "") // $ and $$ math delimiters
    .replace(/\\[()[\]]/g, "") // \( \) \[ \]
    .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:times|cdot)\b/g, "*")
    .replace(/\\div\b/g, "/")
    .replace(/\\(?:left|right|displaystyle|limits|mathrm|text|mathbf|mathit)\b/g, " ")
    .replace(/\\[a-zA-Z]+\*?/g, " "); // any other macro → bare separator
}

export function normalizeAnswer(raw: string): string {
  return (
    stripLatex(raw)
      // NFKD folds ²→2, ₂→2, ⁻→-, ₊→+, full-width forms, ½→1⁄2, ﬁ→fi …
      .normalize("NFKD")
      .replace(DIACRITICS, "")
      .replace(/[⁰¹²³⁴-⁹⁺⁻ⁿⁱ]/g, (c) => SUPERSCRIPTS[c] ?? c)
      .replace(/[₀₁₂₃₄-₉₊₋ₙ]/g, (c) => SUBSCRIPTS[c] ?? c)
      .replace(MINUSES, "-")
      .replace(MULTIPLIES, "*")
      .replace(DIVIDES, "/")
      .replace(ARROWS, " ")
      .replace(PUNCTUATION, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      // strip a single trailing full stop after the last word (e.g. "newton.")
      .replace(/\.$/, "")
      .trim()
  );
}

/**
 * Two answers are "the same" once folded to ASCII *and* with spacing removed:
 * "2H2 + O2 → 2H2O" and "2 H₂ + O₂ -> 2 H₂O" only differ by where the
 * typist put their spaces, and "SO4^2-" must match "SO₄²⁻" even though the
 * caret contributes a gap after folding.
 */
export function sameAnswer(a: string, b: string): boolean {
  const ca = compactAnswer(a);
  const cb = compactAnswer(b);
  if (!ca || !cb) return ca === cb;
  return ca === cb;
}

/** Normalised answer with every space removed — the canonical comparison form. */
export function compactAnswer(raw: string): string {
  return normalizeAnswer(raw).replace(/\s+/g, "");
}

/**
 * Does this submission match the question's answer key?
 * Used to pre-highlight the reference match for the referee — they still decide.
 */
export function matchesReference(submission: string, reference: string): boolean {
  if (!normalizeAnswer(submission) || !normalizeAnswer(reference)) return false;
  return sameAnswer(submission, reference);
}
