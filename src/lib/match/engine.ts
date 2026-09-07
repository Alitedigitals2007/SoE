import {
  type IncidentAction,
  type IncidentType,
  type TeamSide,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateMatchCode } from "@/lib/matchCode";
import { publishMatchUpdate } from "@/lib/realtime/server";
import { GOAL_POINTS } from "@/lib/platform/engine";
import type { ActionResult, ErrResult, Role, TeamSide as TeamSideView } from "@/lib/domain";

type Tx = Prisma.TransactionClient;

export type Actor = {
  userId: string;
  role: Role;
};

const ok = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });
const err = (error: string): ErrResult => ({ ok: false, error });

/* ------------------------------- shared bits ------------------------------- */

async function loadMatchFor(code: string, tx: PrismaClient | Tx = prisma) {
  return tx.match.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      referee: { select: { id: true, name: true } },
      competition: { select: { type: true } },
      roster: { include: { user: { select: { id: true, name: true } } }, orderBy: [{ team: "asc" }, { number: "asc" }] },
      rounds: { include: { question: { select: { id: true, text: true, referenceAnswer: true } }, submissions: { include: { player: { include: { user: { select: { id: true, name: true } } } } } } } },
      timeline: true,
      questions: { orderBy: { order: "asc" } },
      penaltyShootout: {
        include: {
          kicks: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
}

async function bumpVersion(tx: Tx, matchId: string): Promise<number> {
  const m = await tx.match.update({
    where: { id: matchId },
    data: { version: { increment: 1 } },
    select: { version: true },
  });
  return m.version;
}

async function appendTimeline(
  tx: Tx,
  matchId: string,
  type: string,
  label: string,
  detail: string | null,
  authoredById: string | null,
) {
  const count = await tx.timelineEvent.count({ where: { matchId } });
  return tx.timelineEvent.create({
    data: { matchId, type: type as never, label, detail, authoredById, seq: count + 1 },
  });
}

function teamNameOf(match: NonNullable<Awaited<ReturnType<typeof loadMatchFor>>>, team: TeamSide) {
  return team === "HOME" ? match.homeName : match.awayName;
}

function rosterNameOf(match: NonNullable<Awaited<ReturnType<typeof loadMatchFor>>>, playerId: string) {
  return match.roster.find((r) => r.id === playerId)?.user.name ?? "Player";
}

/* -------------------------------- admin: match ------------------------------ */

export async function adminCreateMatch(
  actor: Actor,
  input: {
    homeName?: string;
    awayName?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    refereeId: string;
    countdownSeconds: number;
    scheduledAt?: Date | null;
  },
): Promise<ActionResult<{ code: string }>> {
  if (actor.role !== "ADMIN") return err("Only an admin can create matches.");
  const referee = await prisma.user.findUnique({ where: { id: input.refereeId } });
  if (!referee || referee.role !== "REFEREE") return err("The assigned referee must be a referee account.");
  const seconds = Math.max(5, Math.min(120, Math.round(input.countdownSeconds || 15)));
  const scheduledAt = input.scheduledAt ?? null;

  // Build from two existing clubs: names + rosters come from the teams.
  if (input.homeTeamId && input.awayTeamId) {
    if (input.homeTeamId === input.awayTeamId) return err("Pick two different teams.");
    const [home, away] = await Promise.all([
      prisma.team.findUnique({ where: { id: input.homeTeamId }, include: { members: { orderBy: { number: "asc" } } } }),
      prisma.team.findUnique({ where: { id: input.awayTeamId }, include: { members: { orderBy: { number: "asc" } } } }),
    ]);
    if (!home || !away) return err("One of the chosen teams does not exist.");
    if (home.members.length === 0 || away.members.length === 0)
      return err("Both teams need players in their squads before a match is created.");

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateMatchCode();
      try {
        await prisma.$transaction(async (tx) => {
          const match = await tx.match.create({
            data: {
              code,
              homeName: home.name,
              awayName: away.name,
              homeTeamId: home.id,
              awayTeamId: away.id,
              refereeId: referee.id,
              countdownSeconds: seconds,
              scheduledAt,
            },
          });
          const rows: { userId: string; team: "HOME" | "AWAY"; number: number }[] = [];
          for (const member of home.members) rows.push({ userId: member.userId, team: "HOME", number: member.number });
          for (const member of away.members) rows.push({ userId: member.userId, team: "AWAY", number: member.number });
          for (const row of rows) {
            await tx.matchPlayer.create({ data: { matchId: match.id, userId: row.userId, team: row.team, number: row.number } });
          }
        });
        return ok({ code });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return err("Could not allocate a match code, please retry.");
  }
  const homeName = input.homeName?.trim();
  const awayName = input.awayName?.trim();
  if (!homeName || !awayName) return err("Pick two existing teams or provide both team names.");
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateMatchCode();
    try {
      await prisma.match.create({
        data: { code, homeName, awayName, refereeId: referee.id, countdownSeconds: seconds, scheduledAt },
      });
      return ok({ code });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return err("Could not allocate a match code, please retry.");
}

export async function setMatchSchedule(
  actor: Actor,
  input: { code: string; scheduledAt: Date | null },
): Promise<ActionResult> {
  if (actor.role !== "ADMIN") return err("Only an admin can change a match schedule.");
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "DRAFT") return err("The schedule locks once the match starts.");
  await prisma.match.update({ where: { id: match.id }, data: { scheduledAt: input.scheduledAt, version: { increment: 1 } } });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function adminAddPlayer(
  actor: Actor,
  input: { code: string; userId: string; team: TeamSideView; number: number },
): Promise<ActionResult> {
  if (actor.role !== "ADMIN") return err("Only an admin can manage rosters.");
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "DRAFT") return err("The roster is locked once a match leaves setup.");

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return err("Player account not found.");
  if (user.role !== "PLAYER") return err("Only player accounts can join a roster.");

  const number = Math.floor(input.number);
  if (number < 1 || number > 8) return err("Shirt numbers run from 1 to 8.");
  if (match.roster.some((r) => r.userId === input.userId)) return err("That player is already in this match.");
  if (match.roster.some((r) => r.team === input.team && r.number === number))
    return err(`Number ${number} is already taken on ${teamNameOf(match, input.team)}.`);

  await prisma.matchPlayer.create({
    data: { matchId: match.id, userId: input.userId, team: input.team, number },
  });
  await prisma.match.update({ where: { id: match.id }, data: { version: { increment: 1 } } });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function adminRemovePlayer(
  actor: Actor,
  input: { code: string; userId: string },
): Promise<ActionResult> {
  if (actor.role !== "ADMIN") return err("Only an admin can manage rosters.");
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "DRAFT") return err("The roster is locked once a match leaves setup.");
  const slot = match.roster.find((r) => r.userId === input.userId);
  if (!slot) return err("That player is not on this match's roster.");
  const played = match.rounds.some((r) => r.status !== "PENDING");
  if (played) return err("Cannot remove a player after questions have been played.");
  await prisma.matchPlayer.delete({ where: { id: slot.id } });
  await prisma.match.update({ where: { id: match.id }, data: { version: { increment: 1 } } });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* --------------------------- referee: question bank ------------------------- */

export async function addQuestion(
  actor: Actor,
  input: { code: string; text: string; referenceAnswer: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("Questions can only be prepared before kick-off.");
  const text = input.text.trim();
  const ref = input.referenceAnswer.trim();
  if (!text || !ref) return err("Both the question and its reference answer are required.");
  if (match.questions.length >= 20) return err("Each match prepares at most 20 questions.");

  const order = (match.questions.at(-1)?.order ?? 0) + 1;
  await prisma.question.create({ data: { matchId: match.id, order, text, referenceAnswer: ref } });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function updateQuestion(
  actor: Actor,
  input: { code: string; questionId: string; text: string; referenceAnswer: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("Questions can only be prepared before kick-off.");
  const q = match.questions.find((x) => x.id === input.questionId);
  if (!q) return err("Question not found in this match.");
  const text = input.text.trim();
  const ref = input.referenceAnswer.trim();
  if (!text || !ref) return err("Both the question and its reference answer are required.");
  await prisma.question.update({
    where: { id: q.id },
    data: { text, referenceAnswer: ref },
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function removeQuestion(
  actor: Actor,
  input: { code: string; questionId: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("Questions can only be prepared before kick-off.");
  const q = match.questions.find((x) => x.id === input.questionId);
  if (!q) return err("Question not found in this match.");
  const round = match.rounds.find((r) => r.questionId === q.id && r.status === "PENDING");
  await prisma.$transaction(async (tx) => {
    if (round) await tx.round.delete({ where: { id: round.id } });
    await tx.question.delete({ where: { id: q.id } });
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/**
 * Assigns question `questionId` to played slot 1..10 (roundNumber), or clears
 * the slot when roundNumber is null. A question can only fill one slot, and a
 * slot only one question.
 */
export async function setQuestionSlot(
  actor: Actor,
  input: { code: string; questionId: string; roundNumber: number | null },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("The ten to play can only be chosen before kick-off.");
  const q = match.questions.find((x) => x.id === input.questionId);
  if (!q) return err("Question not found in this match.");

  const slot = input.roundNumber;
  if (slot != null && (slot < 1 || slot > 10)) return err("Played slots run from 1 to 10.");

  await prisma.$transaction(async (tx) => {
    if (slot == null) {
      const round = match.rounds.find((r) => r.questionId === q.id && r.status === "PENDING");
      if (round) {
        await tx.round.delete({ where: { id: round.id } });
        await tx.question.update({ where: { id: q.id }, data: { roundNumber: null } });
      }
      return;
    }
    // Free the slot if another question holds it
    const holder = await tx.round.findUnique({
      where: { matchId_number: { matchId: match.id, number: slot } },
    });
    if (holder && holder.questionId !== q.id) {
      await tx.round.delete({ where: { id: holder.id } });
      await tx.question.update({
        where: { id: holder.questionId },
        data: { roundNumber: null },
      });
    }
    // Release this question if it currently fills another slot
    const mine = await tx.round.findUnique({
      where: { matchId_questionId: { matchId: match.id, questionId: q.id } },
    });
    if (mine && mine.number !== slot) {
      await tx.round.delete({ where: { id: mine.id } });
    }
    await tx.round.upsert({
      where: { matchId_number: { matchId: match.id, number: slot } },
      update: { questionId: q.id },
      create: { matchId: match.id, number: slot, questionId: q.id },
    });
    await tx.question.update({ where: { id: q.id }, data: { roundNumber: slot } });
  });

  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* --------------------------- referee: line-up prep -------------------------- */

export async function setLineup(
  actor: Actor,
  input: {
    code: string;
    team: TeamSideView;
    captainUserId: string;
    starterIds: string[];
  },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("Line-ups lock at kick-off.");
  const roster = match.roster.filter((r) => r.team === input.team);
  if (roster.length < 5) return err("A team needs at least 5 players on the roster.");
  const starterIds = [...new Set(input.starterIds)];
  if (starterIds.length !== 5) return err("Select exactly 5 starting players.");
  for (const uid of starterIds) {
    if (!roster.some((r) => r.userId === uid)) return err("A starter is not on this team's roster.");
  }
  if (!roster.some((r) => r.userId === input.captainUserId))
    return err("The captain must be on this team's roster.");

  await prisma.$transaction(async (tx) => {
    for (const slot of roster) {
      await tx.matchPlayer.update({
        where: { id: slot.id },
        data: {
          role: starterIds.includes(slot.userId) ? "STARTER" : "SUB",
          isCaptain: slot.userId === input.captainUserId,
        },
      });
    }
    // Keep the club captain in sync when this match is tied to a team.
    await syncClubCaptain(tx, match, input.team, input.captainUserId);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/**
 * Mirrors a match-side captaincy to the club's public captain
 * (TeamPlayer.isCaptain) when the side is backed by a real team.
 */
async function syncClubCaptain(
  tx: Tx,
  match: { homeTeamId: string | null; awayTeamId: string | null },
  side: TeamSide,
  userId: string,
) {
  const teamId = side === "HOME" ? match.homeTeamId : match.awayTeamId;
  if (!teamId) return;
  await tx.teamPlayer.updateMany({ where: { teamId }, data: { isCaptain: false } });
  await tx.teamPlayer.updateMany({ where: { teamId, userId }, data: { isCaptain: true } });
}

/* -------------------------------- kick-off --------------------------------- */

export async function kickOff(
  actor: Actor,
  input: { code: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("This match has already started.");
  const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
    (n) => !match.rounds.some((r) => r.number === n && r.status === "PENDING"),
  );
  if (missing.length) return err(`The played list needs 10 questions (missing slots: ${missing.join(", ")}).`);
  for (const side of ["HOME", "AWAY"] as TeamSide[]) {
    const team = match.roster.filter((r) => r.team === side);
    if (team.filter((r) => r.role === "STARTER").length !== 5)
      return err(`${teamNameOf(match, side)} must name exactly 5 starters before kick-off.`);
    if (!team.some((r) => r.isCaptain))
      return err(`${teamNameOf(match, side)} needs a captain before kick-off.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { status: "LIVE", startedAt: new Date(), homeScore: 0, awayScore: 0, currentRound: 0 },
    });
    await tx.timelineEvent.deleteMany({ where: { matchId: match.id } });
    await tx.round.updateMany({
      where: { matchId: match.id, status: "PENDING" },
      data: { status: "PENDING" },
    });
    const count = await tx.timelineEvent.count({ where: { matchId: match.id } });
    await tx.timelineEvent.create({
      data: {
        matchId: match.id,
        type: "KICKOFF",
        label: "Kick-off",
        detail: `${match.homeName} vs ${match.awayName}`,
        authoredById: actor.userId,
        seq: count + 1,
      },
    });
    const version = await bumpVersion(tx, match.id);
    return version;
  });

  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* ------------------------------- live: rounds ------------------------------ */

export async function openNextQuestion(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("The match must be live.");
  if (match.rounds.some((r) => r.status === "OPEN" || r.status === "LOCKED"))
    return err("Finish the current round before opening the next question.");
  const next = match.currentRound + 1;
  if (next > 10) return err("All ten questions have been played.");
  const round = match.rounds.find((r) => r.number === next);
  if (!round) return err("The next question is missing from the played list.");

  const now = new Date();
  const closesAt = new Date(now.getTime() + match.countdownSeconds * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.round.update({
      where: { id: round.id },
      data: { status: "OPEN", openedAt: now, closesAt, decision: null, goalSubmissionId: null },
    });
    await appendTimeline(tx, match.id, "QUESTION_OPEN", `Question ${next} of 10`, round.question.text, actor.userId);
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function submitAnswer(
  actor: Actor,
  input: { code: string; answer: string },
): Promise<ActionResult> {
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "LIVE") return err("The match is not live.");
  const round = match.rounds.find((r) => r.status === "OPEN");
  if (!round) return err("There is no open question right now.");

  const mySlot = match.roster.find((r) => r.userId === actor.userId);
  if (!mySlot) return err("You are not part of this match.");
  if (actor.role !== "PLAYER") return err("Only players can submit answers.");
  if (mySlot.role !== "STARTER") return err("Only players on the field can answer.");
  if (round.submissions.some((s) => s.playerId === mySlot.id))
    return err("You have already answered this question.");

  const now = new Date();
  if (round.closesAt && now.getTime() > round.closesAt.getTime()) {
    await finalizeCurrentRound(match.code, match);
    return err("Time is up — answers are closed.");
  }

  const answer = input.answer.trim();
  if (!answer) return err("An empty answer cannot be submitted.");
  if (answer.length > 240) return err("Answers must be under 240 characters.");

  await prisma.$transaction(async (tx) => {
    const seq = await tx.submission.count({ where: { roundId: round.id } });
    await tx.submission.create({
      data: {
        roundId: round.id,
        playerId: mySlot.id,
        answer,
        submittedAt: now,
        seq: seq + 1,
      },
    });
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

async function finalizeCurrentRound(code: string, match: NonNullable<Awaited<ReturnType<typeof loadMatchFor>>>) {
  const open = match.rounds.find((r) => r.status === "OPEN");
  if (!open) return;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.round.updateMany({
      where: { id: open.id, status: "OPEN" },
      data: { status: "LOCKED", lockedAt: new Date() },
    });
    if (changed.count === 0) return; // already locked by someone else
    await appendTimeline(tx, match.id, "ANSWERS_LOCKED", "Answers locked", `Question ${open.number}`, null);
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(code);
}

export async function lockAndReveal(actor: Actor, input: { code: string; force?: boolean }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  const open = match.rounds.find((r) => r.status === "OPEN");
  if (!open) return err("There is no open question to lock.");
  const overdue = open.closesAt ? new Date(open.closesAt).getTime() <= Date.now() : false;
  if (!input.force && !overdue) return err("The countdown is still running.");
  await finalizeCurrentRound(match.code, match);
  return ok(undefined);
}

export async function decideRound(
  actor: Actor,
  input: { code: string; decision: "GOAL" | "NO_GOAL"; submissionId?: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  const locked = match.rounds.find((r) => r.status === "LOCKED");
  if (!locked) return err("No locked question is waiting for a decision.");

  if (input.decision === "NO_GOAL") {
    await prisma.$transaction(async (tx) => {
      await tx.round.update({
        where: { id: locked.id },
        data: { status: "DECIDED", decision: "NO_GOAL", decidedAt: new Date() },
      });
      await tx.match.update({
        where: { id: match.id },
        data: { currentRound: { increment: 1 } },
      });
      await appendTimeline(
        tx,
        match.id,
        "NO_GOAL",
        `No goal — Question ${locked.number}`,
        `Correct answer: ${locked.question.referenceAnswer}`,
        actor.userId,
      );
      await bumpVersion(tx, match.id);
    });
    await publishMatchUpdate(match.code);
    return ok(undefined);
  }

  if (!input.submissionId) return err("Select the submission to award the goal to.");
  const sub = locked.submissions.find((s) => s.id === input.submissionId);
  if (!sub) return err("That submission does not belong to the locked question.");

  await prisma.$transaction(async (tx) => {
    await tx.round.update({
      where: { id: locked.id },
      data: { status: "DECIDED", decision: "GOAL", decidedAt: new Date(), goalSubmissionId: sub.id },
    });
    const slot = await tx.matchPlayer.findUnique({ where: { id: sub.playerId } });
    const scorerTeam = slot?.team ?? "HOME";
    await tx.match.update({
      where: { id: match.id },
      data: {
        currentRound: { increment: 1 },
        homeScore: scorerTeam === "HOME" ? { increment: 1 } : undefined,
        awayScore: scorerTeam === "AWAY" ? { increment: 1 } : undefined,
      },
    });
    // Fantasy: every manager in this competition who picked the scorer earns points
    if (match.competitionId) {
      await tx.fantasyEntry.updateMany({
        where: { competitionId: match.competitionId, picks: { some: { playerUserId: sub.player.userId } } },
        data: { points: { increment: GOAL_POINTS } },
      });
    }
    const scorerName = rosterNameOf(match, sub.playerId);
    const teamName = teamNameOf(match, scorerTeam);
    const scoreLine =
      scorerTeam === "HOME"
        ? `${match.homeScore + 1}–${match.awayScore}`
        : `${match.homeScore}–${match.awayScore + 1}`;
    await appendTimeline(
      tx,
      match.id,
      "GOAL",
      `Goal — ${scorerName}`,
      `Answer: ${sub.answer} · ${teamName} lead ${scoreLine}`,
      actor.userId,
    );
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* ------------------------------- substitutions ------------------------------ */

export async function requestSubstitution(
  actor: Actor,
  input: { code: string; playerOutUserId: string; playerInUserId: string },
): Promise<ActionResult> {
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "LIVE") return err("Substitutions only happen during a live match.");
  const captain = match.roster.find((r) => r.userId === actor.userId);
  if (!captain || !captain.isCaptain) return err("Only a captain can request a substitution.");

  const out = match.roster.find((r) => r.userId === input.playerOutUserId && r.team === captain.team);
  const inn = match.roster.find((r) => r.userId === input.playerInUserId && r.team === captain.team);
  if (!out || !inn) return err("Both players must be on your team's roster.");
  if (out.role !== "STARTER") return err("The player leaving the field must be an active starter.");
  if (inn.role !== "SUB") return err("The player coming on must be on the bench.");
  if (match.rounds.some((r) => r.status === "OPEN" || r.status === "LOCKED"))
    return err("Wait for the current question to finish before substituting.");

  await prisma.substitutionRequest.create({
    data: {
      matchId: match.id,
      team: captain.team,
      playerInId: inn.id,
      playerOutId: out.id,
      requestedById: actor.userId,
    },
  });
  await prisma.match.update({ where: { id: match.id }, data: { version: { increment: 1 } } });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function transferCaptaincy(
  actor: Actor,
  input: { code: string; toUserId: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("Captaincy can only be passed during a live match.");
  const target = match.roster.find((r) => r.userId === input.toUserId);
  if (!target) return err("That player is not on this match's roster.");
  if (target.role !== "STARTER") return err("Only an active starter can take the captain's armband.");

  const mySlot = match.roster.find((r) => r.userId === actor.userId);
  const isCurrentCaptain = !!mySlot?.isCaptain && mySlot.team === target.team;
  const isMatchOfficial = actor.role === "ADMIN" || actor.role === "REFEREE";
  if (!isCurrentCaptain && !isMatchOfficial)
    return err("Only a team's captain or the referee can transfer captaincy.");
  if (target.isCaptain) return err("That player is already the captain.");

  await prisma.$transaction(async (tx) => {
    await tx.matchPlayer.updateMany({ where: { matchId: match.id, team: target.team }, data: { isCaptain: false } });
    await tx.matchPlayer.update({ where: { id: target.id }, data: { isCaptain: true } });
    await syncClubCaptain(tx, match, target.team, target.userId);
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function decideSubstitution(
  actor: Actor,
  input: { code: string; requestId: string; approve: boolean },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  const req = await prisma.substitutionRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!req || req.matchId !== match.id) return err("Substitution request not found.");
  if (req.status !== "PENDING") return err("This request was already handled.");

  if (!input.approve) {
    await prisma.substitutionRequest.update({
      where: { id: req.id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    await publishMatchUpdate(match.code);
    return ok(undefined);
  }

  // Re-validate under current reality
  const out = await prisma.matchPlayer.findUnique({ where: { id: req.playerOutId } });
  const inn = await prisma.matchPlayer.findUnique({ where: { id: req.playerInId } });
  if (!out || !inn) return err("A player in this request no longer exists.");
  if (out.role !== "STARTER") return err("The player leaving is no longer on the field.");
  if (inn.role !== "SUB") return err("The player coming on is no longer on the bench.");

  await prisma.$transaction(async (tx) => {
    await tx.matchPlayer.update({ where: { id: out.id }, data: { role: "SUB" } });
    await tx.matchPlayer.update({ where: { id: inn.id }, data: { role: "STARTER" } });
    await tx.substitutionRequest.update({
      where: { id: req.id },
      data: { status: "APPROVED", decidedAt: new Date() },
    });
    await tx.substitution.create({
      data: { matchId: match.id, team: out.team, playerInId: inn.id, playerOutId: out.id },
    });
    await appendTimeline(
      tx,
      match.id,
      "SUBSTITUTION",
      `Substitution`,
      `${rosterNameOf(match, inn.id)} IN · ${rosterNameOf(match, out.id)} OUT`,
      actor.userId,
    );
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* -------------------------------- match conduct ----------------------------- */

export async function recordIncident(
  actor: Actor,
  input: { code: string; playerUserId: string; type: IncidentType; action: IncidentAction; note?: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  const slot = match.roster.find((r) => r.userId === input.playerUserId);
  if (!slot) return err("That player is not on this match's roster.");

  const actionLabel = { WARNING: "Warning", YELLOW_CARD: "Yellow Card", RED_CARD: "Red Card" }[input.action];

  await prisma.$transaction(async (tx) => {
    await tx.conductIncident.create({
      data: {
        matchId: match.id,
        playerId: slot.id,
        type: input.type,
        action: input.action,
        note: input.note?.trim() || null,
      },
    });
    if (input.action === "RED_CARD") {
      await tx.matchPlayer.update({ where: { id: slot.id }, data: { role: "OUT" } });
    }
    await appendTimeline(
      tx,
      match.id,
      "CARD",
      `${actionLabel} — ${rosterNameOf(match, slot.id)}`,
      input.note?.trim() || null,
      actor.userId,
    );
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* --------------------------------- full time ------------------------------- */

export async function endMatch(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("This match is not live.");
  if (match.currentRound < 10) return err("All ten questions must be played before full time.");

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { status: "FINISHED", finishedAt: new Date() },
    });
    await appendTimeline(tx, match.id, "FULL_TIME", "Full-time", `${match.homeScore}–${match.awayScore}`, actor.userId);
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* ------------------------------ penalty shootout --------------------------- */

export async function startPenalties(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE" && match.status !== "FINISHED")
    return err("Start the match first — penalties come after the ten questions.");
  if (match.currentRound < 10) return err("All ten questions must be played before penalties.");
  if (match.homeScore !== match.awayScore) return err("Penalties are only available when the score is level.");
  if (match.competition?.type !== "CUP") return err("Penalties are only available in knockout cup matches.");
  if (match.penaltyShootout) return err("A penalty shootout is already in progress.");

  await prisma.$transaction(async (tx) => {
    await tx.penaltyShootout.create({
      data: {
        matchId: match.id,
        status: "IN_PROGRESS",
        teamAScore: 0,
        teamBScore: 0,
      },
    });
    await appendTimeline(tx, match.id, "PENALTY_SHOOTOUT_START", "Penalty shootout", `${match.homeName} vs ${match.awayName}`, actor.userId);
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function takePenaltyKick(
  actor: Actor,
  input: { code: string; scored: boolean },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE" && match.status !== "FINISHED")
    return err("Penalties can only be taken after the questions have been decided.");
  const ps = match.penaltyShootout;
  if (!ps) return err("No penalty shootout in progress.");
  if (ps.status === "COMPLETE") return err("The penalty shootout is already complete.");

  const kicks = ps.kicks;
  const total = kicks.length + 1; // sequence of THIS kick (1-based)
  const teamSide: "HOME" | "AWAY" = total % 2 === 1 ? "HOME" : "AWAY"; // HOME kicks first, then strictly alternate

  // Prospective scores including this kick.
  const aScore = ps.teamAScore + (teamSide === "HOME" && input.scored ? 1 : 0);
  const bScore = ps.teamBScore + (teamSide === "AWAY" && input.scored ? 1 : 0);

  // Kicks taken by each team after this one (HOME kicks on odd sequences).
  const aTaken = Math.ceil(total / 2);
  const bTaken = Math.floor(total / 2);

  let winner: "HOME" | "AWAY" | null = null;
  if (aScore > bScore + (5 - bTaken)) winner = "HOME"; // away cannot catch up in regulation
  else if (bScore > aScore + (5 - aTaken)) winner = "AWAY"; // home cannot catch up in regulation
  else if (total >= 10 && aScore !== bScore) winner = aScore > bScore ? "HOME" : "AWAY";

  const newStatus = winner ? "COMPLETE" : "IN_PROGRESS";

  await prisma.$transaction(async (tx) => {
    await tx.penaltyKick.create({
      data: {
        shootoutId: ps.id,
        team: teamSide,
        score: input.scored,
        sequence: total,
      },
    });

    await tx.penaltyShootout.update({
      where: { id: ps.id },
      data: {
        teamAScore: teamSide === "HOME" && input.scored ? { increment: 1 } : undefined,
        teamBScore: teamSide === "AWAY" && input.scored ? { increment: 1 } : undefined,
        status: newStatus,
        winner,
      },
    });

    const teamName = teamSide === "HOME" ? match.homeName : match.awayName;
    const label = input.scored ? "Penalty scored" : "Penalty missed";
    const detail = `${teamName} — ${input.scored ? "Scored" : "Missed"}`;
    await appendTimeline(tx, match.id, input.scored ? "PENALTY_SCORED" : "PENALTY_MISS", label, detail, actor.userId);

    if (newStatus === "COMPLETE") {
      const winnerTeam = winner === "HOME" ? match.homeName : match.awayName;
      await appendTimeline(tx, match.id, "PENALTY_SHOOTOUT_END", "Penalty shootout complete", `${winnerTeam} wins`, actor.userId);
    }

    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function getPenaltyState(code: string) {
  const match = await loadMatchFor(code);
  if (!match) return null;
  return match.penaltyShootout ?? null;
}

/* ------------------------------ auth helper --------------------------------- */

/**
 * Cheap reconcile used by client heartbeats: locks an OPEN round whose
 * countdown has expired (whichever client notices first wins — the update is
 * guarded to run exactly once) and returns the current version.
 */
export async function syncMatchState(code: string): Promise<number | null> {
  const match = await loadMatchFor(code);
  if (!match) return null;
  const open = match.rounds.find((r) => r.status === "OPEN");
  if (open && open.closesAt && Date.now() >= open.closesAt.getTime()) {
    await finalizeCurrentRound(code, match);
  }
  const fresh = await prisma.match.findUnique({
    where: { code: match.code },
    select: { version: true },
  });
  return fresh?.version ?? null;
}

async function assertReferee(actor: Actor, code: string) {
  const match = await loadMatchFor(code);
  if (!match) throw new MatchGuardError("Match not found.");
  const allowed = actor.role === "ADMIN" || (actor.role === "REFEREE" && match.refereeId === actor.userId);
  if (!allowed) throw new MatchGuardError("You do not referee this match.");
  return match;
}

export class MatchGuardError extends Error {}

export async function runGuarded<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof MatchGuardError) return err(e.message);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return err("That change conflicts with existing data, please refresh.");
    console.error("Match engine failure:", e);
    return err("Something went wrong, please try again.");
  }
}
