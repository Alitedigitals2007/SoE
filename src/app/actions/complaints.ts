"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/session";
import type { ActionResult, Role } from "@/lib/domain";

export type ComplaintType = "MATCH_DECISION" | "PLAYER_CONDUCT" | "TECHNICAL" | "OTHER";

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 2000;

const TYPE_LABEL: Record<ComplaintType, string> = {
  MATCH_DECISION: "Referee decision",
  PLAYER_CONDUCT: "Player conduct",
  TECHNICAL: "Technical issue",
  OTHER: "Something else",
};

export async function fileComplaintAction(input: {
  type: ComplaintType;
  matchId?: string | null;
  subject: string;
  message: string;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to file a complaint." };

  const type = input.type;
  if (!(type in TYPE_LABEL)) return { ok: false, error: "Pick what the complaint is about." };

  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject) return { ok: false, error: "Give the complaint a short subject." };
  if (subject.length > SUBJECT_MAX) return { ok: false, error: `Keep the subject under ${SUBJECT_MAX} characters.` };
  if (!message) return { ok: false, error: "Describe what happened." };
  if (message.length > MESSAGE_MAX) return { ok: false, error: `Keep the details under ${MESSAGE_MAX} characters.` };

  let matchId: string | null = null;
  if (input.matchId) {
    const match = await prisma.match.findUnique({ where: { id: input.matchId }, select: { id: true } });
    if (!match) return { ok: false, error: "That fixture no longer exists." };
    matchId = match.id;
  }

  try {
    const complaint = await prisma.complaint.create({
      data: { userId: actor.userId, type, matchId, subject, message },
      select: { id: true },
    });
    return { ok: true, data: complaint };
  } catch (e) {
    console.error("fileComplaintAction failed", e);
    return { ok: false, error: "Could not file the complaint — please try again." };
  }
}

/** Admin: settle a complaint with a note (RESOLVED or DISMISSED). */
export async function resolveComplaintAction(
  complaintId: string,
  outcome: "RESOLVED" | "DISMISSED",
  adminNote?: string,
): Promise<ActionResult> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  if (actor.role !== ("ADMIN" satisfies Role)) return { ok: false, error: "Only admins can handle complaints." };

  const note = adminNote?.trim() || null;
  if (note && note.length > 1000) return { ok: false, error: "Keep the note under 1000 characters." };

  try {
    await prisma.complaint.update({
      where: { id: complaintId },
      data: { status: outcome, adminNote: note, resolvedBy: actor.userId, resolvedAt: new Date() },
    });
    return { ok: true, data: undefined };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      return { ok: false, error: "That complaint no longer exists." };
    console.error("resolveComplaintAction failed", e);
    return { ok: false, error: "Could not update the complaint." };
  }
}
