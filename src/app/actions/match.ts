"use server";

import { Prisma } from "@prisma/client";
import {
  adminAddPlayer,
  adminCreateMatch,
  adminRemovePlayer,
  addQuestion,
  decideRound,
  decideSubstitution,
  endMatch,
  kickOff,
  lockAndReveal,
  MatchGuardError,
  openNextQuestion,
  pauseMatch,
  postponeMatch,
  recordIncident,
  removeQuestion,
  requestSubstitution,
  resumeMatch,
  setLineup,
  setMatchSchedule,
  setQuestionSlot,
  startHalftime,
  startPenalties,
  submitAnswer,
  syncMatchState,
  takePenaltyKick,
  transferCaptaincy,
  updateQuestion,
} from "@/lib/match/engine";
import type { Actor } from "@/lib/match/engine";
import { currentActor } from "@/lib/session";
import { buildSnapshot, loadMatchFullByCode } from "@/lib/match/snapshot";
import type { ActionResult, MatchSnapshot } from "@/lib/domain";

async function runEngine<T>(
  fn: (actor: Actor) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  try {
    return await fn(actor);
  } catch (e) {
    if (e instanceof MatchGuardError) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "That change conflicts with existing data — please refresh." };
    console.error("Server action failure:", e);
    return { ok: false, error: "Something went wrong, please try again." };
  }
}

/* ------------------------- admin: match + roster --------------------------- */

export async function createMatchAction(input: {
  homeName?: string;
  awayName?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  refereeId: string;
  countdownSeconds: number;
  scheduledAt?: string | null;
}): Promise<ActionResult<{ code: string }>> {
  return runEngine((actor) =>
    adminCreateMatch(actor, { ...input, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }),
  );
}

export async function setMatchScheduleAction(input: {
  code: string;
  scheduledAt: string | null;
}): Promise<ActionResult> {
  return runEngine((actor) =>
    setMatchSchedule(actor, { code: input.code, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }),
  );
}

export async function postponeMatchAction(input: {
  code: string;
  scheduledAt: string | null;
  reason?: string;
}): Promise<ActionResult> {
  return runEngine((actor) =>
    postponeMatch(actor, { code: input.code, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null, reason: input.reason }),
  );
}

export async function pauseMatchAction(code: string, reason?: string): Promise<ActionResult> {
  return runEngine((actor) => pauseMatch(actor, { code, reason }));
}

export async function resumeMatchAction(code: string): Promise<ActionResult> {
  return runEngine((actor) => resumeMatch(actor, { code }));
}

export async function startHalftimeAction(code: string): Promise<ActionResult> {
  return runEngine((actor) => startHalftime(actor, { code }));
}

export async function addPlayerAction(input: {
  code: string;
  userId: string;
  team: "HOME" | "AWAY";
  number: number;
}): Promise<ActionResult> {
  return runEngine((actor) => adminAddPlayer(actor, input));
}

export async function removePlayerAction(input: {
  code: string;
  userId: string;
}): Promise<ActionResult> {
  return runEngine((actor) => adminRemovePlayer(actor, input));
}

/* --------------------------- referee: questions ---------------------------- */

export async function addQuestionAction(input: {
  code: string;
  text: string;
  referenceAnswer: string;
}): Promise<ActionResult> {
  return runEngine((actor) => addQuestion(actor, input));
}

export async function updateQuestionAction(input: {
  code: string;
  questionId: string;
  text: string;
  referenceAnswer: string;
}): Promise<ActionResult> {
  return runEngine((actor) => updateQuestion(actor, input));
}

export async function removeQuestionAction(input: {
  code: string;
  questionId: string;
}): Promise<ActionResult> {
  return runEngine((actor) => removeQuestion(actor, input));
}

export async function setQuestionSlotAction(input: {
  code: string;
  questionId: string;
  roundNumber: number | null;
}): Promise<ActionResult> {
  return runEngine((actor) => setQuestionSlot(actor, input));
}

