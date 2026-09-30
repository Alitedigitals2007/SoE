/**
 * Domain vocabulary shared between server and client.
 * Mirrors the Prisma enums but as plain string unions so client components
 * never need to import the generated Prisma client.
 */

export type Role = "ADMIN" | "REFEREE" | "PLAYER" | "USER";
export type TeamSide = "HOME" | "AWAY";
export type MatchStatus = "DRAFT" | "LIVE" | "FINISHED";
export type LineupRole = "STARTER" | "SUB" | "OUT";
export type RoundStatus = "PENDING" | "OPEN" | "LOCKED" | "DECIDED";
export type RoundDecision = "GOAL" | "NO_GOAL";
export type IncidentAction = "WARNING" | "YELLOW_CARD" | "RED_CARD";
export type IncidentType =
  | "OUTSIDE_TIME"
  | "ANSWER_MANIPULATION"
  | "ANSWER_SHARING"
  | "ABUSIVE_BEHAVIOUR"
  | "CHAT_SPAM"
  | "ACCOUNT_MISUSE"
  | "UNAUTHORIZED_ASSISTANCE"
  | "DISRESPECT_REFEREE"
  | "COPIED_ANSWER"
  | "LEFT_FULLSCREEN"
  | "AI_ASSISTANCE"
  | "OTHER";

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  OUTSIDE_TIME: "Answering outside allowed time",
  ANSWER_MANIPULATION: "Attempted answer manipulation",
  ANSWER_SHARING: "Answer sharing",
  ABUSIVE_BEHAVIOUR: "Abusive behaviour",
  CHAT_SPAM: "Chat/spam disruption",
  ACCOUNT_MISUSE: "Account misuse",
  UNAUTHORIZED_ASSISTANCE: "Unauthorized assistance",
  DISRESPECT_REFEREE: "Disrespect toward referee",
  COPIED_ANSWER: "Answer pasted or dropped in",
  LEFT_FULLSCREEN: "Left fullscreen during a question",
  AI_ASSISTANCE: "External / AI assistance",
  OTHER: "Other",
};

export const INCIDENT_ACTIONS: Record<IncidentAction, string> = {
  WARNING: "Warning",
  YELLOW_CARD: "Yellow Card",
  RED_CARD: "Red Card",
};

/* -------------------------------- half-time -------------------------------- */

/** The break kicks in automatically as soon as the fifth question is decided. */
export const HALFTIME_AFTER_QUESTION = 5;
/** Automatic break length, in seconds (two minutes) — an admin/referee can cut it short. */
export const HALFTIME_SECONDS = 120;
/** Questions played per match (the bank prepares more; rounds 1..10 are played). */
export const MATCH_ROUNDS = 10;

/* ---------------------------- Match integrity ------------------------------- */

/**
 * Breach kinds. A copy attempt on the question is reported separately from a
 * paste into the answer box, because the referee judges them differently: a
 * copy is an attempt to leak the question, a paste is an attempt to inject an
 * answer.
 */
export type IntegrityFlagKind =
  | "COPIED_ANSWER"
  | "COPIED_CONTENT"
  | "LEFT_FULLSCREEN"
  | "TAB_SWITCH"
  | "RIGHT_CLICK"
  | "KEYBOARD_SHORTCUT"
  | "SCREEN_RECORDING"
  | "AI_ASSISTANCE";

export const INTEGRITY_KIND_LABELS: Record<IntegrityFlagKind, string> = {
  COPIED_ANSWER: "Answer pasted in",
  COPIED_CONTENT: "Copied from the screen",
  LEFT_FULLSCREEN: "Left fullscreen",
  TAB_SWITCH: "Switched tabs/windows",
  RIGHT_CLICK: "Right-clicked on match area",
  KEYBOARD_SHORTCUT: "Used blocked keyboard shortcut",
  SCREEN_RECORDING: "Attempted screen recording",
  AI_ASSISTANCE: "AI-generated answer detected",
};

export const INTEGRITY_KIND_ICONS: Record<IntegrityFlagKind, string> = {
  COPIED_ANSWER: "📋",
  COPIED_CONTENT: "⧉",
  LEFT_FULLSCREEN: "⛶",
  TAB_SWITCH: "🔀",
  RIGHT_CLICK: "🖱️",
  KEYBOARD_SHORTCUT: "⌨️",
  SCREEN_RECORDING: "🎥",
  AI_ASSISTANCE: "🤖",
};

/**
 * Escalation rule: a player's nth breach of a match is worth a warning, then a
 * yellow, then a red. Ordinals past three stay at red.
 */
export function integrityActionForSeq(seq: number): IncidentAction {
  if (seq >= 3) return "RED_CARD";
  if (seq === 2) return "YELLOW_CARD";
  return "WARNING";
}

/** Minimum gap between two accepted breach reports from one player, in ms. */
export const INTEGRITY_REPORT_COOLDOWN_MS = 2000;

/* ------------------------------ Public views ------------------------------ */

export interface RosterSlotView {
  userId: string;
  name: string;
  team: TeamSide;
  number: number;
  role: LineupRole;
  isCaptain: boolean;
  /** 0-100, higher = cleaner record. 100 = no breaches. */
  integrityScore: number;
}

