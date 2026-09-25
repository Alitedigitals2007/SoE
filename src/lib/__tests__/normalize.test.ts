import { describe, expect, it } from "vitest";
import { matchesReference, normalizeAnswer, sameAnswer } from "@/lib/normalize";

describe("normalizeAnswer", () => {
  it("folds case, spacing and stray punctuation", () => {
    expect(normalizeAnswer("  Newton. ")).toBe("newton");
    expect(sameAnswer("NEWTON", "newton")).toBe(true);
    expect(sameAnswer("The Eiffel Tower", "eiffel tower")).toBe(false);
  });

  it("reads chemistry formulas written with unicode subscripts", () => {
    expect(sameAnswer("H2SO4", "h₂so₄")).toBe(true);
    expect(sameAnswer("NaCl(aq)", "nacl (aq)")).toBe(true);
    expect(sameAnswer("C6H12O6", "c₆h₁₂o₆")).toBe(true);
  });

  it("reads charges written as powers or superscripts", () => {
    expect(sameAnswer("SO4^2-", "SO₄²⁻")).toBe(true);
    expect(sameAnswer("Fe^2+", "Fe²⁺")).toBe(true);
    expect(sameAnswer("H+", "H⁺")).toBe(true);
  });

  it("reads reaction equations regardless of arrow style", () => {
    expect(sameAnswer("2H2 + O2 → 2H2O", "2 H₂ + O₂ -> 2 H₂O")).toBe(true);
    expect(sameAnswer("CH4 + 2O2 => CO2 + 2H2O", "CH₄ + 2O₂ → CO₂ + 2H₂O")).toBe(true);
  });

  it("reads maths formulas regardless of notation", () => {
    expect(sameAnswer("x² + 5x + 6 = 0", "x^2+5x+6=0")).toBe(true);
    expect(sameAnswer("½", "1/2")).toBe(true);
    expect(sameAnswer("3 ÷ 4", "3/4")).toBe(true);
    expect(sameAnswer("2 × 3", "2*3")).toBe(true);
    expect(sameAnswer("5 − 3", "5-3")).toBe(true);
    expect(sameAnswer("π ≈ 3.14", "pi = 3.14")).toBe(false);
  });

  it("keeps genuinely different answers apart", () => {
    expect(sameAnswer("6/2", "6-2")).toBe(false);
    expect(sameAnswer("H2O", "H2O2")).toBe(false);
    expect(sameAnswer("15", "51")).toBe(false);
    expect(sameAnswer("", "")).toBe(true);
  });
});

describe("matchesReference", () => {
  it("matches the answer key in any reasonable spelling", () => {
    expect(matchesReference("2H2O", "2 h₂o")).toBe(true);
    expect(matchesReference("x² + 5x + 6 = 0", "x^2 + 5x + 6 = 0")).toBe(true);
  });

  it("ignores a key that was left blank", () => {
    expect(matchesReference("anything", "   ")).toBe(false);
    expect(matchesReference("  ", "key")).toBe(false);
  });

  it("flags a wrong answer", () => {
    expect(matchesReference("H2O2", "H2O")).toBe(false);
  });
});
