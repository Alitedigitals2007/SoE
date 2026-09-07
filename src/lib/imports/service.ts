import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { generateMatchCode } from "@/lib/matchCode";
import { parseCsv, validateHeaders } from "@/lib/imports/csv";
import type {
  GeneratedCredential,
  ImportCommitResult,
  ImportIssue,
  ImportKind,
  ImportPreview,
  ImportRow,
} from "@/lib/imports/types";

export const MAX_IMPORT_ROWS = 500;

export type ImportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues: ImportIssue[] };

type Context = Awaited<ReturnType<typeof loadContext>>;

const issue = (row: number, message: string, field?: string): ImportIssue => ({
  row,
  field,
  message,
  severity: "error",
});

function value(row: ImportRow, key: string): string {
  return (row.values[key] ?? "").trim();
}

function lower(valueToNormalize: string): string {
  return valueToNormalize.trim().toLowerCase();
}

function emailName(email: string): string {
  const local = email.split("@")[0] ?? "player";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "team"
  );
}

function generatedPassword(): string {
  return `SOE-${crypto.randomBytes(8).toString("base64url")}`;
}

function parseInteger(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return parsed >= min && parsed <= max ? parsed : null;
}

async function loadContext() {
  const [users, teams, competitions, matches] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.team.findMany({
      include: { members: { select: { userId: true, number: true } } },
    }),
    prisma.competition.findMany({
      include: { teams: { select: { teamId: true, seed: true } } },
    }),
    prisma.match.findMany({
      include: {
        questions: { select: { order: true, roundNumber: true } },
        homeTeam: { select: { id: true, slug: true } },
        awayTeam: { select: { id: true, slug: true } },
      },
    }),
  ]);
  return { users, teams, competitions, matches };
}

export async function previewImport(kind: ImportKind, csv: string): Promise<ImportPreview> {
  const parsed = parseCsv(csv);
  const issues: ImportIssue[] = parsed.errors.map((e) => issue(e.row, e.message));
  issues.push(...validateHeaders(kind, parsed.headers).map((message) => issue(1, message)));

  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    issues.push(issue(2, `Import up to ${MAX_IMPORT_ROWS} rows at a time.`));
  }
  if (issues.length > 0 && parsed.rows.length === 0) {
    return { kind, totalRows: 0, validRows: 0, canImport: false, issues, rows: [] };
  }

  const context = await loadContext();
  issues.push(...validateRows(kind, parsed.rows, context));
  const badRows = new Set(issues.filter((entry) => entry.severity === "error").map((entry) => entry.row));

  return {
    kind,
    totalRows: parsed.rows.length,
    validRows: parsed.rows.filter((row) => !badRows.has(row.row)).length,
    canImport: parsed.rows.length > 0 && issues.every((entry) => entry.severity !== "error"),
    issues,
    rows: parsed.rows,
  };
}

function validateRows(kind: ImportKind, rows: ImportRow[], context: Context): ImportIssue[] {
  switch (kind) {
    case "players":
      return validatePlayers(rows, context);
    case "teams":
      return validateTeams(rows, context);
    case "roster":
      return validateRoster(rows, context);
    case "questions":
      return validateQuestions(rows, context);
    case "competitionTeams":
      return validateCompetitionTeams(rows, context);
    case "fixtures":
      return validateFixtures(rows, context);
  }
}

function validatePlayers(rows: ImportRow[], context: Context): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const existing = new Set(context.users.map((user) => lower(user.email)));
  const seen = new Set<string>();
  for (const row of rows) {
    const name = value(row, "name");
    const email = lower(value(row, "email"));
    const role = (value(row, "role") || "PLAYER").toUpperCase();
    if (!name) issues.push(issue(row.row, "Name is required.", "name"));
    if (!/^\S+@\S+\.\S+$/.test(email)) issues.push(issue(row.row, "Enter a valid email.", "email"));
    if (existing.has(email) || seen.has(email)) issues.push(issue(row.row, "That email already exists or appears earlier in this file.", "email"));
    seen.add(email);
    if (role !== "PLAYER" && role !== "REFEREE") issues.push(issue(row.row, "Role must be PLAYER or REFEREE.", "role"));
    const password = value(row, "password");
    if (password && password.length < 8) issues.push(issue(row.row, "Password must be at least 8 characters.", "password"));
  }
  return issues;
}

