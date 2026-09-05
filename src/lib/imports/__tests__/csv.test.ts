import { describe, it, expect } from "vitest";
import { parseCsv, validateHeaders, templateCsv } from "@/lib/imports/csv";

describe("parseCsv", () => {
  it("parses a simple CSV", () => {
    const csv = "name,email\nJohn,john@test.com\nJane,jane@test.com";
    const result = parseCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.headers).toEqual(["name", "email"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].values).toEqual({ name: "John", email: "john@test.com" });
  });

  it("handles quoted fields with commas", () => {
    const csv = 'name,email\n"John, Jr",john@test.com';
    const result = parseCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows[0].values.name).toBe("John, Jr");
  });

  it("handles quoted fields with escaped quotes", () => {
    const csv = 'name,email\n"John ""Jr""",john@test.com';
    const result = parseCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows[0].values.name).toBe('John "Jr"');
  });

  it("handles CRLF line endings", () => {
    const csv = "name,email\r\nJohn,john@test.com\r\nJane,jane@test.com";
    const result = parseCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });

  it("strips BOM", () => {
    const csv = "\uFEFFname,email\nJohn,john@test.com";
    const result = parseCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.headers).toEqual(["name", "email"]);
  });

  it("reports empty CSV", () => {
    const result = parseCsv("");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("empty");
  });

  it("reports unclosed quoted value", () => {
    const csv = 'name,email\n"John,john@test.com';
    const result = parseCsv(csv);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("unclosed");
  });

  it("reports duplicate headers", () => {
    const csv = "name,name\nJohn,john@test.com";
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.message.includes("more than once"))).toBe(true);
  });

  it("normalizes headers via canonicalHeader", () => {
    const csv = "Full Name,Email Address\nJohn,john@test.com";
    const result = parseCsv(csv);

    expect(result.headers).toEqual(["name", "email"]);
    expect(result.rows[0].values).toEqual({ name: "John", email: "john@test.com" });
  });

  it("applies aliases", () => {
    const csv = "fullname,teamname,referee\nJohn,Lagos United,ref@test.com";
    const result = parseCsv(csv);

    expect(result.headers).toEqual(["name", "team", "refereeEmail"]);
    expect(result.rows[0].values).toEqual({ name: "John", team: "Lagos United", refereeEmail: "ref@test.com" });
  });

  it("trims whitespace in values", () => {
    const csv = "name,email\n  John  ,  john@test.com  ";
    const result = parseCsv(csv);

    expect(result.rows[0].values.name).toBe("John");
    expect(result.rows[0].values.email).toBe("john@test.com");
  });

  it("skips blank rows", () => {
    const csv = "name,email\nJohn,john@test.com\n\n\nJane,jane@test.com";
    const result = parseCsv(csv);

    expect(result.rows).toHaveLength(2);
  });

  it("reports row with more values than header", () => {
    const csv = "name,email\nJohn,john@test.com,extra";
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.message.includes("more values"))).toBe(true);
  });

  it("handles multiline quoted fields", () => {
    const csv = 'name,email\n"Line1\nLine2",john@test.com';
    const result = parseCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows[0].values.name).toBe("Line1\nLine2");
  });

  it("reports column with no header", () => {
    const csv = "name,\nJohn,john@test.com";
    const result = parseCsv(csv);

    expect(result.errors.some((e) => e.message.includes("no header"))).toBe(true);
  });
});

describe("validateHeaders", () => {
  it("returns empty when all required headers present", () => {
    const errors = validateHeaders("players", ["name", "email"]);
    expect(errors).toEqual([]);
  });

  it("reports missing required columns", () => {
    const errors = validateHeaders("players", ["name"]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Email");
  });
});

describe("templateCsv", () => {
  it("returns a CSV template string", () => {
    const csv = templateCsv("players");
    expect(csv).toContain("name");
    expect(csv).toContain("email");
    expect(csv.split("\n").length).toBeGreaterThan(1);
  });
});
