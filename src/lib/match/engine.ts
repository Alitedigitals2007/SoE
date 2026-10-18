import {
  type IncidentAction,
  type IncidentType,
  type TeamSide,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma, TX_OPTS } from "@/lib/prisma";
import { generateMatchCode } from "@/lib/matchCode";
import { publishMatchUpdate } from "@/lib/realtime/server";
import { notifyAllUsers, notifyUsers } from "@/lib/notify";
import { GOAL_POINTS } from "@/lib/platform/engine";
import { emitSettleNotices, settleMatchBets, type SettleNotice } from "@/lib/bet/engine";
import { applyWalletChanges } from "@/lib/bet/wallet";
import { computeAndStoreMotm } from "@/lib/match/motm";
import type { ActionResult, ErrResult, Role, TeamSide as TeamSideView } from "@/lib/domain";
import {
  HALFTIME_AFTER_QUESTION,
  HALFTIME_SECONDS,
  INCIDENT_ACTIONS,
  INTEGRITY_KIND_LABELS,
  INTEGRITY_PENALTY,
  INTEGRITY_REPORT_COOLDOWN_MS,
  PRESENCE_REFRESH_MS,
  integrityActionForSeq,
} from "@/lib/domain";

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
      rounds: {
        include: {
          question: { select: { id: true, text: true, referenceAnswer: true } },
          submissions: { include: { player: { include: { user: { select: { id: true, name: true } } } } } },
          goalSubmission: { include: { player: { include: { user: { select: { id: true, name: true } } } } } },
          assistPlayer: { include: { user: { select: { id: true, name: true } } } },
        },
      },
      timeline: true,
      integrityFlags: {
        orderBy: { createdAt: "asc" },
        include: { player: { include: { user: { select: { id: true, name: true } } } }, round: { select: { number: true } } },
      },
      questions: { orderBy: { order: "asc" } },
      penaltyShootout: {
        include: {
          kicks: {
            orderBy: { sequence: "asc" },
            include: {
              question: { select: { id: true, text: true, referenceAnswer: true } },
              kicker: { select: { id: true, name: true } },
            },
          },
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
  cardAction?: IncidentAction | null,
) {
  const count = await tx.timelineEvent.count({ where: { matchId } });
  return tx.timelineEvent.create({
    data: { matchId, type: type as never, label, detail, authoredById, seq: count + 1, cardAction: cardAction ?? null },
  });
}

/* ------------------------------- half-time --------------------------------- */
// Tuning lives in @/lib/domain so client components (the Arena break banner)
// can read it without pulling Prisma into the browser bundle.
export { HALFTIME_AFTER_QUESTION, HALFTIME_SECONDS } from "@/lib/domain";

/**
 * Put a live match into half-time. Idempotent: the HALF_TIME timeline event is
 * the "already taken the break" marker, so a manual start, an automatic start
 * and a replayed action can never double-pause a match.
 * Runs inside the caller's transaction.
 */
async function beginHalftime(tx: Tx, matchId: string, authoredById: string | null): Promise<boolean> {
  const taken = await tx.timelineEvent.findFirst({
    where: { matchId, type: "HALF_TIME" },
    select: { id: true },
  });
  if (taken) return false;
  await tx.match.update({
    where: { id: matchId },
    data: { pausedAt: new Date(), statusNote: "Half-time", version: { increment: 1 } },
  });
  await appendTimeline(
    tx,
    matchId,
    "HALF_TIME",
    "Half-time",
    `Five questions played — the second half resumes in ${HALFTIME_SECONDS}s.`,
    authoredById,
  );
  return true;
}

/**
 * Auto-resume a half-time break whose window has elapsed. Called from the
 * polling/snapshot path, so every viewer converges without a cron job.
 * Returns true when this call released the pause.
 */
export async function autoResumeHalftime(match: { id: string; code: string; pausedAt: Date | null; statusNote: string | null }): Promise<boolean> {
  if (!match.pausedAt || match.statusNote !== "Half-time") return false;
  if (Date.now() - match.pausedAt.getTime() < HALFTIME_SECONDS * 1000) return false;
  await prisma.match.update({
    where: { id: match.id },
    data: { pausedAt: null, statusNote: null, version: { increment: 1 } },
  });
  await publishMatchUpdate(match.code);
  return true;
}

function teamNameOf(match: NonNullable<Awaited<ReturnType<typeof loadMatchFor>>>, team: TeamSide) {
  return team === "HOME" ? match.homeName : match.awayName;
}

/**
 * Server-side heuristic to flag potentially AI-generated answers.
 * Looks for patterns typical of AI output: excessive length, perfect structure,
 * AI-typical phrases, and suspiciously fast submission with high complexity.
 */
function detectAIAnswer(answer: string, typingMs: number | null): boolean {
  const lower = answer.toLowerCase();

  // AI-typical phrases
  const aiPhrases = [
    "certainly!", "i'd be happy to", "i'd be happy to help",
    "as an ai", "as a language model", "in conclusion",
    "it's important to note", "it is important to note",
    "firstly,", "secondly,", "thirdly,",
    "in summary,", "to summarize,", "overall,",
    "delve", "tapestry", "landscape", "realm",
    "furthermore,", "moreover,", "additionally,",
    "in today's", "in today's world", "in today's digital",
    "vital", "crucial", "essential", "comprehensive",
  ];

  const hasAiPhrase = aiPhrases.some((p) => lower.includes(p));

  // Very long, well-structured answers (AI tends to be verbose)
  const isVeryLong = answer.length > 200;

  // Perfect formatting: multiple sentences with proper punctuation
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const hasPerfectStructure = sentences.length >= 3 && answer.length > 100;

  // Suspiciously fast for complex answer
  const suspiciouslyFast = typingMs !== null && typingMs < 3000 && answer.length > 80;

  // Multiple AI indicators = likely AI
  const indicators = [hasAiPhrase, isVeryLong, hasPerfectStructure, suspiciouslyFast].filter(Boolean).length;
  return indicators >= 2;
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
          const rows: { userId: string; team: "HOME" | "AWAY"; number: number; isCaptain: boolean }[] = [];
          for (const member of home.members) rows.push({ userId: member.userId, team: "HOME", number: member.number, isCaptain: member.isCaptain });
          for (const member of away.members) rows.push({ userId: member.userId, team: "AWAY", number: member.number, isCaptain: member.isCaptain });
          for (const row of rows) {
            await tx.matchPlayer.create({
              data: { matchId: match.id, userId: row.userId, team: row.team, number: row.number, isCaptain: row.isCaptain },
            });
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
  if (input.scheduledAt) {
    try {
      await notifyAllUsers({
        icon: "🗓️",
        title: `${match.homeName} v ${match.awayName} kick-off scheduled`,
        body: `Kick-off is set for ${input.scheduledAt.toLocaleString()}.`,
        link: `/match/${match.code}`,
      });
    } catch { /* best effort */ }
  }
  return ok(undefined);
}

export async function postponeMatch(
  actor: Actor,
  input: { code: string; scheduledAt: Date | null; reason?: string },
): Promise<ActionResult> {
  if (actor.role !== "ADMIN") return err("Only an admin can postpone a match.");
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "DRAFT") return err("Only a not-yet-started match can be postponed.");
  const reason = input.reason?.trim();
  await prisma.match.update({
    where: { id: match.id },
    data: {
      scheduledAt: input.scheduledAt,
      statusNote: reason ? `Postponed: ${reason}` : input.scheduledAt ? "Postponed" : null,
      version: { increment: 1 },
    },
  });
  await publishMatchUpdate(match.code);
  try {
    await notifyAllUsers({
      icon: "🕒",
      title: `${match.homeName} v ${match.awayName} postponed`,
      body: reason ? reason : "A new kick-off time will be announced.",
      link: `/match/${match.code}`,
    });
  } catch { /* best effort */ }
  return ok(undefined);
}

export async function pauseMatch(
  actor: Actor,
  input: { code: string; reason?: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("Only a live match can be paused.");
  if (match.pausedAt) return err("The match is already paused.");
  if (match.rounds.some((r) => r.status === "OPEN" || r.status === "LOCKED"))
    return err("Wait for the current question to finish before pausing.");
  const reason = input.reason?.trim();
  await prisma.match.update({
    where: { id: match.id },
    data: { pausedAt: new Date(), statusNote: reason || "Paused", version: { increment: 1 } },
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function resumeMatch(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("Only a live match can be resumed.");
  if (!match.pausedAt) return err("The match is not paused.");
  await prisma.match.update({
    where: { id: match.id },
    data: { pausedAt: null, statusNote: null, version: { increment: 1 } },
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

export async function startHalftime(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("Halftime only happens during a live match.");
  // Already on the break — idempotent so a double-click is not an error.
  if (match.pausedAt && match.statusNote === "Half-time") return ok(undefined);
  if (match.pausedAt) return err("The match is already paused.");
  const decided = match.rounds.filter((r) => r.status === "DECIDED").length;
  if (decided < HALFTIME_AFTER_QUESTION) return err("Halftime comes after the fifth question is decided.");
  if (match.rounds.some((r) => r.status === "OPEN" || r.status === "LOCKED"))
    return err("Wait for the current question to finish first.");
  await prisma.$transaction(async (tx) => {
    await beginHalftime(tx, match.id, actor.userId);
  });
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

/* --------------------------- admin: manual overrides ------------------------ */

/**
 * Manual score overwrite: the admin sets the scoreline directly (e.g. after a
 * correction). Recorded on the timeline so viewers can see the change.
 */
export async function adminOverrideScore(
  actor: Actor,
  input: { code: string; homeScore: number; awayScore: number; note?: string; finish?: boolean },
): Promise<ActionResult> {
  if (actor.role !== "ADMIN") return err("Only an admin can override the score.");
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  const wasDraft = match.status === "DRAFT";
  if (wasDraft && !input.finish)
    return err('This match never kicked off — switch on "Record result" to save the score and close it.');
  const homeScore = Math.max(0, Math.floor(input.homeScore));
  const awayScore = Math.max(0, Math.floor(input.awayScore));
  if (homeScore > 99 || awayScore > 99) return err("Scores must be 99 or fewer.");
  const note = input.note?.trim() || null;
  /** Close the match as well as setting the score (walkover / final result). */
  const finishing = !!input.finish && match.status !== "FINISHED";

  let settleNotices: SettleNotice[] = [];
  await prisma.$transaction(
    async (tx) => {
      await tx.match.update({
        where: { id: match.id },
        data: {
          homeScore,
          awayScore,
          ...(finishing
            ? {
                status: "FINISHED" as const,
                finishedAt: match.finishedAt ?? new Date(),
                startedAt: match.startedAt ?? new Date(),
                pausedAt: null,
              }
            : {}),
          version: { increment: 1 },
        },
      });
      await appendTimeline(
        tx,
        match.id,
        "ADMIN_OVERRIDE",
        wasDraft && finishing
          ? `Result recorded ${homeScore}–${awayScore} (match not played)`
          : `Score manually set to ${homeScore}–${awayScore}`,
        note ??
          (wasDraft
            ? "Recorded from the admin panel — the match never kicked off."
            : "Manual score override by admin"),
        actor.userId,
      );
      settleNotices = await settleMatchBets(tx, match.id);
      if (finishing || match.status === "FINISHED") await computeAndStoreMotm(tx, match.id);
    },
    TX_OPTS,
  );
  await emitSettleNotices(settleNotices);
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/**
 * Edit a decided round: change the decision (goal / no goal), pick a different
 * scorer from that round's submissions, or change the assist. The score is
 * adjusted by the delta so a manual score override is never silently clobbered.
 */
export async function adminEditGoalRound(
  actor: Actor,
  input: {
    code: string;
    roundId: string;
    decision: "GOAL" | "NO_GOAL";
    scorerSubmissionId?: string | null;
    assistPlayerId?: string | null;
  },
): Promise<ActionResult> {
  if (actor.role !== "ADMIN") return err("Only an admin can edit a decided round.");
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status === "DRAFT") return err("Decided rounds only exist after kick-off.");
  const round = match.rounds.find((r) => r.id === input.roundId);
  if (!round) return err("Round not found in this match.");
  if (round.status !== "DECIDED") return err("Only decided rounds can be edited here.");

  const wasGoal = round.decision === "GOAL";
  const oldScorer = wasGoal && round.goalSubmission
    ? match.roster.find((r) => r.id === round.goalSubmission!.playerId) ?? null
    : null;

  const saveScoreDelta = async (
    tx: Tx,
    opts: { before: "HOME" | "AWAY" | null; after: "HOME" | "AWAY" | null },
  ) => {
    if (opts.before === opts.after) return;
    await tx.match.update({
      where: { id: match.id },
      data: {
        homeScore:
          opts.before === "HOME" ? { decrement: 1 } : opts.after === "HOME" ? { increment: 1 } : undefined,
        awayScore:
          opts.before === "AWAY" ? { decrement: 1 } : opts.after === "AWAY" ? { increment: 1 } : undefined,
      },
    });
  };

  if (input.decision === "NO_GOAL") {
    let settleNotices: SettleNotice[] = [];
    await prisma.$transaction(
      async (tx) => {
        await tx.round.update({
          where: { id: round.id },
          data: { decision: "NO_GOAL", decidedAt: new Date(), goalSubmissionId: null, assistPlayerId: null },
        });
        await saveScoreDelta(tx, { before: oldScorer?.team ?? null, after: null });
        await appendTimeline(
          tx,
          match.id,
          "ADMIN_OVERRIDE",
          `Admin edit — Question ${round.number} set to no goal`,
          "Manual goal override by admin",
          actor.userId,
        );
        await bumpVersion(tx, match.id);
        settleNotices = await settleMatchBets(tx, match.id);
        if (match.status === "FINISHED") await computeAndStoreMotm(tx, match.id);
      },
      TX_OPTS,
    );
    await emitSettleNotices(settleNotices);
    await publishMatchUpdate(match.code);
    return ok(undefined);
  }

  // GOAL: pick the scoring answer from this round's submissions.
  if (!input.scorerSubmissionId) return err("Pick the answer that scores.");
  const sub = round.submissions.find((s) => s.id === input.scorerSubmissionId);
  if (!sub) return err("That answer does not belong to this question.");
  const scorerSlot = match.roster.find((r) => r.id === sub.playerId);
  if (!scorerSlot) return err("Could not find the scoring player.");

  // Optional assist: another player on the SAME team as the scorer.
  let assistSlotId: string | null = null;
  if (input.assistPlayerId && input.assistPlayerId !== scorerSlot.id) {
    const assistSlot = match.roster.find((r) => r.id === input.assistPlayerId);
    if (!assistSlot || assistSlot.team !== scorerSlot.team)
      return err("The assist must go to a player on the same team as the scorer.");
    assistSlotId = assistSlot.id;
  }

  const scorerName = rosterNameOf(match, scorerSlot.id);
  const assistName = assistSlotId ? rosterNameOf(match, assistSlotId) : null;
  const teamName = teamNameOf(match, scorerSlot.team);

  let goalNotices: SettleNotice[] = [];
  await prisma.$transaction(
    async (tx) => {
      await tx.round.update({
        where: { id: round.id },
        data: {
          decision: "GOAL",
          decidedAt: new Date(),
          goalSubmissionId: sub.id,
          assistPlayerId: assistSlotId,
        },
      });
      await saveScoreDelta(tx, { before: oldScorer?.team ?? null, after: scorerSlot.team });
      const goalDetail = assistName
        ? `${scorerName} scores for ${teamName}, assisted by ${assistName}`
        : `${scorerName} scores for ${teamName}`;
      await appendTimeline(
        tx,
        match.id,
        "ADMIN_OVERRIDE",
        `Admin edit — Question ${round.number}: ${goalDetail}`,
        `Answer: ${sub.answer} · Manual goal override by admin`,
        actor.userId,
      );
      await bumpVersion(tx, match.id);
      goalNotices = await settleMatchBets(tx, match.id);
      if (match.status === "FINISHED") await computeAndStoreMotm(tx, match.id);
    },
    TX_OPTS,
  );
  await emitSettleNotices(goalNotices);
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

  // Auto-slot the first ten questions into played slots 1..10.
  const used = new Set(match.rounds.filter((r) => r.status === "PENDING").map((r) => r.number));
  let slot: number | null = null;
  for (let n = 1; n <= 10; n++) {
    if (!used.has(n)) {
      slot = n;
      break;
    }
  }

  const order = (match.questions.at(-1)?.order ?? 0) + 1;
  const created = await prisma.question.create({ data: { matchId: match.id, order, text, referenceAnswer: ref } });
  if (slot != null) {
    await prisma.round.create({ data: { matchId: match.id, number: slot, questionId: created.id } });
    await prisma.question.update({ where: { id: created.id }, data: { roundNumber: slot } });
  }
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

/* ----------------------------- setup shortcuts ----------------------------- */

/**
 * One-click setup: trims each side to its first five starters (by shirt
 * number), keeps the squad captain when they make the cut, and moves bank
 * questions into any empty played slots. Admin or the assigned referee.
 */
export async function autoCompleteSetup(
  actor: Actor,
  input: { code: string },
): Promise<ActionResult<{ starters: number; captains: number; slotsFilled: number; sidesSkipped: string[] }>> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("Setup is locked once the match starts.");

  const sidesSkipped: string[] = [];
  const lineups: { side: TeamSideView; starterIds: string[]; captainUserId: string }[] = [];

  for (const side of ["HOME", "AWAY"] as const) {
    const roster = match.roster.filter((r) => r.team === side).sort((a, b) => a.number - b.number);
    if (roster.length < 5) {
      sidesSkipped.push(teamNameOf(match, side));
      continue;
    }
    const starterIds = roster.slice(0, 5).map((r) => r.userId);
    const existingCaptain = roster.find((r) => r.isCaptain);
    const captainUserId =
      existingCaptain && starterIds.includes(existingCaptain.userId) ? existingCaptain.userId : starterIds[0];
    lineups.push({ side, starterIds, captainUserId });
  }

  // Fill empty played slots from the question bank, in bank order.
  const bank = match.questions.filter((q) => q.roundNumber == null);
  const usedSlots = new Set(match.rounds.filter((r) => r.status === "PENDING").map((r) => r.number));
  const emptySlots: number[] = [];
  for (let n = 1; n <= 10; n++) if (!usedSlots.has(n)) emptySlots.push(n);
  const placements = bank.slice(0, emptySlots.length).map((q, i) => ({ questionId: q.id, slot: emptySlots[i] }));

  if (lineups.length === 0 && placements.length === 0)
    return err("Nothing to auto-fill — add players on each side and questions to the bank first.");

  await prisma.$transaction(async (tx) => {
    for (const lineup of lineups) {
      const roster = match.roster.filter((r) => r.team === lineup.side);
      for (const slot of roster) {
        await tx.matchPlayer.update({
          where: { id: slot.id },
          data: {
            role: lineup.starterIds.includes(slot.userId) ? "STARTER" : "SUB",
            isCaptain: slot.userId === lineup.captainUserId,
          },
        });
      }
      await syncClubCaptain(tx, match, lineup.side, lineup.captainUserId);
    }
    for (const { questionId, slot } of placements) {
      await tx.round.create({ data: { matchId: match.id, number: slot, questionId } });
      await tx.question.update({ where: { id: questionId }, data: { roundNumber: slot } });
    }
    await tx.match.update({ where: { id: match.id }, data: { version: { increment: 1 } } });
  }, TX_OPTS);

  await publishMatchUpdate(match.code);
  return ok({
    starters: lineups.reduce((sum, l) => sum + l.starterIds.length, 0),
    captains: lineups.length,
    slotsFilled: placements.length,
    sidesSkipped,
  });
}

/**
 * Copies questions from another match into this match's bank, skipping exact
 * duplicates and auto-slotting into the first open played slots.
 */
export async function importQuestions(
  actor: Actor,
  input: { code: string; sourceCode: string },
): Promise<ActionResult<{ added: number; skipped: number; slotsFilled: number }>> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "DRAFT") return err("Questions can only be imported before kick-off.");

  const source = await prisma.match.findUnique({
    where: { code: input.sourceCode.trim().toUpperCase() },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!source) return err("That source match was not found.");
  if (source.id === match.id) return err("Pick a different match to import from.");
  if (source.questions.length === 0) return err("That match has no questions to import.");

  const room = 20 - match.questions.length;
  if (room <= 0) return err("This match already has the full bank of 20 questions.");

  const normalize = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
  const existing = new Set(match.questions.map((q) => normalize(q.text)));
  const take = source.questions.filter((q) => !existing.has(normalize(q.text))).slice(0, room);
  if (take.length === 0) return err("Every question in that match is already in this bank.");

  const used = new Set(match.rounds.filter((r) => r.status === "PENDING").map((r) => r.number));
  let cursor = 1;
  const nextOpen = () => {
    while (cursor <= 10 && used.has(cursor)) cursor++;
    return cursor <= 10 ? cursor++ : null;
  };

  let order = match.questions.at(-1)?.order ?? 0;
  let slotsFilled = 0;
  await prisma.$transaction(async (tx) => {
    for (const q of take) {
      order++;
      const created = await tx.question.create({
        data: { matchId: match.id, order, text: q.text, referenceAnswer: q.referenceAnswer },
      });
      const slot = nextOpen();
      if (slot != null) {
        await tx.round.create({ data: { matchId: match.id, number: slot, questionId: created.id } });
        await tx.question.update({ where: { id: created.id }, data: { roundNumber: slot } });
        slotsFilled++;
      }
    }
    await tx.match.update({ where: { id: match.id }, data: { version: { increment: 1 } } });
  }, TX_OPTS);

  await publishMatchUpdate(match.code);
  return ok({ added: take.length, skipped: source.questions.length - take.length, slotsFilled });
}

/**
 * Adds several players to one side at once, assigning the next free shirt
 * numbers (1–8) in the order given.
 */
export async function bulkAddPlayers(
  actor: Actor,
  input: { code: string; team: TeamSideView; userIds: string[] },
): Promise<ActionResult<{ added: number }>> {
  if (actor.role !== "ADMIN") return err("Only an admin can manage rosters.");
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "DRAFT") return err("The roster is locked once a match leaves setup.");

  const ids = [...new Set(input.userIds.filter(Boolean))];
  if (ids.length === 0) return err("Select at least one player.");

  const side = match.roster.filter((r) => r.team === input.team);
  const free: number[] = [];
  for (let n = 1; n <= 8; n++) if (!side.some((r) => r.number === n)) free.push(n);
  if (ids.length > free.length)
    return err(
      `Only ${free.length} shirt${free.length === 1 ? "" : "s"} free on ${teamNameOf(match, input.team)} — ${ids.length} player(s) selected.`,
    );

  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const valid = new Set(users.filter((u) => u.role === "PLAYER").map((u) => u.id));
  const rosterIds = new Set(match.roster.map((r) => r.userId));
  const toAdd = ids.filter((id) => valid.has(id) && !rosterIds.has(id));
  if (toAdd.length === 0) return err("None of the selected players can be added (not player accounts or already in this match).");

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < toAdd.length; i++) {
      await tx.matchPlayer.create({
        data: { matchId: match.id, userId: toAdd[i], team: input.team, number: free[i] },
      });
    }
    await tx.match.update({ where: { id: match.id }, data: { version: { increment: 1 } } });
  }, TX_OPTS);

  await publishMatchUpdate(match.code);
  return ok({ added: toAdd.length });
}

/**
 * Creates a fresh DRAFT copy of a match (same teams/names, referee and
 * countdown). Club rosters auto-load again; questions are not copied.
 */
export async function rematch(
  actor: Actor,
  input: { code: string },
): Promise<ActionResult<{ code: string }>> {
  if (actor.role !== "ADMIN") return err("Only an admin can create a rematch.");
  const source = await prisma.match.findUnique({ where: { code: input.code.trim().toUpperCase() } });
  if (!source) return err("Match not found.");

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateMatchCode();
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.match.create({
          data: {
            code,
            homeName: source.homeName,
            awayName: source.awayName,
            homeTeamId: source.homeTeamId,
            awayTeamId: source.awayTeamId,
            refereeId: source.refereeId,
            countdownSeconds: source.countdownSeconds,
          },
        });
        if (source.homeTeamId && source.awayTeamId) {
          const [home, away] = await Promise.all([
            tx.team.findUnique({ where: { id: source.homeTeamId }, include: { members: { orderBy: { number: "asc" } } } }),
            tx.team.findUnique({ where: { id: source.awayTeamId }, include: { members: { orderBy: { number: "asc" } } } }),
          ]);
          const rows: { userId: string; team: "HOME" | "AWAY"; number: number; isCaptain: boolean }[] = [];
          for (const m of home?.members ?? []) rows.push({ userId: m.userId, team: "HOME", number: m.number, isCaptain: m.isCaptain });
          for (const m of away?.members ?? []) rows.push({ userId: m.userId, team: "AWAY", number: m.number, isCaptain: m.isCaptain });
          for (const row of rows) {
            await tx.matchPlayer.create({ data: { matchId: created.id, ...row } });
          }
        }
      }, TX_OPTS);
      return ok({ code });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return err("Could not allocate a match code, please retry.");
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
  try {
    await notifyAllUsers({
      icon: "🔴",
      title: `${match.homeName} v ${match.awayName} is LIVE`,
      body: "Kick-off! Follow the ten questions live.",
      link: `/watch/${match.code}`,
    });
  } catch { /* best effort */ }
  return ok(undefined);
}

/* ------------------------------- live: rounds ------------------------------ */

export async function openNextQuestion(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("The match must be live.");
  if (match.pausedAt) return err("Resume the match before opening the next question.");
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
  input: { code: string; answer: string; pasted?: boolean },
): Promise<ActionResult> {
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "LIVE") return err("The match is not live.");
  if (match.pausedAt) return err("The match is paused right now.");

  // Check for penalty kick question first
  const ps = match.penaltyShootout;
  const penaltyKick = ps?.kicks?.find(
    (k) => k.status === "ANSWERED" && k.questionId && k.kickerUserId === actor.userId
  );

  const round = match.rounds.find((r) => r.status === "OPEN");
  const isPenalty = !!penaltyKick && !round;

  if (!round && !penaltyKick) return err("There is no open question right now.");

  const mySlot = match.roster.find((r) => r.userId === actor.userId);
  if (!mySlot) return err("You are not part of this match.");
  if (actor.role !== "PLAYER") return err("Only players can submit answers.");
  if (mySlot.role !== "STARTER") return err("Only players on the field can answer.");

  // Penalty-specific validation
  if (isPenalty) {
    if (penaltyKick!.kickerUserId !== actor.userId) {
      return err("Only the nominated kicker can answer this penalty question.");
    }
    if (penaltyKick!.answer) return err("You have already answered this penalty question.");

    const halfCountdown = Math.max(5, Math.floor(match.countdownSeconds / 2));
    const now = new Date();
    const openedAt = penaltyKick!.answeredAt;
    if (openedAt) {
      const elapsed = now.getTime() - new Date(openedAt).getTime();
      if (elapsed > halfCountdown * 1000) {
        return err("Time is up — answer window closed.");
      }
    }
  } else {
    // Normal round validation
    if (round!.submissions.some((s) => s.playerId === mySlot.id)) {
      return err("You have already answered this question.");
    }
    const now = new Date();
    if (round!.closesAt && now.getTime() > round!.closesAt.getTime()) {
      await finalizeCurrentRound(match.code, match);
      return err("Time is up — answers are closed.");
    }
  }

  const answer = input.answer.trim();
  if (!answer) return err("An empty answer cannot be submitted.");
  if (answer.length > 240) return err("Answers must be under 240 characters.");
  const pasted = input.pasted === true;

  const aiDetected = detectAIAnswer(answer, round?.openedAt ? Date.now() - round.openedAt.getTime() : null);

  await prisma.$transaction(async (tx) => {
    if (isPenalty) {
      await tx.penaltyKick.update({
        where: { id: penaltyKick!.id },
        data: { answer, status: "ANSWERED" },
      });
      await appendTimeline(tx, match.id, "PENALTY_ANSWER_SUBMITTED", `Penalty answer from ${mySlot.user.name}`, `Answer: ${answer}`, actor.userId);
    } else {
      const seq = await tx.submission.count({ where: { roundId: round!.id } });
      const submission = await tx.submission.create({
        data: {
          roundId: round!.id,
          playerId: mySlot.id,
          answer,
          submittedAt: new Date(),
          seq: seq + 1,
          pasted,
          charCount: answer.length,
          typingMs: round!.openedAt ? Math.max(0, Date.now() - round!.openedAt.getTime()) : null,
          aiDetected,
        },
      });
      if (pasted) {
        const breach = await raiseIntegrityFlag(tx, { matchId: match.id, playerId: mySlot.id, roundId: round!.id, submissionId: submission.id, kind: "COPIED_ANSWER", detail: `Answer pasted into the box for question ${round!.number}`, breachAt: new Date() }, match.integrityFlags);
        if (breach) await appendTimeline(tx, match.id, "INTEGRITY_FLAG", `Copy attempt — ${rosterNameOf(match, mySlot.id)}`, `${breach.seq === 1 ? "First" : breach.seq === 2 ? "Second" : "Third"} breach of the match. Awaiting the referee's decision.`, null);
      }
      if (aiDetected) {
        const breach = await raiseIntegrityFlag(tx, { matchId: match.id, playerId: mySlot.id, roundId: round!.id, submissionId: submission.id, kind: "AI_ASSISTANCE", detail: `Answer flagged as potentially AI-generated for question ${round!.number}`, breachAt: new Date() }, match.integrityFlags);
        if (breach) await appendTimeline(tx, match.id, "INTEGRITY_FLAG", `AI assistance detected — ${rosterNameOf(match, mySlot.id)}`, `${breach.seq === 1 ? "First" : breach.seq === 2 ? "Second" : "Third"} breach of the match. Awaiting the referee's decision.`, null);
      }
    }
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
  input: { code: string; decision: "GOAL" | "NO_GOAL"; submissionId?: string; assistUserId?: string | null },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  const locked = match.rounds.find((r) => r.status === "LOCKED");
  if (!locked) return err("No locked question is waiting for a decision.");

  if (input.decision === "NO_GOAL") {
    await prisma.$transaction(
      async (tx) => {
        await tx.round.update({
          where: { id: locked.id },
          data: { status: "DECIDED", decision: "NO_GOAL", decidedAt: new Date(), goalSubmissionId: null, assistPlayerId: null },
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
        if (match.currentRound + 1 >= HALFTIME_AFTER_QUESTION) await beginHalftime(tx, match.id, actor.userId);
      },
      TX_OPTS,
    );
    await publishMatchUpdate(match.code);
    return ok(undefined);
  }

  if (!input.submissionId) return err("Select the submission to award the goal to.");
  const sub = locked.submissions.find((s) => s.id === input.submissionId);
  if (!sub) return err("That submission does not belong to the locked question.");

  const scorerSlot = await prisma.matchPlayer.findUnique({ where: { id: sub.playerId } });
  if (!scorerSlot) return err("Could not find the scoring player.");
  const scorerTeam = scorerSlot.team;

  // Fantasy managers credited in the transaction below — notified after commit.
  const fantasyNotifyIds: string[] = [];

  // Optional assist: another active player on the SAME team is credited.
  let assistSlotId: string | null = null;
  if (input.assistUserId && input.assistUserId !== scorerSlot.userId) {
    const assistSlot = await prisma.matchPlayer.findFirst({
      where: { matchId: match.id, userId: input.assistUserId, team: scorerTeam },
    });
    if (!assistSlot) return err("The assist must go to an active player on the same team.");
    assistSlotId = assistSlot.id;
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.round.update({
        where: { id: locked.id },
        data: {
          status: "DECIDED",
          decision: "GOAL",
          decidedAt: new Date(),
          goalSubmissionId: sub.id,
          assistPlayerId: assistSlotId,
        },
      });
      const scorerName = rosterNameOf(match, sub.playerId);
      const assistName = assistSlotId ? rosterNameOf(match, assistSlotId) : null;
      await tx.match.update({
        where: { id: match.id },
        data: {
          currentRound: { increment: 1 },
          homeScore: scorerTeam === "HOME" ? { increment: 1 } : undefined,
          awayScore: scorerTeam === "AWAY" ? { increment: 1 } : undefined,
        },
      });
      // Fantasy: every manager in this competition who picked the scorer earns
      // points — credited in ONE batch (one balance read, one ledger insert,
      // one points bump) so a big competition cannot time the transaction out.
      if (match.competitionId) {
        const holders = await tx.fantasyEntry.findMany({
          where: { competitionId: match.competitionId, picks: { some: { playerUserId: sub.player.userId } } },
          select: { id: true, userId: true },
        });
        if (holders.length > 0) {
          await tx.fantasyEntry.updateMany({
            where: { id: { in: holders.map((h) => h.id) } },
            data: { points: { increment: GOAL_POINTS } },
          });
          await applyWalletChanges(
            tx,
            holders.map((h) => ({
              userId: h.userId,
              amount: GOAL_POINTS,
              kind: "FANTASY_GOAL" as const,
              note: `Fantasy: ${scorerName} scored — +${GOAL_POINTS} points`,
              matchId: match.id,
            })),
          );
          fantasyNotifyIds.push(...holders.map((h) => h.userId));
        }
      }
      const teamName = teamNameOf(match, scorerTeam);
      const goalDetail = assistName ? `${scorerName} scores for ${teamName}, assisted by ${assistName}` : `${scorerName} scores for ${teamName}`;
      const scoreLine =
        scorerTeam === "HOME"
          ? `${match.homeScore + 1}–${match.awayScore}`
          : `${match.homeScore}–${match.awayScore + 1}`;
      await appendTimeline(
        tx,
        match.id,
        "GOAL",
        `Goal — ${goalDetail}`,
        `Answer: ${sub.answer} · ${teamName} lead ${scoreLine}`,
        actor.userId,
      );
      await bumpVersion(tx, match.id);
      if (match.currentRound + 1 >= HALFTIME_AFTER_QUESTION) await beginHalftime(tx, match.id, actor.userId);
    },
    TX_OPTS,
  );
  await publishMatchUpdate(match.code);
  if (fantasyNotifyIds.length) {
    const scorerName = rosterNameOf(match, sub.playerId);
    notifyUsers(fantasyNotifyIds, {
      icon: "⭐",
      title: "Fantasy points banked",
      body: `${scorerName} scored — +${GOAL_POINTS} points added to your wallet.`,
      link: "/bet",
    }).catch(() => {});
  }
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
  if (match.pausedAt) return err("The match is paused — no substitutions right now.");
  const captain = match.roster.find((r) => r.userId === actor.userId);
  if (!captain || !captain.isCaptain) return err("Only a captain can request a substitution.");

  const out = match.roster.find((r) => r.userId === input.playerOutUserId && r.team === captain.team);
  const inn = match.roster.find((r) => r.userId === input.playerInUserId && r.team === captain.team);
  if (!out || !inn) return err("Both players must be on your team's roster.");
  if (out.role !== "STARTER") return err("The player leaving the field must be an active starter.");
  if (inn.role !== "SUB") return err("The player coming on must be on the bench.");
  if (match.rounds.some((r) => r.status === "OPEN" || r.status === "LOCKED"))
    return err("Wait for the current question to finish before substituting.");

  // One at a time: a request already with the referee cannot be sent again.
  const pending = await prisma.substitutionRequest.findFirst({
    where: { matchId: match.id, team: captain.team, status: "PENDING" },
    select: { id: true },
  });
  if (pending)
    return err("This substitution request was already sent — wait for the referee's decision.");

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

/**
 * Substitution made directly by an official — no captain request needed.
 * Used by admins and referees when the game needs to move (and at half-time).
 */
export async function adminSubstitute(
  actor: Actor,
  input: { code: string; playerOutUserId: string; playerInUserId: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("Substitutions only happen during a live match.");
  if (match.rounds.some((r) => r.status === "OPEN" || r.status === "LOCKED"))
    return err("Wait for the current question to finish before substituting.");

  const out = match.roster.find((r) => r.userId === input.playerOutUserId);
  const inn = match.roster.find((r) => r.userId === input.playerInUserId);
  if (!out || !inn) return err("Both players must be on this match's roster.");
  if (out.team !== inn.team) return err("A substitution has to be within one team.");
  if (out.userId === inn.userId) return err("Pick two different players.");
  if (out.role !== "STARTER") return err("The player leaving the field must be an active starter.");
  if (inn.role !== "SUB") return err("The player coming on must be on the bench.");

  await prisma.$transaction(async (tx) => {
    await tx.matchPlayer.update({ where: { id: out.id }, data: { role: "SUB" } });
    await tx.matchPlayer.update({ where: { id: inn.id }, data: { role: "STARTER" } });
    await tx.substitution.create({
      data: { matchId: match.id, team: out.team, playerInId: inn.id, playerOutId: out.id },
    });
    await appendTimeline(
      tx,
      match.id,
      "SUBSTITUTION",
      "Substitution",
      `${rosterNameOf(match, inn.id)} IN · ${rosterNameOf(match, out.id)} OUT · made by ${actor.role === "ADMIN" ? "admin" : "referee"}`,
      actor.userId,
    );
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
      input.action,
    );
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* ------------------------------ match integrity ---------------------------- */

/**
 * Creates one anti-copy breach inside an existing transaction and returns it.
 * The player's ordinal (`seq`) is their breach count in this match, and it picks
 * the escalation the referee is expected to apply: 1st warning, 2nd yellow,
 * 3rd and beyond red. Nothing is punished here — `action` stays null until
 * `issueIntegrityAction` runs.
 *
 * `known` is the match's already-loaded flag list, used to find the previous
 * breach for the cooldown check without a second round trip.
 */
async function raiseIntegrityFlag(
  tx: Tx,
  data: {
    matchId: string;
    playerId: string;
    roundId?: string | null;
    submissionId?: string | null;
    kind: "COPIED_ANSWER" | "COPIED_CONTENT" | "LEFT_FULLSCREEN" | "TAB_SWITCH" | "RIGHT_CLICK" | "KEYBOARD_SHORTCUT" | "SCREEN_RECORDING" | "AI_ASSISTANCE";
    detail?: string;
    breachAt: Date;
  },
  known: { playerId: string; seq: number; createdAt: Date }[],
) {
  const mine = known.filter((f) => f.playerId === data.playerId);
  const seq = mine.length + 1;
  const suggested = integrityActionForSeq(seq);
  return tx.integrityFlag.create({
    data: {
      matchId: data.matchId,
      playerId: data.playerId,
      roundId: data.roundId ?? null,
      submissionId: data.submissionId ?? null,
      kind: data.kind,
      detail: data.detail ?? null,
      seq,
      suggested,
      createdAt: data.breachAt,
    },
  });
}

/** True when this player already has a breach inside the cooldown window. */
function withinCooldown(
  known: { playerId: string; createdAt: Date }[],
  playerId: string,
  at: Date,
  cooldownMs: number,
): boolean {
  const last = known
    .filter((f) => f.playerId === playerId)
    .reduce<Date | null>((max, f) => (!max || f.createdAt > max ? f.createdAt : max), null);
  return !!last && at.getTime() - last.getTime() < cooldownMs;
}

/**
 * Client-reported breach: a paste/drop into the answer box, a copy attempt, or
 * leaving fullscreen. Only an on-field player in a running, un-paused match can
 * raise one — half-time and any other pause is exempt, and the referee and
 * admins are never flagged because they are not answerable.
 *
 * The report is rate limited: holding Ctrl+C or tabbing out repeatedly folds
 * into the single breach already on the board rather than a wall of cards.
 */
export async function reportIntegrity(
  actor: Actor,
  input: { code: string; kind: "COPIED_ANSWER" | "COPIED_CONTENT" | "LEFT_FULLSCREEN" | "TAB_SWITCH" | "RIGHT_CLICK" | "KEYBOARD_SHORTCUT" | "SCREEN_RECORDING" | "AI_ASSISTANCE"; detail?: string },
): Promise<ActionResult> {
  const match = await loadMatchFor(input.code);
  if (!match) return err("Match not found.");
  if (match.status !== "LIVE") return err("The match is not live.");
  // A pause means the referee stopped play — fullscreen is not owed and copying
  // is not cheating while the question is frozen.
  if (match.pausedAt) return err("Play is paused — no integrity checks during the break.");

  const slot = match.roster.find((r) => r.userId === actor.userId);
  if (!slot) return err("You are not part of this match.");
  if (actor.role !== "PLAYER") return err("Only players are subject to match integrity checks.");
  if (slot.role !== "STARTER") return err("Only on-field players are subject to match integrity checks.");

  const now = new Date();
  if (withinCooldown(match.integrityFlags, slot.id, now, INTEGRITY_REPORT_COOLDOWN_MS)) {
    // Silently accepted: the breach already on the board covers this attempt.
    return ok(undefined);
  }

  const kindDetail =
    input.detail?.trim() ||
    {
      COPIED_ANSWER: "Text pasted into the answer box",
      COPIED_CONTENT: "Tried to copy from the match screen",
      LEFT_FULLSCREEN: "Left fullscreen while the match was running",
      TAB_SWITCH: "Switched tabs or windows during the match",
      RIGHT_CLICK: "Right-clicked on the match area",
      KEYBOARD_SHORTCUT: "Used a blocked keyboard shortcut",
      SCREEN_RECORDING: "Attempted to screen record the match",
      AI_ASSISTANCE: "AI-generated answer detected",
    }[input.kind];

  const roundNumber = match.rounds.find((r) => r.status === "OPEN" || r.status === "LOCKED")?.number ?? null;
  const round = roundNumber != null ? match.rounds.find((r) => r.number === roundNumber) : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      const created = await raiseIntegrityFlag(
        tx,
        {
          matchId: match.id,
          playerId: slot.id,
          roundId: round?.id ?? null,
          kind: input.kind,
          detail: kindDetail,
          breachAt: now,
        },
        match.integrityFlags,
      );
      const ordinal = created.seq;
      const ordWord = ordinal === 1 ? "First" : ordinal === 2 ? "Second" : "Third";
      await appendTimeline(
        tx,
        match.id,
        "INTEGRITY_FLAG",
        `Copy attempt — ${rosterNameOf(match, slot.id)}`,
        `${ordWord} breach of the match. Awaiting the referee's decision.`,
        null,
      );
      await bumpVersion(tx, match.id);
    });
  } catch (e) {
    // A simultaneous breach won the ordinal race — their card stands, ours is
    // a duplicate of the same behaviour, so drop it rather than escalate twice.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return ok(undefined);
    throw e;
  }
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/**
 * The referee (or an admin) issues the card for a breach — this is what
 * "counting" a breach means. Reuses the existing conduct-incident machinery so
 * the sanction shows up on the public card list, the match report and the
 * player's record exactly like a manually booked card, including sending a
 * red-carded player off the field.
 *
 * Counting is also the only thing that moves the player's integrity score:
 * detection alone never does, and ignored breaches never get here.
 */
export async function issueIntegrityAction(
  actor: Actor,
  input: { code: string; flagId: string; action: IncidentAction; note?: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  const flag = match.integrityFlags.find((f) => f.id === input.flagId);
  if (!flag) return err("That integrity check is not on this match.");
  if (flag.action) return err("A sanction has already been issued for this check.");
  if (flag.ignoredAt) return err("This breach was ignored — it cannot be counted anymore.");

  const slot = match.roster.find((r) => r.id === flag.playerId);
  if (!slot) return err("That player is no longer on this roster.");
  // Sending someone off for a third breach is pointless if they are already out.
  if (input.action === "RED_CARD" && slot.role === "OUT")
    return err(`${slot.user.name} has already left the field.`);

  const incidentType =
    flag.kind === "LEFT_FULLSCREEN" ? ("LEFT_FULLSCREEN" as const) :
    flag.kind === "TAB_SWITCH" ? ("TAB_SWITCH" as const) :
    flag.kind === "RIGHT_CLICK" ? ("RIGHT_CLICK" as const) :
    flag.kind === "KEYBOARD_SHORTCUT" ? ("KEYBOARD_SHORTCUT" as const) :
    flag.kind === "SCREEN_RECORDING" ? ("SCREEN_RECORDING" as const) :
    flag.kind === "AI_ASSISTANCE" ? ("AI_ASSISTANCE" as const) :
    ("COPIED_ANSWER" as const);
  const actionLabel = INCIDENT_ACTIONS[input.action];
  const playerName = rosterNameOf(match, slot.id);
  const note = input.note?.trim() || flag.detail || INTEGRITY_KIND_LABELS[flag.kind];

  await prisma.$transaction(async (tx) => {
    await tx.conductIncident.create({
      data: {
        matchId: match.id,
        playerId: slot.id,
        type: incidentType,
        action: input.action,
        note,
      },
    });
    // Counting a breach is what moves the integrity score: detection alone
    // never does, and ignored breaches never get here.
    await tx.matchPlayer.update({
      where: { id: slot.id },
      data: {
        integrityScore: { decrement: INTEGRITY_PENALTY[input.action] },
        ...(input.action === "RED_CARD" ? { role: "OUT" as const } : {}),
      },
    });
    await tx.integrityFlag.update({
      where: { id: flag.id },
      data: { action: input.action, issuedById: actor.userId, issuedAt: new Date() },
    });
    await appendTimeline(
      tx,
      match.id,
      "CARD",
      `${actionLabel} — ${playerName}`,
      flag.round ? `Copy check on question ${flag.round.number}. ${note}` : `Copy check. ${note}`,
      actor.userId,
      input.action,
    );
    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/**
 * The referee (or an admin) waves a breach off. Ignoring counts nothing: no
 * card is issued, the player's integrity score is untouched and the breach
 * never enters the public sanction tally. The flag stays on the board as an
 * ignored record so the call can't be quietly re-raised.
 */
export async function ignoreIntegrityFlag(
  actor: Actor,
  input: { code: string; flagId: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  const flag = match.integrityFlags.find((f) => f.id === input.flagId);
  if (!flag) return err("That integrity check is not on this match.");
  if (flag.action) return err("A sanction has already been issued for this check.");
  if (flag.ignoredAt) return err("This breach was already ignored.");

  await prisma.integrityFlag.update({
    where: { id: flag.id },
    data: { ignoredById: actor.userId, ignoredAt: new Date() },
  });
  await prisma.match.update({ where: { id: match.id }, data: { version: { increment: 1 } } });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* --------------------------------- full time ------------------------------- */

export async function endMatch(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE") return err("This match is not live.");
  if (match.currentRound < 10) return err("All ten questions must be played before full time.");

  const settled: { notices: SettleNotice[]; motm: { userId: string; name: string; points: number } | null } = {
    notices: [],
    motm: null,
  };
  await prisma.$transaction(
    async (tx) => {
      await tx.match.update({
        where: { id: match.id },
        data: { status: "FINISHED", finishedAt: new Date() },
      });
      await appendTimeline(tx, match.id, "FULL_TIME", "Full-time", `${match.homeScore}–${match.awayScore}`, actor.userId);
      await bumpVersion(tx, match.id);
      settled.notices = await settleMatchBets(tx, match.id);
      settled.motm = await computeAndStoreMotm(tx, match.id);
    },
    TX_OPTS,
  );
  await emitSettleNotices(settled.notices);
  if (settled.motm) {
    const motm = settled.motm;
    try {
      await notifyUsers([motm.userId], {
        icon: "🏅",
        title: "Player of the Match!",
        body: `${motm.points} performance points — the standout display of the game.`,
        link: `/match/${match.code}`,
      });
    } catch { /* best effort */ }
  }
  await publishMatchUpdate(match.code);
  const decided = match.rounds.filter((r) => r.status === "DECIDED").length;
  const scoreline = `${match.homeName} ${match.homeScore}–${match.awayScore} ${match.awayName}`;
  try {
    const slug = `${match.code}-match-report`;
    const exists = await prisma.newsPost.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) {
      const highlights = match.timeline
        .filter((t) => ["GOAL", "NO_GOAL", "SUBSTITUTION", "CARD", "HALF_TIME"].includes(t.type))
        .map((t) => `• ${t.label}${t.detail ? ` — ${t.detail}` : ""}`);
      const body = [
        `Full-time: ${scoreline}.`,
        ``,
        `${match.homeName} and ${match.awayName} went through all ${decided} questions to reach this result.`,
        ``,
        highlights.length ? highlights.join("\n") : "No highlights were recorded.",
        ``,
        "This match report was posted automatically at full time. The Player of the Match is decided automatically from performance.",
      ].join("\n");
      await prisma.newsPost.create({
        data: {
          title: scoreline,
          slug,
          excerpt: `${match.homeName} ${match.homeScore}–${match.awayScore} ${match.awayName} — full-time report, goals and key moments.`,
          body,
          published: true,
          authorId: actor.userId,
        },
      });
    }
  } catch { /* best effort — report posting must never block full time */ }
  try {
    await notifyAllUsers({
      icon: "🏁",
      title: `Full-time: ${scoreline}`,
      body: `The match report is live — see who took the automatic Player of the Match.`,
      link: `/match/${match.code}`,
    });
  } catch { /* best effort */ }
  return ok(undefined);
}

/* ------------------------------ penalty shootout --------------------------- */

export async function startPenalties(actor: Actor, input: { code: string }): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE" && match.status !== "FINISHED")
    return err("Start the match first — penalties come after the ten questions.");
  if (match.currentRound < 10) return err("All ten questions must be played before penalties.");
  if (match.homeScore !== match.awayScore) return err("Penalties are only available when the score is level.");
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
  input: { code: string; takerUserId?: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE" && match.status !== "FINISHED")
    return err("Penalties can only be taken after the questions have been decided.");
  const ps = match.penaltyShootout;
  if (!ps) return err("No penalty shootout in progress.");
  if (ps.status === "COMPLETE") return err("The penalty shootout is already complete.");

  // Check if there's already a pending question for this team
  const pendingKick = ps.kicks.find((k) => k.status === "PENDING_QUESTION" || k.status === "ANSWERED");
  if (pendingKick) return err("A penalty question is already open — decide it first.");

  const kicks = ps.kicks;
  const total = kicks.length + 1; // sequence of THIS kick (1-based)
  const teamSide: "HOME" | "AWAY" = total % 2 === 1 ? "HOME" : "AWAY"; // HOME kicks first, then strictly alternate

  // Resolve who takes the kick: the nominated starter, the side's captain,
  // or the first starter on the side as a fallback.
  const sideRoster = match.roster.filter((r) => r.team === teamSide && r.role === "STARTER");
  let taker = sideRoster.find((r) => r.userId === input.takerUserId);
  if (!taker) taker = sideRoster.find((r) => r.isCaptain) ?? sideRoster[0] ?? null;
  if (!taker) return err(`No active player is available on ${teamNameOf(match, teamSide)} to take the penalty.`);
  const takerName = taker.user.name;

  await prisma.$transaction(async (tx) => {
    // Create the penalty kick in PENDING_QUESTION state
    await tx.penaltyKick.create({
      data: {
        shootoutId: ps.id,
        team: teamSide,
        score: false, // Will be set when referee decides
        sequence: total,
        status: "PENDING_QUESTION",
        kickerUserId: taker.userId,
      },
    });

    const teamName = teamSide === "HOME" ? match.homeName : match.awayName;
    await appendTimeline(
      tx,
      match.id,
      "PENALTY_KICK_START",
      `Penalty kick for ${takerName} (${teamName})`,
      `Captain nominated ${takerName}. Waiting for question to be opened.`,
      actor.userId,
    );

    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/* --------------------------- penalty kick question flow ---------------------- */

/**
 * Captain/referee opens a penalty question for the nominated kicker.
 * Picks an unused question from the bank, opens it for the kicker only
 * with half the normal countdown time.
 */
export async function openPenaltyQuestion(
  actor: Actor,
  input: { code: string },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE" && match.status !== "FINISHED")
    return err("Penalties can only be taken after the questions have been decided.");
  const ps = match.penaltyShootout;
  if (!ps) return err("No penalty shootout in progress.");
  if (ps.status === "COMPLETE") return err("The penalty shootout is already complete.");

  // Find the current pending penalty kick (should be the latest one with PENDING_QUESTION)
  const currentKick = ps.kicks
    .filter((k) => k.status === "PENDING_QUESTION")
    .sort((a, b) => a.sequence - b.sequence)[0];
  if (!currentKick) return err("No pending penalty kick to answer.");

  // Get the kicker from the penalty kick record
  const kickerUserId = currentKick.kickerUserId;
  if (!kickerUserId) return err("No kicker nominated for this penalty kick.");

  const sideRoster = match.roster.filter((r) => r.team === currentKick.team && r.role === "STARTER");
  const kicker = sideRoster.find((r) => r.userId === kickerUserId);
  if (!kicker) return err("Nominated kicker is not an active player for this team.");

  // Pick an unused question from the bank (roundNumber == null)
  const unusedQuestions = match.questions.filter((q) => q.roundNumber == null);
  if (unusedQuestions.length === 0) return err("No unused questions available in the bank.");
  const question = unusedQuestions[0]; // Take the first unused

  const now = new Date();
  const halfCountdown = Math.max(5, Math.floor(match.countdownSeconds / 2)); // Half time, min 5s

  await prisma.$transaction(async (tx) => {
    // Update the penalty kick with the question and timing
    await tx.penaltyKick.update({
      where: { id: currentKick.id },
      data: {
        questionId: question.id,
        status: "ANSWERED", // Question opened, waiting for answer
        answeredAt: now,
      },
    });

    // Mark question as used for penalties
    await tx.question.update({
      where: { id: question.id },
      data: { roundNumber: 99 }, // Special marker for penalty questions
    });

    await appendTimeline(
      tx,
      match.id,
      "PENALTY_QUESTION_OPEN",
      `Penalty question for ${kicker.user.name} (${currentKick.team === "HOME" ? match.homeName : match.awayName})`,
      `Half time: ${halfCountdown}s — ${question.text}`,
      actor.userId,
    );

    await bumpVersion(tx, match.id);
  });
  await publishMatchUpdate(match.code);
  return ok(undefined);
}

/**
 * Referee decides the penalty kick: GOAL or NO_GOAL based on the kicker's answer.
 */
export async function decidePenaltyKick(
  actor: Actor,
  input: { code: string; decision: "GOAL" | "NO_GOAL" },
): Promise<ActionResult> {
  const match = await assertReferee(actor, input.code);
  if (match.status !== "LIVE" && match.status !== "FINISHED")
    return err("Penalties can only be decided during or after a live match.");
  const ps = match.penaltyShootout;
  if (!ps) return err("No penalty shootout in progress.");
  if (ps.status === "COMPLETE") return err("The penalty shootout is already complete.");

  // Find the current penalty kick awaiting decision
  const currentKick = ps.kicks
    .filter((k) => k.status === "ANSWERED")
    .sort((a, b) => a.sequence - b.sequence)[0];
  if (!currentKick) return err("No penalty kick awaiting decision.");

  const teamSide = currentKick.team as "HOME" | "AWAY";
  // Get kicker name from the penalty kick record
  const kickerName = currentKick.kicker?.name ?? "the kicker";

  const scored = input.decision === "GOAL";

  // Prospective scores including this kick
  const kicks = ps.kicks;
  const total = kicks.length; // currentKick is already in the list
  const aTaken = Math.ceil(total / 2);
  const bTaken = Math.floor(total / 2);
  const aScore = ps.teamAScore + (teamSide === "HOME" && scored ? 1 : 0);
  const bScore = ps.teamBScore + (teamSide === "AWAY" && scored ? 1 : 0);

  const REGULATION_KICKS_PER_TEAM = 3;
  let winner: "HOME" | "AWAY" | null = null;
  if (aTaken <= REGULATION_KICKS_PER_TEAM && bTaken <= REGULATION_KICKS_PER_TEAM) {
    if (aScore > bScore + (REGULATION_KICKS_PER_TEAM - bTaken)) winner = "HOME";
    else if (bScore > aScore + (REGULATION_KICKS_PER_TEAM - aTaken)) winner = "AWAY";
  } else if (total >= REGULATION_KICKS_PER_TEAM * 2 && aScore !== bScore) {
    winner = aScore > bScore ? "HOME" : "AWAY";
  }

  const newStatus = winner ? "COMPLETE" : "IN_PROGRESS";

  await prisma.$transaction(async (tx) => {
    await tx.penaltyKick.update({
      where: { id: currentKick.id },
      data: {
        score: scored,
        status: "DECIDED",
        decidedAt: new Date(),
      },
    });

    await tx.penaltyShootout.update({
      where: { id: ps.id },
      data: {
        teamAScore: teamSide === "HOME" && scored ? { increment: 1 } : undefined,
        teamBScore: teamSide === "AWAY" && scored ? { increment: 1 } : undefined,
        status: newStatus,
        winner,
      },
    });

    const teamName = teamSide === "HOME" ? match.homeName : match.awayName;
    const label = scored ? "Penalty scored" : "Penalty missed";
    const detail = `${kickerName} (${teamName}) — ${scored ? "Scored" : "Missed"}`;
    await appendTimeline(
      tx,
      match.id,
      scored ? "PENALTY_SCORED" : "PENALTY_MISS",
      label,
      detail,
      actor.userId,
    );

    if (newStatus === "COMPLETE") {
      const winnerTeam = winner === "HOME" ? match.homeName : match.awayName;
      await appendTimeline(
        tx,
        match.id,
        "PENALTY_SHOOTOUT_END",
        "Penalty shootout complete",
        `${winnerTeam} wins`,
        actor.userId,
      );
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
 * Refresh the viewer's presence row for a match. Throttled to one write per
 * PRESENCE_REFRESH_MS so a 2.5s heartbeat does not hammer the table — inside
 * the throttle window the existing lastSeenAt row is simply kept.
 */
async function touchMatchPresence(matchId: string, userId: string): Promise<void> {
  const now = new Date();
  const existing = await prisma.matchPresence.findUnique({
    where: { matchId_userId: { matchId, userId } },
    select: { lastSeenAt: true },
  });
  if (existing) {
    if (now.getTime() - existing.lastSeenAt.getTime() < PRESENCE_REFRESH_MS) return;
    await prisma.matchPresence.update({
      where: { matchId_userId: { matchId, userId } },
      data: { lastSeenAt: now },
    });
    return;
  }
  try {
    await prisma.matchPresence.create({ data: { matchId, userId, lastSeenAt: now } });
  } catch (e) {
    // Two tabs raced to create the row — the winner's row is enough.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
}

/**
 * Cheap reconcile used by client heartbeats: records the viewer's presence,
 * locks an OPEN round whose countdown has expired (whichever client notices
 * first wins — the update is guarded to run exactly once) and returns the
 * current version.
 */
export async function syncMatchState(code: string, userId?: string | null): Promise<number | null> {
  const match = await loadMatchFor(code);
  if (!match) return null;
  if (userId) await touchMatchPresence(match.id, userId);
  const open = match.rounds.find((r) => r.status === "OPEN");
  if (open && open.closesAt && Date.now() >= open.closesAt.getTime()) {
    await finalizeCurrentRound(code, match);
  }
  // Half-time runs on a timer: whoever syncs next after the break elapses
  // releases the pause for every viewer (idempotent, safe under concurrency).
  await autoResumeHalftime(match);
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