function validateTeams(rows: ImportRow[], context: Context): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const existingSlugs = new Set(context.teams.map((team) => team.slug));
  const existingCodes = new Set(context.teams.map((team) => lower(team.code)));
  const slugs = new Set<string>();
  const codes = new Set<string>();
  for (const row of rows) {
    const name = value(row, "name");
    const code = value(row, "code").toUpperCase();
    const slug = slugify(name);
    if (!name) issues.push(issue(row.row, "Team name is required.", "name"));
    if (!/^[A-Z0-9]{2,3}$/.test(code)) issues.push(issue(row.row, "Code must be 2–3 letters or numbers.", "code"));
    if (existingSlugs.has(slug) || slugs.has(slug)) issues.push(issue(row.row, "A team with that name already exists.", "name"));
    if (existingCodes.has(lower(code)) || codes.has(lower(code))) issues.push(issue(row.row, "That team code is already used.", "code"));
    slugs.add(slug);
    codes.add(lower(code));
  }
  return issues;
}

function resolveTeam(context: Context, raw: string) {
  const lookup = lower(raw);
  return context.teams.find((team) => lower(team.slug) === lookup || lower(team.code) === lookup || lower(team.name) === lookup);
}

function validateRoster(rows: ImportRow[], context: Context): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const seenUsers = new Set<string>();
  const seenNumbers = new Set<string>();
  for (const row of rows) {
    const team = resolveTeam(context, value(row, "team"));
    const email = lower(value(row, "playerEmail"));
    const number = parseInteger(value(row, "number"), 1, 8);
    const user = context.users.find((candidate) => lower(candidate.email) === email);
    if (!/^\S+@\S+\.\S+$/.test(email)) issues.push(issue(row.row, "Enter a valid email address.", "playerEmail"));
    if (!team) issues.push(issue(row.row, "Team was not found.", "team"));
    if (user && user.role !== "PLAYER")
      issues.push(issue(row.row, "That email belongs to a non-player account. Convert it to PLAYER in Admin > Users, or use a different email.", "playerEmail"));
    if (!user)
      issues.push({ row: row.row, field: "playerEmail", message: "No player account exists yet — it will be created automatically on import.", severity: "warning" });
    if (!number) issues.push(issue(row.row, "Squad number must be an integer from 1 to 8.", "number"));
    const resolvedUserId = user?.role === "PLAYER" ? user.id : null;
    if (team && number) {
      const emailKey = `${team.id}:${email}`;
      if (seenUsers.has(emailKey)) issues.push(issue(row.row, "That email appears more than once for this team.", "playerEmail"));
      seenUsers.add(emailKey);
      const numberKey = `${team.id}:${number}`;
      if (seenNumbers.has(numberKey) || team.members.some((member) => member.number === number)) issues.push(issue(row.row, "Squad number is already occupied in this team.", "number"));
      seenNumbers.add(numberKey);
      if (resolvedUserId && team.members.some((member) => member.userId === resolvedUserId))
        issues.push(issue(row.row, "Player is already in this team.", "playerEmail"));
    }
  }
  return issues;
}

function validateQuestions(rows: ImportRow[], context: Context): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const counts = new Map<string, number>();
  const slots = new Set<string>();
  for (const row of rows) {
    const matchCode = value(row, "matchCode").toUpperCase();
    const match = context.matches.find((candidate) => candidate.code === matchCode);
    const text = value(row, "text");
    const answer = value(row, "referenceAnswer");
    const slotRaw = value(row, "playSlot");
    const slot = slotRaw ? parseInteger(slotRaw, 1, 10) : null;
    if (!match) issues.push(issue(row.row, "Draft match code was not found.", "matchCode"));
    else if (match.status !== "DRAFT") issues.push(issue(row.row, "Questions can only be imported into a draft match.", "matchCode"));
    if (!text) issues.push(issue(row.row, "Question text is required.", "text"));
    if (!answer) issues.push(issue(row.row, "Reference answer is required.", "referenceAnswer"));
    if (slotRaw && !slot) issues.push(issue(row.row, "Played slot must be an integer from 1 to 10.", "playSlot"));
    if (match) {
      const count = (counts.get(match.id) ?? match.questions.length) + 1;
      counts.set(match.id, count);
      if (count > 20) issues.push(issue(row.row, "A match can have at most 20 prepared questions.", "matchCode"));
      if (slot) {
        const key = `${match.id}:${slot}`;
        if (slots.has(key) || match.questions.some((question) => question.roundNumber === slot)) issues.push(issue(row.row, "That played slot is already assigned.", "playSlot"));
        slots.add(key);
      }
    }
  }
  return issues;
}

