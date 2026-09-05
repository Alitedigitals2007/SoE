export const IMPORT_KINDS = [
  "players",
  "teams",
  "roster",
  "questions",
  "competitionTeams",
  "fixtures",
] as const;

export type ImportKind = (typeof IMPORT_KINDS)[number];

export type CsvValues = Record<string, string>;

export interface ImportRow {
  row: number;
  values: CsvValues;
}

export interface ImportIssue {
  row: number;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportPreview {
  kind: ImportKind;
  totalRows: number;
  validRows: number;
  canImport: boolean;
  issues: ImportIssue[];
  rows: ImportRow[];
}

export interface GeneratedCredential {
  name: string;
  email: string;
  password: string;
  role: "PLAYER" | "REFEREE";
}

export interface ImportCommitResult {
  kind: ImportKind;
  imported: number;
  skipped: number;
  issues: ImportIssue[];
  generatedCredentials: GeneratedCredential[];
  createdMatchCodes: string[];
}

export const IMPORT_DEFINITIONS: Record<
  ImportKind,
  {
    label: string;
    description: string;
    fields: { key: string; label: string; required?: boolean }[];
    sample: string[];
  }
> = {
  players: {
    label: "Player accounts",
    description: "Create player or referee accounts. Leave password blank to generate a temporary password.",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "email", label: "Email", required: true },
      { key: "password", label: "Password" },
      { key: "role", label: "Role (PLAYER or REFEREE)" },
    ],
    sample: ["Example Player,player@example.com,,PLAYER"],
  },
  teams: {
    label: "Teams",
    description: "Create clubs before importing their rosters or entering competitions.",
    fields: [
      { key: "name", label: "Team name", required: true },
      { key: "code", label: "Code (2–3 letters)", required: true },
    ],
    sample: ["Lagos United,LAG"],
  },
  roster: {
    label: "Team rosters",
    description: "Attach registered player emails to teams with squad numbers 1–8.",
    fields: [
      { key: "team", label: "Team slug, code, or name", required: true },
      { key: "playerEmail", label: "Player email", required: true },
      { key: "number", label: "Squad number 1–8", required: true },
    ],
    sample: ["lagos-united,player@example.com,7"],
  },
  questions: {
    label: "Match questions",
    description: "Add prepared questions to a draft match. Optionally assign played slots 1–10.",
    fields: [
      { key: "matchCode", label: "Match code", required: true },
      { key: "text", label: "Question", required: true },
      { key: "referenceAnswer", label: "Reference answer", required: true },
      { key: "playSlot", label: "Played slot 1–10" },
    ],
    sample: ["ABC123,What is the SI unit of force?,Newton,1"],
  },
  competitionTeams: {
    label: "Competition teams",
    description: "Add existing teams to a league or cup. Seed is optional and used for knockout order.",
    fields: [
      { key: "competitionSlug", label: "Competition slug", required: true },
      { key: "teamSlug", label: "Team slug", required: true },
      { key: "seed", label: "Seed" },
    ],
    sample: ["elite-premier-league-2026-27,lagos-united,1"],
  },
  fixtures: {
    label: "Competition fixtures",
    description: "Create draft fixtures from teams already in a competition. Match codes are generated automatically.",
    fields: [
      { key: "competitionSlug", label: "Competition slug", required: true },
      { key: "homeTeamSlug", label: "Home team slug", required: true },
      { key: "awayTeamSlug", label: "Away team slug", required: true },
      { key: "refereeEmail", label: "Referee email" },
      { key: "cupRound", label: "Cup round" },
      { key: "countdownSeconds", label: "Countdown seconds" },
    ],
    sample: ["elite-premier-league-2026-27,lagos-united,abuja-stars,ref@example.com,,15"],
  },
};