/* ----------------------------- referee: line-up ---------------------------- */

export async function setLineupAction(input: {
  code: string;
  team: "HOME" | "AWAY";
  captainUserId: string;
  starterIds: string[];
}): Promise<ActionResult> {
  return runEngine((actor) => setLineup(actor, input));
}

export async function kickOffAction(code: string): Promise<ActionResult> {
  return runEngine((actor) => kickOff(actor, { code }));
}

/* ------------------------------- live rounds ------------------------------- */

export async function openNextQuestionAction(code: string): Promise<ActionResult> {
  return runEngine((actor) => openNextQuestion(actor, { code }));
}

export async function submitAnswerAction(code: string, answer: string): Promise<ActionResult> {
  return runEngine((actor) => submitAnswer(actor, { code, answer }));
}

export async function lockRevealAction(code: string, force = false): Promise<ActionResult> {
  return runEngine((actor) => lockAndReveal(actor, { code, force }));
}

export async function decideRoundAction(input: {
  code: string;
  decision: "GOAL" | "NO_GOAL";
  submissionId?: string;
}): Promise<ActionResult> {
  return runEngine((actor) => decideRound(actor, input));
}

export async function endMatchAction(code: string): Promise<ActionResult> {
  return runEngine((actor) => endMatch(actor, { code }));
}

/* ------------------------------ penalty shootout -------------------------- */

export async function startPenaltiesAction(code: string): Promise<ActionResult> {
  return runEngine((actor) => startPenalties(actor, { code }));
}

export async function takePenaltyKickAction(code: string, scored: boolean): Promise<ActionResult> {
  return runEngine((actor) => takePenaltyKick(actor, { code, scored }));
}

/* ------------------------------ substitutions ------------------------------ */

export async function requestSubstitutionAction(input: {
  code: string;
  playerOutUserId: string;
  playerInUserId: string;
}): Promise<ActionResult> {
  return runEngine((actor) => requestSubstitution(actor, input));
}

export async function transferCaptaincyAction(input: {
  code: string;
  toUserId: string;
}): Promise<ActionResult> {
  return runEngine((actor) => transferCaptaincy(actor, input));
}

export async function decideSubstitutionAction(input: {
  code: string;
  requestId: string;
  approve: boolean;
}): Promise<ActionResult> {
  return runEngine((actor) => decideSubstitution(actor, input));
}

/* --------------------------------- conduct -------------------------------- */

export async function recordIncidentAction(input: {
  code: string;
  playerUserId: string;
  type: string;
  action: string;
  note?: string;
}): Promise<ActionResult> {
  return runEngine((actor) =>
    recordIncident(actor, {
      code: input.code,
      playerUserId: input.playerUserId,
      type: input.type as never,
      action: input.action as never,
      note: input.note,
    }),
  );
}

/* ----------------------------- public read path ---------------------------- */

async function snapshotFor(code: string) {
  const match = await loadMatchFullByCode(code);
  if (!match) return null;
  const actor = await currentActor();
  return buildSnapshot(
    match,
    actor ? { role: actor.role, userId: actor.userId } : { role: "PUBLIC", userId: null },
  );
}

export async function getMatchSnapshotAction(
  code: string,
): Promise<ActionResult<MatchSnapshot>> {
  try {
    const data = await snapshotFor(code);
    if (!data) return { ok: false, error: "Match not found." };
    return { ok: true, data };
  } catch (e) {
    console.error("getMatchSnapshotAction failed", e);
    return { ok: false, error: "Could not load match state." };
  }
}

export async function syncMatchAction(
  code: string,
): Promise<ActionResult<{ version: number }>> {
  try {
    const version = await syncMatchState(code);
    if (version == null) return { ok: false, error: "Match not found." };
    return { ok: true, data: { version } };
  } catch (e) {
    console.error("syncMatchAction failed", e);
    return { ok: false, error: "Could not sync match state." };
  }
}