function validateCompetitionTeams(rows: ImportRow[], context: Context): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const competitionSlug = lower(value(row, "competitionSlug"));
    const teamSlug = lower(value(row, "teamSlug"));
    const competition = context.competitions.find((candidate) => lower(candidate.slug) === competitionSlug);
    const team = context.teams.find((candidate) => lower(candidate.slug) === teamSlug);
    if (!competition) issues.push(issue(row.row, "Competition slug was not found.", "competitionSlug"));
    if (!team) issues.push(issue(row.row, "Team slug was not found.", "teamSlug"));
    if (competition && team) {
      const key = `${competition.id}:${team.id}`;
      if (seen.has(key) || competition.teams.some((entry) => entry.teamId === team.id)) issues.push(issue(row.row, "Team is already in this competition.", "teamSlug"));
      seen.add(key);
    }
  }
  return issues;
}

function validateFixtures(rows: ImportRow[], context: Context): ImportIssue[] {
  const issues: ImportIssue[] = [];
  for (const row of rows) {
    const competition = context.competitions.find((candidate) => lower(candidate.slug) === lower(value(row, "competitionSlug")));
    const home = context.teams.find((candidate) => lower(candidate.slug) === lower(value(row, "homeTeamSlug")));
    const away = context.teams.find((candidate) => lower(candidate.slug) === lower(value(row, "awayTeamSlug")));
    const refereeEmail = lower(value(row, "refereeEmail"));
    const referee = refereeEmail ? context.users.find((candidate) => lower(candidate.email) === refereeEmail) : null;
    const countdown = value(row, "countdownSeconds");
    const cupRound = value(row, "cupRound");
    if (!competition) issues.push(issue(row.row, "Competition slug was not found.", "competitionSlug"));
    if (!home) issues.push(issue(row.row, "Home team slug was not found.", "homeTeamSlug"));
    if (!away) issues.push(issue(row.row, "Away team slug was not found.", "awayTeamSlug"));
    if (home && away && home.id === away.id) issues.push(issue(row.row, "Home and away teams must be different."));
    if (competition && home && !competition.teams.some((entry) => entry.teamId === home.id)) issues.push(issue(row.row, "Home team is not in the competition.", "homeTeamSlug"));
    if (competition && away && !competition.teams.some((entry) => entry.teamId === away.id)) issues.push(issue(row.row, "Away team is not in the competition.", "awayTeamSlug"));
    if (refereeEmail && (!referee || referee.role !== "REFEREE")) issues.push(issue(row.row, "Referee email must belong to a REFEREE account.", "refereeEmail"));
    if (countdown && !parseInteger(countdown, 5, 120)) issues.push(issue(row.row, "Countdown must be between 5 and 120 seconds.", "countdownSeconds"));
    if (cupRound && !parseInteger(cupRound, 1, 32)) issues.push(issue(row.row, "Cup round must be an integer from 1 to 32.", "cupRound"));
  }
  return issues;
}