export interface TimelineItemView {
  id: string;
  type:
    | "KICKOFF"
    | "QUESTION_OPEN"
    | "ANSWERS_LOCKED"
    | "GOAL"
    | "NO_GOAL"
    | "SUBSTITUTION"
    | "CARD"
    | "HALF_TIME"
    | "FULL_TIME"
    | "PENALTY_SAVED"
    | "PENALTY_SCORED"
    | "PENALTY_MISS"
    | "PENALTY_SHOOTOUT_START"
    | "PENALTY_SHOOTOUT_END"
    | "INTEGRITY_FLAG"
    | "ADMIN_OVERRIDE";
  label: string;
  detail?: string | null;
  at: string; // ISO
  elapsedSec: number | null; // seconds since kick-off, null before kick-off
}

export interface AnswerView {
  id: string;
  answer: string;
  /** visible to players/spectators while anonymous only */
  visible: boolean;
  playerName?: string;
  team?: TeamSide;
  at: string;
  winner?: boolean;
  /** referee/admin only: the answer was pasted or dropped in, not typed */
  pasted?: boolean;
  /** referee/admin only: server flagged this as potentially AI-generated */
  aiDetected?: boolean;
}

/** One anti-copy breach, as shown on the referee's integrity board. */
export interface IntegrityFlagView {
  id: string;
  kind: IntegrityFlagKind;
  detail: string | null;
  /** this player's nth breach of the match, 1-based */
  seq: number;
  suggested: IncidentAction;
  action: IncidentAction | null;
  playerUserId: string;
  playerName: string;
  team: TeamSide;
  number: number;
  roundNumber: number | null;
  submissionId: string | null;
  at: string;
  issuedAt: string | null;
}

export interface IntegrityBoardView {
  /** referee/admin only: every breach, newest last. Empty for everyone else. */
  flags: IntegrityFlagView[];
  /** public: how many breaches have been punished. Shown on the scoreboard. */
  issuedCount: number;
}

export interface RoundView {
  number: number;
  status: RoundStatus;
  questionText: string | null; // hidden until the referee opens the round
  closesAt: string | null;
  answers: AnswerView[];
  decision: RoundDecision | null;
  correctAnswer: string | null;
  winnerName: string | null;
  winnerTeam: TeamSide | null;
  winnerAnswer: string | null;
  awaitingReferee: boolean; // LOCKED and not yet decided
}

export interface PlayerCtx {
  userId: string;
  name: string;
  team: TeamSide;
  number: number;
  role: LineupRole;
  isCaptain: boolean;
  /** true when the user can still submit for the current OPEN round */
  canSubmitNow: boolean;
  myAnswerThisRound: string | null;
  didAnswerThisRound: boolean;
}

export interface SubRequestView {
  id: string;
  team: TeamSide;
  status: "PENDING" | "APPROVED" | "REJECTED";
  playerIn: { userId: string; name: string };
  playerOut: { userId: string; name: string };
  requestedBy: { userId: string; name: string };
  createdAt: string;
}

export interface PenaltyKickView {
  team: TeamSide;
  scored: boolean;
  sequence: number;
}

export interface PenaltyShootoutView {
  status: "IN_PROGRESS" | "COMPLETE";
  teamAScore: number;
  teamBScore: number;
  winner: TeamSide | null;
  kicks: PenaltyKickView[];
  currentKickTeam: TeamSide | null;
  nextSequence: number;
}

export interface MatchSummary {
  finalHome: string;
  finalAway: string;
  homeScore: number;
  awayScore: number;
  scorers: { name: string; team: TeamSide; goals: number }[];
  noGoalQuestions: number;
  questionsPlayed: number;
  cards: { name: string; team: TeamSide; action: IncidentAction }[];
  substitutions: {
    team: TeamSide;
    playerIn: string;
    playerOut: string;
  }[];
  timeline: TimelineItemView[];
  topAnswers: { name: string; team: TeamSide; goals: number }[];
  /** Post-match integrity report: total breaches, AI detections, and per-player scores */
  integrityReport: {
    totalBreaches: number;
    aiDetections: number;
    playerScores: { name: string; team: TeamSide; score: number; breaches: number }[];
  };
}

export interface MatchSnapshot {
  matchId: string;
  code: string;
  status: MatchStatus;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  version: number;
  countdownSeconds: number;
  currentRound: number; // decided rounds so far
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  paused: boolean;
  pauseNote: string | null;
  /** When the current pause began (ISO) — drives the half-time countdown. */
  pausedAt: string | null;
  roster: RosterSlotView[];
  timeline: TimelineItemView[];
  round: RoundView | null; // the round in flight (OPEN/LOCKED) or null
  nextQuestionIndex: number | null; // 1..10 when a new round can be opened
  refereeId: string;
  refereeName: string;
  viewer: {
    role: Role | "PUBLIC";
    userId: string | null;
    isReferee: boolean;
    isAdmin: boolean;
    player: PlayerCtx | null;
  };
  /** visible to referee/admin; empty for others */
  pendingRequests: SubRequestView[];
  summary: MatchSummary | null;
  potm: {
    votedFor: string | null;
    closedAt: string | null;
    results: { playerId: string; playerName: string; votes: number }[];
  };
  competitionType: "LEAGUE" | "CUP" | null;
  cupRound: number | null;
  penaltyShootout: PenaltyShootoutView | null;
  /** anti-copy board: full detail for the referee, a counter for everyone */
  integrity: IntegrityBoardView;
}

/** Result shape for server actions — never throw across the boundary. */
export type ErrResult = { ok: false; error: string };
export type ActionResult<T = void> = { ok: true; data: T } | ErrResult;
