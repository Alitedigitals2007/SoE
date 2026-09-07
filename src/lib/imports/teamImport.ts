import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { parseCsv } from "@/lib/imports/csv";
import type { ActionResult } from "@/lib/domain";

export type TeamImportResult = {
  imported: number;
  created: { name: string; email: string; password: string }[];
  issues: { row: number; message: string }[];
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function generatedPassword(): string {
  return `SOE-${crypto.randomBytes(8).toString("base64url")}`;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "player";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Imports players INTO an existing team in one step: each row needs
 * name, email and number; password is optional (a temp one is generated).
 * Missing accounts are created as PLAYER logins automatically.
 */
export async function importTeamPlayers(teamId: string, csv: string): Promise<ActionResult<TeamImportResult>> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team) return { ok: false, error: "Team not found." };

  const parsed = parseCsv(csv);
  if (parsed.errors.length > 0)
    return { ok: false, error: parsed.errors[0].message };

  const header = new Set(parsed.headers);
  for (const required of ["name", "email", "number"]) {
    if (!header.has(required)) return { ok: false, error: `The CSV needs a "${required}" column.` };
  }

  const issues: TeamImportResult["issues"] = [];
  const seenNumbers = new Set(team.members.map((m) => m.number));
  const seenEmails = new Set<string>();
  const seenRows = new Set<number>();

  const rows = parsed.rows.filter((row) => {
    const number = Number(row.values.number);
    const email = (row.values.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      issues.push({ row: row.row, message: "Enter a valid email address." });
      seenRows.add(row.row);
      return false;
    }
    if (seenEmails.has(email)) {
      issues.push({ row: row.row, message: "That email appears more than once in this file." });
      seenRows.add(row.row);
      return false;
    }
    if (!Number.isInteger(number) || number < 1 || number > 8) {
      issues.push({ row: row.row, message: "Squad number must be an integer from 1 to 8." });
      seenRows.add(row.row);
      return false;
    }
    if (seenNumbers.has(number)) {
      issues.push({ row: row.row, message: `Squad number ${number} is already taken in this team.` });
      seenRows.add(row.row);
      return false;
    }
    seenEmails.add(email);
    seenNumbers.add(number);
    return true;
  });

  const created: TeamImportResult["created"] = [];
  let imported = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const allUsers = await tx.user.findMany({ select: { id: true, email: true, role: true } });
      for (const row of rows) {
        if (seenRows.has(row.row)) continue;
        const email = (row.values.email ?? "").trim().toLowerCase();
        const number = Number(row.values.number);
        const rawName = (row.values.name ?? "").trim();
        const passwordRaw = (row.values.password ?? "").trim();
        if (passwordRaw && passwordRaw.length < 8) {
          issues.push({ row: row.row, message: "Password must be at least 8 characters." });
          continue;
        }

        let user = allUsers.find((u) => u.email.toLowerCase() === email);
        if (user && user.role !== "PLAYER") {
          issues.push({ row: row.row, message: "That email belongs to a non-player account." });
          continue;
        }
        if (!user) {
          const password = passwordRaw || generatedPassword();
          user = await tx.user.create({
            data: { name: rawName || nameFromEmail(email), email, passwordHash: await hashPassword(password), role: "PLAYER" },
          });
          allUsers.push(user);
          if (!passwordRaw) created.push({ name: rawName || nameFromEmail(email), email, password });
        }

        await tx.teamPlayer.create({ data: { teamId, userId: user.id, number } });
        imported++;
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That import clashes with existing players/numbers — refresh the page and try again." };
    }
    console.error("importTeamPlayers failed", e);
    return { ok: false, error: "Import failed and was rolled back." };
  }

  return { ok: true, data: { imported, created, issues } };
}