export async function commitImport(kind: ImportKind, csv: string): Promise<ImportActionResult<ImportCommitResult>> {
  const preview = await previewImport(kind, csv);
  if (!preview.canImport) {
    return { ok: false, error: "Fix the validation errors before importing.", issues: preview.issues };
  }
  const parsed = parseCsv(csv);
  const generatedCredentials: GeneratedCredential[] = [];
  const createdMatchCodes: string[] = [];
  try {
    let imported = 0;
    await prisma.$transaction(async (tx) => {
      if (kind === "players") {
        for (const row of parsed.rows) {
          const password = value(row, "password") || generatedPassword();
          const role = (value(row, "role") || "PLAYER").toUpperCase() as "PLAYER" | "REFEREE";
          await tx.user.create({ data: { name: value(row, "name"), email: lower(value(row, "email")), passwordHash: await hashPassword(password), role } });
          if (!value(row, "password")) generatedCredentials.push({ name: value(row, "name"), email: lower(value(row, "email")), password, role });
          imported++;
        }
      }
      if (kind === "teams") {
        for (const row of parsed.rows) {
          await tx.team.create({ data: { name: value(row, "name"), code: value(row, "code").toUpperCase(), slug: slugify(value(row, "name")) } });
          imported++;
        }
      }
      if (kind === "roster") {
        const teams = await tx.team.findMany({ include: { members: true } });
        const users = await tx.user.findMany({ select: { id: true, email: true, role: true } });
        for (const row of parsed.rows) {
          const team = teams.find((candidate) => lower(candidate.slug) === lower(value(row, "team")) || lower(candidate.code) === lower(value(row, "team")) || lower(candidate.name) === lower(value(row, "team")));
          if (!team) throw new Error(`Import row ${row.row} could not resolve its team.`);
          const email = lower(value(row, "playerEmail"));
          let user = users.find((candidate) => lower(candidate.email) === email);
          if (user && user.role !== "PLAYER") throw new Error(`Import row ${row.row}: ${email} belongs to a non-player account.`);
          if (!user) {
            const displayName = value(row, "name").trim() || emailName(email);
            const password = value(row, "password") || generatedPassword();
            user = await tx.user.create({ data: { name: displayName, email, passwordHash: await hashPassword(password), role: "PLAYER" } });
            users.push(user);
            if (!value(row, "password")) generatedCredentials.push({ name: displayName, email, password, role: "PLAYER" });
          }
          await tx.teamPlayer.create({ data: { teamId: team.id, userId: user.id, number: Number(value(row, "number")) } });
          imported++;
        }
      }
      if (kind === "questions") {
        const matches = await tx.match.findMany({ include: { questions: true } });
        const nextOrder = new Map(matches.map((match) => [match.id, match.questions.reduce((max, question) => Math.max(max, question.order), 0)]));
        for (const row of parsed.rows) {
          const match = matches.find((candidate) => candidate.code === value(row, "matchCode").toUpperCase());
          if (!match) throw new Error(`Import row ${row.row} could not resolve its match.`);
          const order = (nextOrder.get(match.id) ?? 0) + 1;
          nextOrder.set(match.id, order);
          const slotRaw = value(row, "playSlot");
          const slot = slotRaw ? Number(slotRaw) : null;
          const question = await tx.question.create({ data: { matchId: match.id, order, text: value(row, "text"), referenceAnswer: value(row, "referenceAnswer"), roundNumber: slot } });
          if (slot) await tx.round.create({ data: { matchId: match.id, number: slot, questionId: question.id } });
          imported++;
        }
      }
      if (kind === "competitionTeams") {
        const competitions = await tx.competition.findMany({ include: { teams: true } });
        const teams = await tx.team.findMany();
        for (const row of parsed.rows) {
          const competition = competitions.find((candidate) => lower(candidate.slug) === lower(value(row, "competitionSlug")));
          const team = teams.find((candidate) => lower(candidate.slug) === lower(value(row, "teamSlug")));
          if (!competition || !team) throw new Error(`Import row ${row.row} could not resolve its competition or team.`);
          const nextSeed = competition.teams.reduce((max, entry) => Math.max(max, entry.seed ?? 0), 0) + 1;
          await tx.competitionTeam.create({ data: { competitionId: competition.id, teamId: team.id, seed: value(row, "seed") ? Number(value(row, "seed")) : nextSeed } });
          imported++;
        }
      }
      if (kind === "fixtures") {
        const competitions = await tx.competition.findMany({ include: { teams: true } });
        const teams = await tx.team.findMany({ include: { members: true } });
        const users = await tx.user.findMany({ where: { role: "REFEREE" }, select: { id: true, email: true } });
        for (const row of parsed.rows) {
          const competition = competitions.find((candidate) => lower(candidate.slug) === lower(value(row, "competitionSlug")));
          const home = teams.find((candidate) => lower(candidate.slug) === lower(value(row, "homeTeamSlug")));
          const away = teams.find((candidate) => lower(candidate.slug) === lower(value(row, "awayTeamSlug")));
          const referee = users.find((candidate) => lower(candidate.email) === lower(value(row, "refereeEmail")));
          if (!competition || !home || !away) throw new Error(`Import row ${row.row} could not resolve its fixture references.`);
          const match = await tx.match.create({ data: { code: generateMatchCode(), homeName: home.name, awayName: away.name, homeTeamId: home.id, awayTeamId: away.id, competitionId: competition.id, refereeId: referee?.id ?? null, cupRound: value(row, "cupRound") ? Number(value(row, "cupRound")) : null, countdownSeconds: value(row, "countdownSeconds") ? Number(value(row, "countdownSeconds")) : 15 } });
          createdMatchCodes.push(match.code);
          for (const member of home.members) await tx.matchPlayer.create({ data: { matchId: match.id, userId: member.userId, team: "HOME", number: member.number } });
          for (const member of away.members) await tx.matchPlayer.create({ data: { matchId: match.id, userId: member.userId, team: "AWAY", number: member.number } });
          imported++;
        }
      }
      return imported;
    });
    const importedCount = parsed.rows.length;
    return { ok: true, data: { kind, imported: importedCount, skipped: 0, issues: [], generatedCredentials, createdMatchCodes } };
  } catch (error) {
    console.error("Import transaction failed", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Import conflicts with existing data. Refresh the preview and try again.", issues: [] };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Import failed and was rolled back.", issues: [] };
  }
}
