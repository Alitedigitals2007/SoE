import type { ImportKind, ImportRow } from "@/lib/imports/types";
import { IMPORT_DEFINITIONS } from "@/lib/imports/types";

export interface CsvParseResult {
  headers: string[];
  rows: ImportRow[];
  errors: { row: number; message: string }[];
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const ALIASES: Record<string, string> = {
  fullname: "name",
  playername: "name",
  teamname: "team",
  teamcode: "team",
  teamslug: "teamSlug",
  emailaddress: "email",
  playeremailaddress: "playerEmail",
  player: "playerEmail",
  reference: "referenceAnswer",
  correctanswer: "referenceAnswer",
  answers: "referenceAnswer",
  slot: "playSlot",
  playedslot: "playSlot",
  competition: "competitionSlug",
  competitionname: "competitionSlug",
  hometeam: "homeTeamSlug",
  awayteam: "awayTeamSlug",
  referee: "refereeEmail",
  refereeemailaddress: "refereeEmail",
  countdown: "countdownSeconds",
  seconds: "countdownSeconds",
};

function canonicalHeader(header: string): string {
  const normalized = normalizeHeader(header);
  return ALIASES[normalized] ?? header.trim();
}

/** Small RFC-4180-compatible parser. It handles quoted commas, quotes and newlines. */
export function parseCsv(text: string): CsvParseResult {
  const source = text.replace(/^\uFEFF/, "");
  const records: { values: string[]; line: number }[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowStart = 1;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim() !== "")) records.push({ values: row, line: rowStart });
    row = [];
    rowStart = line;
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
        if (char === "\n") line++;
      }
      continue;
    }
    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ",") {
      pushCell();
    } else if (char === "\r") {
      if (next === "\n") i++;
      pushRow();
      line++;
    } else if (char === "\n") {
      pushRow();
      line++;
    } else {
      cell += char;
    }
  }
  if (quoted) return { headers: [], rows: [], errors: [{ row: line, message: "The CSV has an unclosed quoted value." }] };
  if (row.length > 0 || cell.length > 0) pushRow();

  if (records.length === 0) return { headers: [], rows: [], errors: [{ row: 1, message: "The CSV is empty." }] };
  const headers = records[0].values.map(canonicalHeader);
  const errors: CsvParseResult["errors"] = [];
  const seen = new Set<string>();
  headers.forEach((header, index) => {
    if (!header) errors.push({ row: 1, message: `Column ${index + 1} has no header.` });
    if (seen.has(header)) errors.push({ row: 1, message: `The column “${header}” appears more than once.` });
    seen.add(header);
  });

  const rows: ImportRow[] = [];
  for (const record of records.slice(1)) {
    if (record.values.length > headers.length) {
      errors.push({ row: record.line, message: "This row has more values than the header." });
      continue;
    }
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = (record.values[index] ?? "").trim();
    });
    rows.push({ row: record.line, values });
  }
  return { headers, rows, errors };
}

export function validateHeaders(kind: ImportKind, headers: string[]) {
  const expected = IMPORT_DEFINITIONS[kind].fields;
  const available = new Set(headers);
  return expected
    .filter((field) => field.required && !available.has(field.key))
    .map((field) => `Missing required column “${field.label}”.`);
}

export function templateCsv(kind: ImportKind): string {
  const definition = IMPORT_DEFINITIONS[kind];
  const header = definition.fields.map((field) => field.key).join(",");
  return `${header}\n${definition.sample.join("\n")}\n`;
}
