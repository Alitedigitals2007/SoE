import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scoreMotm } from "@/lib/match/motm";
import {
  PRESENCE_WINDOW_MS,
  type AnswerView,
  type IncidentAction,
  type IntegrityBoardView,
  type MatchSnapshot,
  type PenaltyKickView,
  type TeamSide,
  type PenaltyShootoutView,
  type RosterSlotView,
  type RoundView,
  type TimelineItemView,
} from "@/lib/domain";
import { elapsedSecondsSince } from "@/lib/matchCode";

// Local type for PenaltyKick with included relations from loadMatchFor
type PenaltyKickWithIncludes = Prisma.PenaltyKickGetPayload<{
  include: {
    question: { select: { id: true; text: true; referenceAnswer: true } };
    kicker: { select: { id: true; name: true } };
  };
}>;

export const matchInclude = {
  referee: { select: { id: true, name: true } },
  roster: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ team: "asc" as const }, { number: "asc" as const }],
  },
  rounds: {
    orderBy: { number: "asc" as const },
    include: {
      question: { select: { id: true, text: true, referenceAnswer: true } },
      submissions: {
        orderBy: { submittedAt: "asc" as const },
        include: {
          player: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
      goalSubmission: {
        include: {
          player: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
      assistPlayer: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  },
  timeline: { orderBy: { seq: "asc" as const } },
  incidents: {
    include: {
      player: { include: { user: { select: { id: true, name: true } } } },
    },
  },
  substitutions: {
    include: {
      playerIn: { include: { user: { select: { id: true, name: true } } } },
      playerOut: { include: { user: { select: { id: true, name: true } } } },
    },
  },
  requests: {
    include: {
      requestedBy: { select: { id: true, name: true } },
    },
  },
  penaltyShootout: {
    include: {
      kicks: { orderBy: { sequence: "asc" as const } },
    },
  },
  competition: { select: { type: true } },
  integrityFlags: {
    orderBy: { createdAt: "asc" as const },
    include: {
      player: { include: { user: { select: { id: true, name: true } } } },
      round: { select: { number: true } },
    },
  },
  motmUser: { select: { id: true, name: true, imageUrl: true } },
  presence: { select: { userId: true, lastSeenAt: true } },
} satisfies Prisma.MatchInclude;

export type MatchFull = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

export async function loadMatchFullByCode(code: string): Promise<MatchFull | null> {
  return prisma.match.findUnique({
    where: { code: code.toUpperCase() },
    include: matchInclude,
  });
}

export async function loadMatchFullById(id: string): Promise<MatchFull | null> {
  return prisma.match.findUnique({
    where: { id },
    include: matchInclude,
  });
}

function roundToView(
  round: MatchFull["rounds"][number],
  isReferee: boolean,
  roster: RosterSlotView[],
): RoundView {
  const answers: AnswerView[] = round.submissions.map((s) => {
    const slot = roster.find((r) => r.userId === s.player.userId);
    return {
      id: s.id,
      answer: s.answer,
      visible: true,
      playerName: isReferee ? s.player.user.name : undefined,
      team: isReferee && slot ? slot.team : undefined,
      at: s.submittedAt.toISOString(),
        winner: round.goalSubmissionId === s.id,
      // The paste badge is a referee's-eye signal only: spectators see the
      // answer text but are told nothing about how it got typed.
      pasted: isReferee ? s.pasted : undefined,
      // AI detection is also referee-only: players don't know they were flagged.
      aiDetected: isReferee ? s.aiDetected : undefined,
    };
  });

  const revealed = round.status === "LOCKED" || round.status === "DECIDED";
  const isGoal = round.decision === "GOAL";
  const isNoGoal = round.decision === "NO_GOAL";
  const showCorrect =
    round.status === "DECIDED" &&
    (isNoGoal || (isGoal && round.goalSubmission === null));
  const winner = round.goalSubmission;

  return {
    number: round.number,
    status: round.status,
    questionText:
      round.status === "PENDING" ? null : round.question.text,
    closesAt: round.closesAt ? round.closesAt.toISOString() : null,
    answers: revealed ? answers : [],
    decision: round.decision,
    correctAnswer:
      isReferee && round.status === "LOCKED"
        ? round.question.referenceAnswer
        : showCorrect
          ? round.question.referenceAnswer
          : null,
    winnerName: winner?.player.user.name ?? null,
    winnerTeam: winner?.player.team ?? null,
    winnerAnswer: winner?.answer ?? null,
    awaitingReferee: round.status === "LOCKED",
  };
}

export function buildSnapshot(
  match: MatchFull,
  viewer: {
    role: "ADMIN" | "REFEREE" | "PLAYER" | "USER" | "PUBLIC";
    userId: string | null;
  },
  now = new Date(),
): MatchSnapshot {
  const isReferee =
      viewer.role === "ADMIN" || (viewer.role === "REFEREE" && match.refereeId === viewer.userId);
  const isAdmin = viewer.role === "ADMIN";

  // Readiness: a player is online while their last heartbeat is inside the
  // presence window (see MatchPresence + syncMatchState).
  const presenceCutoff = now.getTime() - PRESENCE_WINDOW_MS;
  const onlineUserIds = new Set(
    match.presence
      .filter((p) => p.lastSeenAt.getTime() >= presenceCutoff)
      .map((p) => p.userId),
  );

  const roster: RosterSlotView[] = match.roster.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    team: m.team,
    number: m.number,
    role: m.role,
    isCaptain: m.isCaptain,
    integrityScore: m.integrityScore,
    online: onlineUserIds.has(m.userId),
  }));

  const viewerRosterSlot =
      viewer.userId && viewer.role === "PLAYER"
      ? match.roster.find((m) => m.userId === viewer.userId)
      : null;

  // Active round: an OPEN or LOCKED round wins; otherwise the latest DECIDED
  // round stays on screen as its reveal until the next one opens.
  const openLocked = match.rounds.find(
    (r) => r.status === "OPEN" || r.status === "LOCKED",
  );
  const decidedRounds = match.rounds.filter((r) => r.status === "DECIDED");
  const latestDecided = decidedRounds[decidedRounds.length - 1];
  const activeRound = openLocked ?? latestDecided ?? null;

  const timeline: TimelineItemView[] = match.timeline.map((e) => ({
    id: e.id,
    type: e.type,
    label: e.label,
    detail: e.detail,
    card: e.cardAction,
    at: e.createdAt.toISOString(),
    elapsedSec: elapsedSecondsSince(match.startedAt, e.createdAt),
  }));

  const round: RoundView | null = activeRound
    ? roundToView(activeRound, isReferee, roster)
    : null;

  const liveOpenRound =
    match.rounds.find((r) => r.status === "OPEN") ?? null;
  const myCurrentSubmission =
    viewerRosterSlot && liveOpenRound
      ? liveOpenRound.submissions.find((s) => s.playerId === viewerRosterSlot.id)
      : null;

  const playerCtx = viewerRosterSlot
    ? {
        userId: viewerRosterSlot.userId,
        name: viewerRosterSlot.user.name,
        team: viewerRosterSlot.team as TeamSide,
        number: viewerRosterSlot.number,
        role: viewerRosterSlot.role,
        isCaptain: viewerRosterSlot.isCaptain,
        canSubmitNow:
          match.status === "LIVE" &&
          !!liveOpenRound &&
          viewerRosterSlot.role === "STARTER" &&
          !myCurrentSubmission &&
          (!liveOpenRound.closesAt || liveOpenRound.closesAt.getTime() > now.getTime()),
        myAnswerThisRound: myCurrentSubmission?.answer ?? null,
        didAnswerThisRound: !!myCurrentSubmission,
      }
    : null;

  const openRoundCount = match.rounds.filter((r) => r.status === "OPEN").length;
  const lockedPendingRef = match.rounds.some(
    (r) => r.status === "LOCKED",
  );

  const ps = match.penaltyShootout;
  let penaltyShootout: PenaltyShootoutView | null = null;
  if (ps) {
    const kicks: PenaltyKickView[] = (ps.kicks as PenaltyKickWithIncludes[]).map((k) => ({
      team: k.team as TeamSide,
      scored: k.score,
      sequence: k.sequence,
      status: k.status as "PENDING_QUESTION" | "ANSWERED" | "DECIDED",
      questionId: k.questionId ?? undefined,
      question: k.question ? { id: k.question.id, text: k.question.text, referenceAnswer: k.question.referenceAnswer } : undefined,
      answer: k.answer ?? undefined,
      answeredAt: k.answeredAt?.toISOString() ?? undefined,
      decidedAt: k.decidedAt?.toISOString() ?? undefined,
      kickerUserId: k.kickerUserId ?? undefined,
      kickerName: k.kicker?.name ?? undefined,
    }));
    const totalKicks = kicks.length;
    let currentKickTeam: TeamSide | null = null;
    if (ps.status === "IN_PROGRESS") {
      // HOME kicks first, then strictly alternating on each subsequent kick.
      currentKickTeam = totalKicks % 2 === 0 ? "HOME" : "AWAY";
    }
    penaltyShootout = {
      status: ps.status as "IN_PROGRESS" | "COMPLETE",
      teamAScore: ps.teamAScore,
      teamBScore: ps.teamBScore,
      winner: ps.winner as TeamSide | null,
      kicks,
      currentKickTeam,
      nextSequence: totalKicks + 1,
    };
  }

  return {
    matchId: match.id,
    code: match.code,
    status: match.status,
    homeName: match.homeName,
    awayName: match.awayName,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    version: match.version,
    countdownSeconds: match.countdownSeconds,
    currentRound: match.currentRound,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    startedAt: match.startedAt?.toISOString() ?? null,
    finishedAt: match.finishedAt?.toISOString() ?? null,
    paused: !!match.pausedAt,
    pauseNote: match.statusNote ?? null,
    pausedAt: match.pausedAt?.toISOString() ?? null,
    roster,
    timeline,
    round,
    nextQuestionIndex:
      match.status === "LIVE" &&
      match.currentRound < 10 &&
      openRoundCount === 0 &&
      !lockedPendingRef
        ? match.currentRound + 1
        : null,
    refereeId: match.refereeId ?? "",
    refereeName: match.referee?.name ?? "Unassigned",
    viewer: {
      role: viewer.role,
      userId: viewer.userId,
      isReferee,
      isAdmin,
      player: playerCtx,
    },
    summary: match.status === "FINISHED" ? buildSummary(match) : null,
    pendingRequests:
      isReferee || isAdmin
        ? match.requests.map((r) => {
            const playerIn = match.roster.find((s) => s.id === r.playerInId);
            const playerOut = match.roster.find((s) => s.id === r.playerOutId);
            return {
              id: r.id,
              team: r.team,
              status: r.status,
              playerIn: { userId: playerIn?.userId ?? "", name: playerIn?.user.name ?? "Unknown" },
              playerOut: { userId: playerOut?.userId ?? "", name: playerOut?.user.name ?? "Unknown" },
              requestedBy: { userId: r.requestedBy.id, name: r.requestedBy.name },
              createdAt: r.createdAt.toISOString(),
            };
          })
        : [],
    motm: buildMotm(match),
    competitionType: (match.competition?.type === "LEAGUE" || match.competition?.type === "CUP") ? match.competition.type : null,
    cupRound: match.cupRound ?? null,
    penaltyShootout,
    integrity: buildIntegrity(match, isReferee || isAdmin),
  };
}

/**
 * The anti-copy board. The breach list is referee/admin only; the count of
 * punished breaches is public so the scoreboard can carry the tally and a
 * player knows a card has already been issued elsewhere in the match.
 */
function buildIntegrity(
  match: MatchFull,
  canSeeFlags: boolean,
): IntegrityBoardView {
  return {
    issuedCount: match.integrityFlags.filter((f) => f.action !== null).length,
    flags: canSeeFlags
      ? match.integrityFlags.map((f) => ({
          id: f.id,
          kind: f.kind,
          detail: f.detail,
          seq: f.seq,
          suggested: f.suggested,
          action: f.action,
          ignored: f.ignoredAt !== null,
          playerUserId: f.player.userId,
          playerName: f.player.user.name,
          team: f.player.team as TeamSide,
          number: f.player.number,
          roundNumber: f.round?.number ?? null,
          submissionId: f.submissionId,
          at: f.createdAt.toISOString(),
          issuedAt: f.issuedAt?.toISOString() ?? null,
        }))
      : [],
  };
}

function buildSummary(
  match: MatchFull,
): NonNullable<MatchSnapshot["summary"]> {
  const goalSubs = match.rounds.flatMap((r) =>
    r.goalSubmission
      ? [
          {
            id: r.goalSubmission.player.user.id,
            name: r.goalSubmission.player.user.name,
            team: r.goalSubmission.player.team as TeamSide,
            goals: 1,
          },
        ]
      : [],
  );

  const scorerMap = new Map<string, { id: string; name: string; team: TeamSide; goals: number }>();
  for (const g of goalSubs) {
    const key = g.id;
    const existing = scorerMap.get(key);
    if (existing) existing.goals += 1;
    else scorerMap.set(key, { ...g });
  }

  // Assists: every decided goal round may credit an assist player.
  const assistMap = new Map<string, { name: string; team: TeamSide; assists: number }>();
  for (const r of match.rounds) {
    if (r.status !== "DECIDED" || r.decision !== "GOAL" || !r.assistPlayer) continue;
    const key = r.assistPlayer.user.id;
    const existing = assistMap.get(key);
    if (existing) existing.assists += 1;
    else
      assistMap.set(key, {
        name: r.assistPlayer.user.name,
        team: r.assistPlayer.team as TeamSide,
        assists: 1,
      });
  }
  const assisters = [...assistMap.values()].sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name));

  const decidedRounds = match.rounds.filter((r) => r.status === "DECIDED");
  const noGoalCount = decidedRounds.filter((r) => r.decision === "NO_GOAL").length;
  const questionsPlayed = decidedRounds.length;

  const cards = match.incidents
    .filter((i) => i.action === "YELLOW_CARD" || i.action === "RED_CARD")
    .map((i) => ({
      name: i.player.user.name,
      team: i.player.team as TeamSide,
      action: i.action as IncidentAction,
    }));

  const substitutions = match.substitutions.map((s) => ({
    team: s.team as TeamSide,
    playerIn: s.playerIn.user.name,
    playerOut: s.playerOut.user.name,
  }));

  const scorers = [...scorerMap.values()].sort((a, b) => b.goals - a.goals);

  const timeline: TimelineItemView[] = match.timeline.map((e) => ({
    id: e.id,
    type: e.type,
    label: e.label,
    detail: e.detail,
    card: e.cardAction,
    at: e.createdAt.toISOString(),
    elapsedSec: elapsedSecondsSince(match.startedAt, e.createdAt),
  }));

  // Post-match integrity report
  const totalBreaches = match.integrityFlags.length;
  const aiDetections = match.integrityFlags.filter((f) => f.kind === "AI_ASSISTANCE").length;
  const playerScores = match.roster
    .map((r) => ({
      name: r.user.name,
      team: r.team as TeamSide,
      score: r.integrityScore,
      breaches: match.integrityFlags.filter((f) => f.playerId === r.id).length,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    finalHome: match.homeName,
    finalAway: match.awayName,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    scorers,
    assisters,
    noGoalQuestions: noGoalCount,
    questionsPlayed,
    cards,
    substitutions,
    timeline,
    topAnswers: scorers,
    integrityReport: {
      totalBreaches,
      aiDetections,
      playerScores,
    },
  };
}

function buildMotm(match: MatchFull): MatchSnapshot["motm"] {
  if (!match.motmUser || match.motmScore == null) return null;
  const candidate = scoreMotm({
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    roster: match.roster.map((r) => ({ userId: r.userId, team: r.team, user: r.user })),
    rounds: match.rounds.map((r) => ({
      decision: r.decision,
      goalSubmission: r.goalSubmission ? { player: { userId: r.goalSubmission.player.userId } } : null,
      assistPlayer: r.assistPlayer ? { userId: r.assistPlayer.userId } : null,
    })),
    incidents: match.incidents.map((i) => ({ action: i.action, player: { userId: i.player.userId } })),
  }).find((c) => c.userId === match.motmUser!.id);
  if (!candidate) return null;
  const { userId, name, points, ...breakdown } = candidate;
  return { userId, name, imageUrl: match.motmUser.imageUrl, points, ...breakdown };
}
