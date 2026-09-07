"use client";

import * as React from "react";
import Link from "next/link";
import {
  decideRoundAction,
  decideSubstitutionAction,
  endMatchAction,
  lockRevealAction,
  openNextQuestionAction,
  pauseMatchAction,
  recordIncidentAction,
  requestSubstitutionAction,
  resumeMatchAction,
  startHalftimeAction,
  startPenaltiesAction,
  submitAnswerAction,
  takePenaltyKickAction,
  transferCaptaincyAction,
} from "@/app/actions/match";
import { useMatchState, type LiveMode } from "@/components/match/useMatchState";
import { Badge, Button, Card, CardHeader, EmptyState, Select, Spinner, cn } from "@/components/ui";
import { normalizeAnswer } from "@/lib/normalize";
import { PotmVote } from "@/components/match/PotmVote";
import {
  INCIDENT_ACTIONS,
  INCIDENT_LABELS,
  type IncidentAction,
  type IncidentType,
  type MatchSnapshot,
  type PenaltyShootoutView,
  type RoundView,
  type TeamSide,
  type TimelineItemView,
} from "@/lib/domain";
import { ChatBox } from "@/components/match/ChatBox";

export function Arena({ code, initial }: { code: string; initial: MatchSnapshot }) {
  const { snapshot, mode } = useMatchState(code, initial);
  const [error, setError] = React.useState<string | null>(null);
  const clearError = () => setError(null);
  return <ArenaInner snapshot={snapshot} mode={mode} error={error} onError={setError} onClearError={clearError} />;
}

function ArenaInner({
  snapshot,
  mode,
  error,
  onError,
  onClearError,
}: {
  snapshot: MatchSnapshot;
  mode: LiveMode;
  error: string | null;
  onError: (e: string | null) => void;
  onClearError: () => void;
}) {
  const isReferee = snapshot.viewer.isReferee;
  const matchLive = snapshot.status === "LIVE";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <MatchHeader snapshot={snapshot} mode={mode} />

      {snapshot.paused && snapshot.status === "LIVE" ? (
        <div className="mt-4 rounded-xl border-2 border-warning/50 bg-warning/10 px-4 py-3 text-center text-sm font-semibold text-warning">
          ⏸ Match paused{snapshot.pauseNote ? ` — ${snapshot.pauseNote}` : ""}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {error ? (
            <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
              <button className="ml-2 underline" onClick={onClearError}>
                Dismiss
              </button>
            </div>
          ) : null}

          {snapshot.status === "FINISHED" && snapshot.penaltyShootout ? (
            <PenaltyShootoutCard snapshot={snapshot} onError={onError} />
          ) : snapshot.status === "FINISHED" && snapshot.summary ? (
            <FullTime summary={snapshot.summary} snapshot={snapshot} />
          ) : snapshot.status === "DRAFT" ? (
            <PreMatch snapshot={snapshot} />
          ) : (
            <Stage snapshot={snapshot} onError={onError} />
          )}

          {isReferee && matchLive && <RefereeTools snapshot={snapshot} onError={onError} />}
          {!isReferee && matchLive && <CaptainTools snapshot={snapshot} onError={onError} />}
        </div>

        <aside className="space-y-4">
          {snapshot.viewer.isReferee && snapshot.status !== "FINISHED" ? (
            <RefereeQuickActions snapshot={snapshot} onError={onError} />
          ) : null}
          <LineupCard snapshot={snapshot} />
          <TimelineCard snapshot={snapshot} />
          {snapshot.status !== "DRAFT" && (
            <ChatBox matchId={snapshot.matchId} matchCode={snapshot.code} />
          )}
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------- header ---------------------------------- */

function MatchHeader({ snapshot, mode }: { snapshot: MatchSnapshot; mode: LiveMode }) {
  const live = snapshot.status === "LIVE";
  const liveTone = live ? "success" : snapshot.status === "FINISHED" ? "neutral" : "warning";
  const liveText = live ? "LIVE" : snapshot.status === "FINISHED" ? "FULL-TIME" : "PRE-MATCH";
  const label = roundLabel(snapshot);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={liveTone}>{liveText}</Badge>
          <span className="text-xs font-medium text-muted">Code {snapshot.code}</span>
          <LiveChip mode={mode} />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-subtle">Referee: {snapshot.refereeName}</p>
          <Link
            href={`/watch/${snapshot.code}`}
            className="text-xs font-medium text-gold underline-offset-2 hover:underline"
            title="Share this link so anyone can watch without an account"
          >
            Watch link ↗
          </Link>
          <ShareButton code={snapshot.code} />
        </div>
      </div>

      <div className="pitch-bg mt-4 overflow-hidden rounded-[1.5rem] border-2 border-fg shadow-[8px_8px_0_rgba(11,32,48,.2)]">
        <div className="flex items-center justify-center gap-3 px-3 py-5 sm:gap-6">
          <TeamName name={snapshot.homeName} team="HOME" align="right" />
          <div className="min-w-28 shrink-0 text-center">
            <div className="font-display text-5xl font-black tabular-nums tracking-tight text-white sm:text-7xl">
              {snapshot.homeScore}<span className="mx-1 text-white/40">–</span>{snapshot.awayScore}
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
          </div>
          <TeamName name={snapshot.awayName} team="AWAY" align="left" />
        </div>
      </div>
    </div>
  );
}

function LiveChip({ mode }: { mode: LiveMode }) {
  const text = mode === "pusher" ? "Live · Pusher" : mode === "ably" ? "Live · Ably" : "Syncing";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-subtle">
      <span aria-hidden className={cn("size-1.5 rounded-full", mode === "poll" ? "bg-subtle" : "bg-success animate-pulse")} />
      {text}
    </span>
  );
}

function TeamName({ name, team, align }: { name: string; team: TeamSide; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-col", align === "right" ? "items-end text-right" : "items-start")}>
      <span className="text-lg font-extrabold uppercase tracking-wide text-white sm:text-2xl">{name}</span>
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", team === "HOME" ? "text-teama" : "text-teamb")}>
        {team === "HOME" ? "Team A" : "Team B"}
      </span>
    </div>
  );
}

function roundLabel(s: MatchSnapshot): string {
  if (s.status === "DRAFT") return "Kick-off pending";
  if (s.status === "FINISHED") return "Full-time";
  if (s.round) return `Question ${s.round.number} / 10`;
  if (s.currentRound === 0) return "Question 1 / 10";
  return `Question ${Math.min(s.currentRound + 1, 10)} / 10`;
}

function ShareButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/watch/${code}` : `/watch/${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20"
    >
      {copied ? (
        <>
          <span aria-hidden>✓</span>
          Copied!
        </>
      ) : (
        <>
          <span aria-hidden>🔗</span>
          Share
        </>
      )}
    </button>
  );
}

