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
  OTHER: "Other",
};

export const INCIDENT_ACTIONS: Record<IncidentAction, string> = {
  WARNING: "Warning",
  YELLOW_CARD: "Yellow Card",
  RED_CARD: "Red Card",
};

/* ------------------------------ Public views ------------------------------ */

export interface RosterSlotView {
  userId: string;
  name: string;
  team: TeamSide;
  number: number;
  role: LineupRole;
  isCaptain: boolean;
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
    | "FULL_TIME";
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
  startedAt: string | null;
  finishedAt: string | null;
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
}

/** Result shape for server actions — never throw across the boundary. */
export type ErrResult = { ok: false; error: string };
export type ActionResult<T = void> = { ok: true; data: T } | ErrResult;