/* ------------------------------ pre-match / prep ---------------------------- */

function PreMatch({ snapshot }: { snapshot: MatchSnapshot }) {
  const isReferee = snapshot.viewer.isReferee;
  return (
    <Card>
      <CardHeader
        title="Match setup"
        description={isReferee ? "Line-up and questions are set on the setup page, then kick-off." : "The referee is preparing this match before kick-off."}
        aside={<Badge tone="warning">Not started</Badge>}
      />
      <div className="p-4">
        {isReferee ? (
          <Link
            href={`/referee/matches/${snapshot.code}/setup`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-gold-ink transition-colors hover:bg-gold-strong"
          >
            Open setup
          </Link>
        ) : (
          <p className="text-sm text-muted">
            {snapshot.homeName} v {snapshot.awayName} will kick off once the referee finishes the ten questions.
          </p>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ the live stage ------------------------------ */

function Stage({ snapshot, onError }: { snapshot: MatchSnapshot; onError: (e: string | null) => void }) {
  const round = snapshot.round;
  const isReferee = snapshot.viewer.isReferee;
  const isCup = snapshot.competitionType === "CUP";
  const isDraw = snapshot.homeScore === snapshot.awayScore;

  if (!round) {
    // Between kick-off and the first question, or right after a reveal before the next open
    if (snapshot.currentRound >= 10) {
      return (
        <Card>
          <CardHeader title="All ten questions played" description="Time to blow the final whistle." />
          <div className="p-4">
            {isReferee ? (
              <div className="flex flex-wrap items-center gap-3">
                {isCup && isDraw && !snapshot.penaltyShootout ? (
                  <>
                    <Button variant="pitch" onClick={() => submit(startPenaltiesAction(snapshot.code), onError)}>
                      Penalties
                    </Button>
                    <EndMatchButton code={snapshot.code} onError={onError} />
                  </>
                ) : (
                  <EndMatchButton code={snapshot.code} onError={onError} />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {isCup && isDraw ? "Waiting for the referee to choose penalties or end the match." : "Waiting for the referee to end the match."}
              </p>
            )}
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader
          title={`Question ${snapshot.nextQuestionIndex ?? snapshot.currentRound + 1} of 10`}
          description="Waiting for the referee to put the question on the board."
        />
        <div className="flex flex-col items-center gap-3 p-8">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="size-4 text-gold" />
            The referee will open the next question shortly.
          </div>
          {isReferee && snapshot.nextQuestionIndex ? (
            <OpenNextButton code={snapshot.code} onError={onError} />
          ) : null}
        </div>
      </Card>
    );
  }

  if (round.status === "OPEN") return <OpenStage snapshot={snapshot} round={round} isReferee={isReferee} onError={onError} />;
  if (round.status === "LOCKED") return <LockedStage snapshot={snapshot} round={round} isReferee={isReferee} onError={onError} />;
  return <DecidedStage snapshot={snapshot} round={round} isReferee={isReferee} onError={onError} />;
}

function OpenStage({
  snapshot,
  round,
  isReferee,
  onError,
}: {
  snapshot: MatchSnapshot;
  round: RoundView;
  isReferee: boolean;
  onError: (e: string | null) => void;
}) {
  const my = snapshot.viewer.player;
  const canAnswer = !!my?.canSubmitNow;
  const didAnswer = !!my?.didAnswerThisRound;
  const onField = my?.role === "STARTER";

  return (
    <Card>
      <CardHeader
        title="Question on the board"
        aside={<QuestionTag round={round} />}
      />
      <div className="space-y-5 p-5">
        <CountdownPanel closesAt={round.closesAt} />

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">Question {round.number} / 10</p>
          <h2 className="mt-1 text-xl font-bold leading-snug text-fg sm:text-2xl">{round.questionText}</h2>
        </div>

        {my ? (
          onField ? (
            canAnswer ? (
              <AnswerForm code={snapshot.code} onError={onError} />
            ) : (
              <div className="rounded-lg border border-line bg-bg-raised px-4 py-3 text-sm">
                {didAnswer ? (
                  <p className="text-success">
                    Answer locked in — <span className="font-semibold">{my.myAnswerThisRound}</span>
                  </p>
                ) : (
                  <p className="text-muted">This question is no longer open for answers.</p>
                )}
              </div>
            )
          ) : (
            <div className="rounded-lg border border-line bg-bg-raised px-4 py-3 text-sm text-muted">
              {my.role === "SUB" ? "You are on the bench — only on-field players can answer." : "You have left the field and cannot answer."}
            </div>
          )
        ) : (
          <p className="text-sm text-muted">Players are submitting their answers — stay tuned.</p>
        )}

        {isReferee && <ForceLockButton code={snapshot.code} onError={onError} />}
      </div>
    </Card>
  );
}

function LockedStage({
  snapshot,
  round,
  isReferee,
  onError,
}: {
  snapshot: MatchSnapshot;
  round: RoundView;
  isReferee: boolean;
  onError: (e: string | null) => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const revealRows = round.answers;

  return (
    <Card>
      <CardHeader
        title="Answers are in"
        description={isReferee ? "The referee board — choose the answer that counts, or rule it out." : "Submissions are frozen. Whose answer will the referee accept?"}
        aside={<Badge tone="warning">⏳ Waiting for referee</Badge>}
      />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Question {round.number} / 10</p>
        <h2 className="mt-1 text-lg font-bold text-fg">{round.questionText}</h2>

        {isReferee ? (
          <p className="mt-3 text-xs text-muted">
            Reference answer: <span className="font-semibold text-fg">{round.correctAnswer}</span>
          </p>
        ) : null}

        {isReferee ? (
          <p className="mt-1 text-[11px] text-subtle">
            Answer normalisation is on: <span className="font-mono">newton ≈ NEWTON ≈ Newton</span>. You stay the final judge.
          </p>
        ) : null}

        {revealRows.length === 0 ? (
          <EmptyState
            className="mt-5"
            title="Nobody answered"
            description="The referee will rule on this question as a no goal."
          />
        ) : (
          <ul className="mt-4 space-y-1.5" role="list">
            {revealRows.map((a, i) => {
              const teamTone = a.team === "HOME" ? "teama" : "teamb";
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={!isReferee}
                    onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
                    aria-pressed={selectedId === a.id}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
                      selectedId === a.id
                        ? "border-gold bg-gold/15"
                        : "border-line bg-bg-raised",
                      isReferee && !a.visible && "cursor-pointer hover:border-gold/50",
                    )}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-xs font-semibold text-subtle">#{i + 1}</span>
                      <span className="truncate font-medium text-fg">{a.answer}</span>
                      {isReferee && normalizeAnswer(a.answer) !== a.answer.trim() ? (
                        <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] text-subtle" title="Normalised form used for matching">
                          ≈ {normalizeAnswer(a.answer)}
                        </span>
                      ) : null}
                    </span>
                    {a.visible && isReferee ? (
                      <span className={cn("flex shrink-0 items-center gap-2 text-xs text-muted", `text-${teamTone}`)}>
                        <span className="font-semibold">{a.playerName}</span>
                        <span>{formatSubTime(a.at)}</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {isReferee ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button
              variant="pitch"
              disabled={!selectedId}
              onClick={() =>
                submit(decideRoundAction({ code: snapshot.code, decision: "GOAL", submissionId: selectedId ?? undefined }), onError)
              }
            >
              ⚽ Award goal to selected
            </Button>
            <Button
              variant="danger"
              onClick={() => submit(decideRoundAction({ code: snapshot.code, decision: "NO_GOAL" }), onError)}
            >
              ❌ No goal
            </Button>
            {!selectedId && revealRows.length > 0 ? (
              <span className="text-xs text-subtle">Select an answer above to award a goal.</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function DecidedStage({
  snapshot,
  round,
  isReferee,
  onError,
}: {
  snapshot: MatchSnapshot;
  round: RoundView;
  isReferee: boolean;
  onError: (e: string | null) => void;
}) {
  const isGoal = round.decision === "GOAL";
  return (
    <Card>
      <div className="p-5">
        {isGoal && round.winnerName ? (
          <div className="animate-soe-pop rounded-lg border border-gold/40 bg-gold/15 p-6 text-center">
            <p className="text-4xl">⚽</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-wide text-gold-strong">GOAL!</h2>
            <p className="mt-1 text-xl font-bold text-fg">{round.winnerName}</p>
            <p className="text-sm text-muted">
              {round.winnerTeam === "HOME" ? snapshot.homeName : snapshot.awayName} · Answer:{" "}
              <span className="font-semibold text-fg">{round.winnerAnswer}</span>
            </p>
          </div>
        ) : (
          <div className="animate-soe-pop rounded-lg border border-danger/40 bg-danger/10 p-6 text-center">
            <p className="text-4xl">❌</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-wide text-danger">No goal</h2>
            <p className="mt-1 text-sm text-muted">
              Correct answer: <span className="font-semibold text-fg">{round.correctAnswer}</span>
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-subtle">Question {round.number} decided — recorded on the timeline.</p>
          {isReferee ? (
            <div className="flex items-center gap-2">
              {snapshot.currentRound < 10 ? (
                <OpenNextButton code={snapshot.code} onError={onError} />
              ) : (
                <EndMatchButton code={snapshot.code} onError={onError} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------- player + referee helpers ------------------------ */

function AnswerForm({ code, onError }: { code: string; onError: (e: string | null) => void }) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed || busy) return;
        setBusy(true);
        void submit(submitAnswerAction(code, trimmed), onError).finally(() => {
          setBusy(false);
          setValue("");
        });
      }}
    >
      <label htmlFor={`answer-${code}`} className="text-xs font-semibold uppercase tracking-wider text-muted">
        Your answer
      </label>
      <div className="flex gap-2">
        <input
          id={`answer-${code}`}
          autoFocus
          maxLength={240}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type your answer…"
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-bg-raised px-3 py-2.5 text-base text-fg placeholder:text-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
        <Button type="submit" disabled={!value.trim() || busy} loading={busy}>
          Submit
        </Button>
      </div>
      <p className="text-xs text-subtle">Once submitted, your answer is locked.</p>
    </form>
  );
}

function CountdownPanel({ closesAt }: { closesAt: string | null }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, []);

  const end = closesAt ? new Date(closesAt).getTime() : null;
  const remaining = end ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
  const seconds = remaining % 60;
  const minutes = Math.floor(remaining / 60);
  const urgent = remaining <= 5;

  return (
    <div className="flex items-center justify-center rounded-lg border border-line bg-bg-raised px-4 py-3">
      <div className={cn("text-center", urgent && "animate-pulse")}>
        <p className={cn("text-4xl font-black tabular-nums tracking-tight", urgent ? "text-danger" : "text-gold")}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Answer window</p>
      </div>
    </div>
  );
}

function QuestionTag({ round }: { round: RoundView }) {
  return <Badge tone="gold">Question {round.number} / 10</Badge>;
}

function OpenNextButton({ code, onError }: { code: string; onError: (e: string | null) => void }) {
  return (
    <Button variant="pitch" onClick={() => submit(openNextQuestionAction(code), onError)}>
      ▶ Open question {""}
    </Button>
  );
}

function ForceLockButton({ code, onError }: { code: string; onError: (e: string | null) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-bg-raised px-3 py-2">
      <span className="text-xs text-subtle">Countdown running — submissions close automatically at 00:00.</span>
      <Button variant="secondary" size="sm" onClick={() => submit(lockRevealAction(code, true), onError)}>
        Lock & reveal now
      </Button>
    </div>
  );
}

function EndMatchButton({ code, onError }: { code: string; onError: (e: string | null) => void }) {
  return (
    <Button variant="danger" onClick={() => submit(endMatchAction(code), onError)}>
      🏁 End match
    </Button>
  );
}

/* ------------------------------ referee tools ------------------------------ */

function RefereeQuickActions({ snapshot, onError }: { snapshot: MatchSnapshot; onError: (e: string | null) => void }) {
  const roundOpen = snapshot.round?.status === "OPEN";
  const roundLocked = snapshot.round?.status === "LOCKED";
  const ready = snapshot.status === "LIVE" && !snapshot.paused && !roundOpen && !roundLocked && snapshot.currentRound < 10;
  const decidedRounds = snapshot.currentRound;
  return (
    <Card>
      <CardHeader title="Referee control" description="Run the match from here." />
      <div className="flex flex-col gap-2 p-3">
        {snapshot.status === "LIVE" && snapshot.paused ? (
          <Button variant="pitch" onClick={() => submit(resumeMatchAction(snapshot.code), onError)}>
            ▶ Resume match
          </Button>
        ) : snapshot.status === "LIVE" && !snapshot.paused ? (
          <>
            {ready ? (
              <Button variant="pitch" onClick={() => submit(openNextQuestionAction(snapshot.code), onError)}>
                ▶ Open next question
              </Button>
            ) : roundOpen ? (
              <Button variant="secondary" onClick={() => submit(lockRevealAction(snapshot.code, true), onError)}>
                Lock & reveal now
              </Button>
            ) : null}
            {decidedRounds === 5 ? (
              <Button variant="secondary" onClick={() => submit(startHalftimeAction(snapshot.code), onError)}>
                ⏸ Start half-time
              </Button>
            ) : null}
            {!roundOpen && !roundLocked ? (
              <Button
                variant="ghost"
                onClick={() => {
                  const reason = window.prompt("Reason for pausing (optional):");
                  if (reason === null) return;
                  void submit(pauseMatchAction(snapshot.code, reason || undefined), onError);
                }}
              >
                Pause match
              </Button>
            ) : null}
          </>
        ) : null}
        {roundLocked ? (
          <p className="text-xs text-subtle">Decide on the current question in the main panel.</p>
        ) : null}
        {snapshot.status === "DRAFT" ? (
          <Link
            href={`/referee/matches/${snapshot.code}/setup`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-bg-raised"
          >
            Edit setup
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

function RefereeTools({ snapshot, onError }: { snapshot: MatchSnapshot; onError: (e: string | null) => void }) {
  const requests = snapshot.pendingRequests.filter((r) => r.status === "PENDING");
  return (
    <>
      <CaptainHandoffCard snapshot={snapshot} onError={onError} />
      <SubRequestsCard snapshot={snapshot} requests={requests} onError={onError} />
      <ConductCard snapshot={snapshot} onError={onError} />
    </>
  );
}

function SubRequestsCard({
  snapshot,
  requests,
  onError,
}: {
  snapshot: MatchSnapshot;
  requests: MatchSnapshot["pendingRequests"];
  onError: (e: string | null) => void;
}) {
  return (
    <Card>
      <CardHeader title="Substitution requests" description="Captains ask, the referee approves." aside={<Badge tone={requests.length ? "warning" : "neutral"}>{requests.length}</Badge>} />
      <div className="space-y-2 p-3">
        {requests.length === 0 ? (
          <p className="text-xs text-subtle">No pending requests.</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg-raised px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-fg">
                  {r.playerIn.name} <span className="text-success">IN</span> · {r.playerOut.name}{" "}
                  <span className="text-danger">OUT</span>
                </p>
                <p className="text-xs text-subtle">
                  {r.team === "HOME" ? snapshot.homeName : snapshot.awayName} · requested by {r.requestedBy.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="pitch" onClick={() => submit(decideSubstitutionAction({ code: snapshot.code, requestId: r.id, approve: true }), onError)}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => submit(decideSubstitutionAction({ code: snapshot.code, requestId: r.id, approve: false }), onError)}>
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function ConductCard({ snapshot, onError }: { snapshot: MatchSnapshot; onError: (e: string | null) => void }) {
  const [playerUserId, setPlayerUserId] = React.useState("");
  const [type, setType] = React.useState<IncidentType>("OTHER");
  const [action, setAction] = React.useState<IncidentAction>("WARNING");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <Card>
      <CardHeader title="Match conduct" description="Log warnings and cards against a player." />
      <form
        className="space-y-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!playerUserId || busy) return;
          setBusy(true);
          void submit(recordIncidentAction({ code: snapshot.code, playerUserId, type, action, note: note.trim() || undefined }), onError).finally(() => {
            setBusy(false);
            setNote("");
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Player
            <Select value={playerUserId} onChange={(e) => setPlayerUserId(e.target.value)} required>
              <option value="">Select player…</option>
              {snapshot.roster
                .filter((r) => r.role !== "OUT")
                .map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name} ({r.team === "HOME" ? snapshot.homeName : snapshot.awayName})
                  </option>
                ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Action
            <Select value={action} onChange={(e) => setAction(e.target.value as IncidentAction)}>
              {(Object.keys(INCIDENT_ACTIONS) as IncidentAction[]).map((a) => (
                <option key={a} value={a}>
                  {INCIDENT_ACTIONS[a]}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Reason
          <Select value={type} onChange={(e) => setType(e.target.value as IncidentType)}>
            {(Object.keys(INCIDENT_LABELS) as IncidentType[]).map((t) => (
              <option key={t} value={t}>
                {INCIDENT_LABELS[t]}
              </option>
            ))}
          </Select>
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          maxLength={200}
          className="w-full rounded-md border border-line-strong bg-bg-raised px-3 py-2 text-sm text-fg placeholder:text-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
        <Button type="submit" disabled={!playerUserId || busy} loading={busy} variant="secondary">
          Log incident
        </Button>
      </form>
    </Card>
  );
}

function CaptainHandoffCard({
  snapshot,
  onError,
  ownSideOnly = false,
}: {
  snapshot: MatchSnapshot;
  onError: (e: string | null) => void;
  ownSideOnly?: boolean;
}) {
  const my = snapshot.viewer.player;
  const isOfficial = snapshot.viewer.isReferee || snapshot.viewer.role === "ADMIN";
  if (!ownSideOnly && !isOfficial) return null;
  if (ownSideOnly && !my?.isCaptain) return null;

  const [teamSel, setTeamSel] = React.useState<"HOME" | "AWAY">(my?.team ?? "HOME");
  const [toId, setToId] = React.useState("");

  const teamStarters = snapshot.roster.filter((r) => r.team === teamSel && r.role === "STARTER");
  const captain = teamStarters.find((r) => r.isCaptain);
  const targets = teamStarters.filter((r) => !r.isCaptain);
  const openRound = snapshot.round?.status === "OPEN" || snapshot.round?.status === "LOCKED";

  return (
    <Card>
      <CardHeader
        title="Pass the captain's armband"
        description={
          captain
            ? `${captain.name} is captain — choose an active player to take over.`
            : "No captain is set for this side yet."
        }
      />
      <div className="space-y-3 p-3">
        {isOfficial ? (
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Team
            <Select
              value={teamSel}
              onChange={(e) => {
                setTeamSel(e.target.value as "HOME" | "AWAY");
                setToId("");
              }}
            >
              <option value="HOME">{snapshot.homeName}</option>
              <option value="AWAY">{snapshot.awayName}</option>
            </Select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
          New captain (active starters)
          <Select value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Choose a starter…</option>
            {targets.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="secondary"
          disabled={!toId || targets.length === 0 || openRound}
          title={openRound ? "Wait for the current question to finish." : "Pass the armband"}
          onClick={() => void submit(transferCaptaincyAction({ code: snapshot.code, toUserId: toId }), onError)}
        >
          Transfer captaincy
        </Button>
      </div>
    </Card>
  );
}

function CaptainTools({ snapshot, onError }: { snapshot: MatchSnapshot; onError: (e: string | null) => void }) {
  const my = snapshot.viewer.player;
  const [outId, setOutId] = React.useState("");
  const [inId, setInId] = React.useState("");
  const openRound = snapshot.round?.status === "OPEN" || snapshot.round?.status === "LOCKED";

  if (!my?.isCaptain || openRound) return null;

  const teamRoster = snapshot.roster.filter((r) => r.team === my.team);
  const starters = teamRoster.filter((r) => r.role === "STARTER");
  const bench = teamRoster.filter((r) => r.role === "SUB");

  return (
    <>
      <CaptainHandoffCard snapshot={snapshot} onError={onError} ownSideOnly />
      <Card>
      <CardHeader title="Substitution request" description="Bring a bench player on for an active player — the referee approves." />
      <form
        className="space-y-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!outId || !inId) return;
          void submit(requestSubstitutionAction({ code: snapshot.code, playerOutUserId: outId, playerInUserId: inId }), onError);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Player out
            <Select value={outId} onChange={(e) => setOutId(e.target.value)}>
              <option value="">Pick an active player…</option>
              {starters.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Player in (bench)
            <Select value={inId} onChange={(e) => setInId(e.target.value)}>
              <option value="">Pick a bench player…</option>
              {bench.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <Button type="submit" variant="teamA" disabled={!outId || !inId || bench.length === 0}>
          Request substitution
        </Button>
      </form>
    </Card>
    </>
  );
}

/* ------------------------------ line-up & timeline --------------------------- */

function LineupCard({ snapshot }: { snapshot: MatchSnapshot }) {
  const home = snapshot.roster.filter((r) => r.team === "HOME");
  const away = snapshot.roster.filter((r) => r.team === "AWAY");
  return (
    <Card>
      <CardHeader title="Teams" description={`${home.length} v ${away.length} on the roster`} />
      <div className="grid grid-cols-2 gap-4 p-4">
        <LineupColumn name={snapshot.homeName} color="teama" slots={home} />
        <LineupColumn name={snapshot.awayName} color="teamb" slots={away} />
      </div>
    </Card>
  );
}

function LineupColumn({
  name,
  color,
  slots,
}: {
  name: string;
  color: "teama" | "teamb";
  slots: MatchSnapshot["roster"];
}) {
  const sorted = [...slots].sort((a, b) => a.number - b.number);
  const colorClass = color === "teama" ? "text-teama" : "text-teamb";
  return (
    <div>
      <p className={cn("truncate text-xs font-bold uppercase tracking-wider", colorClass)}>{name}</p>
      <ul className="mt-2 space-y-1">
        {sorted.map((p) => (
          <li key={p.userId} className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-sm", p.role === "STARTER" ? "bg-bg-raised" : "opacity-70")}>
            <span className="w-5 text-right text-xs font-bold tabular-nums text-subtle">{p.number}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{p.name}</span>
            {p.isCaptain ? <span aria-label="captain" className="text-xs text-gold">C</span> : null}
            <RoleDot role={p.role} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleDot({ role }: { role: "STARTER" | "SUB" | "OUT" }) {
  const cls = role === "STARTER" ? "bg-success" : role === "SUB" ? "bg-warning" : "bg-danger";
  return <span aria-label={role} title={role} className={cn("size-1.5 rounded-full", cls)} />;
}

function TimelineCard({ snapshot }: { snapshot: MatchSnapshot }) {
  return (
    <Card>
      <CardHeader title="Timeline" description="Everything that happened, in order." />
      <ol className="max-h-96 space-y-0 overflow-y-auto p-3">
        {snapshot.timeline.length === 0 ? (
          <li className="text-xs text-subtle">The timeline begins at kick-off.</li>
        ) : (
          snapshot.timeline.map((t) => <TimelineRow key={t.id} t={t} />)
        )}
      </ol>
    </Card>
  );
}

function TimelineRow({ t }: { t: TimelineItemView }) {
  const clock = t.elapsedSec == null ? "--:--" : fmtClock(t.elapsedSec);
  const icon =
    t.type === "GOAL" ? "⚽" : t.type === "NO_GOAL" ? "❌" : t.type === "KICKOFF" ? "🏟️" : t.type === "FULL_TIME" ? "🏁" : t.type === "CARD" ? "🟨" : t.type === "SUBSTITUTION" ? "🔄" : t.type === "QUESTION_OPEN" ? "❓" : t.type === "PENALTY_SCORED" ? "⚽" : t.type === "PENALTY_MISS" ? "❌" : t.type === "PENALTY_SAVED" ? "🧤" : t.type === "PENALTY_SHOOTOUT_START" ? "🎯" : t.type === "PENALTY_SHOOTOUT_END" ? "🏆" : "🔒";
  return (
    <li className="flex items-start gap-3 py-1.5 text-sm">
      <span className="w-14 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-subtle">{clock}</span>
      <span aria-hidden className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium leading-snug text-fg">{t.label}</p>
        {t.detail ? <p className="text-xs text-muted">{t.detail}</p> : null}
      </div>
    </li>
  );
}

/* -------------------------------- full time -------------------------------- */

function PenaltyShootoutCard({ snapshot, onError }: { snapshot: MatchSnapshot; onError: (e: string | null) => void }) {
  const ps = snapshot.penaltyShootout;
  if (!ps) return null;
  const isReferee = snapshot.viewer.isReferee;
  const isComplete = ps.status === "COMPLETE";

  return (
    <Card>
      <div className="pitch-bg p-6 text-center">
        <p className="text-2xl font-black uppercase tracking-widest text-white">Penalty Shootout</p>
        <div className="mt-3 flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">{snapshot.homeName}</p>
            <p className="text-5xl font-black tabular-nums text-white">{ps.teamAScore}</p>
          </div>
          <span className="text-3xl font-bold text-white/50">–</span>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">{snapshot.awayName}</p>
            <p className="text-5xl font-black tabular-nums text-white">{ps.teamBScore}</p>
          </div>
        </div>
        {isComplete && ps.winner ? (
          <p className="mt-3 text-lg font-bold text-gold">
            {ps.winner === "HOME" ? snapshot.homeName : snapshot.awayName} wins!
          </p>
        ) : (
          <p className="mt-2 text-xs text-white/70">
            {isComplete ? "Shootout complete" : "Shootout in progress"}
          </p>
        )}
      </div>

      <div className="p-5">
        <PenaltyKicksList kicks={ps.kicks} homeName={snapshot.homeName} awayName={snapshot.awayName} />

        {!isComplete && isReferee && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <p className="text-xs text-subtle mr-2">
              Next kick: {ps.currentKickTeam === "HOME" ? snapshot.homeName : snapshot.awayName}
            </p>
            <Button
              variant="pitch"
              onClick={() => submit(takePenaltyKickAction(snapshot.code, true), onError)}
            >
              Scored
            </Button>
            <Button
              variant="danger"
              onClick={() => submit(takePenaltyKickAction(snapshot.code, false), onError)}
            >
              Missed
            </Button>
          </div>
        )}

        {isComplete && (
          <div className="mt-5 border-t border-line pt-4">
            <EndMatchButton code={snapshot.code} onError={onError} />
          </div>
        )}
      </div>
    </Card>
  );
}

function PenaltyKicksList({
  kicks,
  homeName,
  awayName,
}: {
  kicks: PenaltyShootoutView["kicks"];
  homeName: string;
  awayName: string;
}) {
  // Group kicks into pairs (A, B)
  const pairs: { home: (typeof kicks)[number] | null; away: (typeof kicks)[number] | null }[] = [];
  for (let i = 0; i < kicks.length; i += 2) {
    pairs.push({
      home: kicks[i]?.team === "HOME" ? kicks[i] : null,
      away: kicks[i + 1]?.team === "AWAY" ? kicks[i + 1] : null,
    });
  }

  const maxRounds = Math.max(5, pairs.length);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted mb-2">
        <span className="w-20 text-right">{homeName}</span>
        <span className="flex-1 text-center">Kicks</span>
        <span className="w-20 text-left">{awayName}</span>
      </div>
      {Array.from({ length: maxRounds }, (_, i) => {
        const pair = pairs[i];
        const homeKick = pair?.home ?? null;
        const awayKick = pair?.away ?? null;
        const kickNum = i + 1;
        const isActive = !pair || (!homeKick && !awayKick);
        const isCurrentPair = isActive && i === pairs.length;

        return (
          <div
            key={kickNum}
            className={cn(
              "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
              isCurrentPair && "bg-gold/10 border border-gold/30",
            )}
          >
            <div className="w-20 flex justify-end">
              {homeKick ? (
                <span className={cn("font-semibold", homeKick.scored ? "text-success" : "text-danger")}>
                  {homeKick.scored ? "✓" : "✗"}
                </span>
              ) : null}
            </div>
            <span className={cn("w-8 text-center text-xs font-bold", isCurrentPair ? "text-gold" : "text-subtle")}>
              {kickNum}
            </span>
            <div className="w-20 text-left">
              {awayKick ? (
                <span className={cn("font-semibold", awayKick.scored ? "text-success" : "text-danger")}>
                  {awayKick.scored ? "✓" : "✗"}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FullTime({ summary, snapshot }: { summary: NonNullable<MatchSnapshot["summary"]>; snapshot: MatchSnapshot }) {
  return (
    <>
    <Card>
      <div className="pitch-bg p-6 text-center">
        <p className="text-2xl font-black uppercase tracking-widest text-white">Full-time</p>
        <p className="mt-1 text-4xl font-black tabular-nums text-white sm:text-6xl">
          {summary.finalHome} {summary.homeScore} – {summary.awayScore} {summary.finalAway}
        </p>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gold">Goal scorers</h3>
          {summary.scorers.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {summary.scorers.map((s) => (
                <li key={s.name} className="flex justify-between border-b border-line/60 py-1.5">
                  <span className="font-medium text-fg">{s.name}</span>
                  <span className="text-muted">
                    {s.goals} goal{s.goals === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-subtle">No goals — a goalless draw.</p>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gold">Match facts</h3>
            <dl className="mt-2 space-y-1 text-sm">
              <Fact label="Questions played" value={summary.questionsPlayed} />
              <Fact label="No-goal questions" value={summary.noGoalQuestions} />
              <Fact label="Substitutions" value={summary.substitutions.length} />
              <Fact label="Cards shown" value={summary.cards.length} />
            </dl>
          </div>

          {summary.cards.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-danger">Cards</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {summary.cards.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span aria-hidden>{c.action === "RED_CARD" ? "🟥" : "🟨"}</span>
                    <span className="font-medium text-fg">{c.name}</span>
                    <span className="text-xs text-subtle">{c.action === "RED_CARD" ? "Red" : "Yellow"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.substitutions.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gold">Substitutions</h3>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {summary.substitutions.map((s, i) => (
                  <li key={i}>
                    {s.playerIn} <span className="text-success">IN</span> · {s.playerOut}{" "}
                    <span className="text-danger">OUT</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <div className="border-t border-line p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gold">Match timeline</h3>
        <ol className="mt-3 max-h-80 space-y-0 overflow-y-auto">
          {summary.timeline.map((t) => <TimelineRow key={t.id} t={t} />)}
        </ol>
      </div>
    </Card>
    <PotmVote matchId={snapshot.matchId} snapshot={snapshot} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between border-b border-line/60 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}

/* --------------------------------- helpers --------------------------------- */

async function submit(res: Promise<{ ok: boolean; error?: string }>, onError: (e: string | null) => void) {
  const r = await res;
  if (!r.ok) onError(r.error ?? "Action failed.");
}

function formatSubTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
