"use client";

import * as React from "react";
import { votePotmAction, getPotmResultsAction } from "@/app/actions/potm";
import { Badge, Button, Card, CardHeader, Spinner, cn } from "@/components/ui";
import type { MatchSnapshot } from "@/lib/domain";

export function PotmVote({
  matchId,
  snapshot,
}: {
  matchId: string;
  snapshot: MatchSnapshot;
}) {
  const starters = snapshot.roster.filter((r) => r.role === "STARTER");
  const [votedFor, setVotedFor] = React.useState<string | null>(snapshot.potm.votedFor);
  const [results, setResults] = React.useState(snapshot.potm.results);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasVoted = !!votedFor;
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  const handleVote = async (playerId: string) => {
    if (busy || hasVoted) return;
    setBusy(true);
    setError(null);
    const res = await votePotmAction(matchId, playerId);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setVotedFor(playerId);
    const updated = await getPotmResultsAction(matchId);
    if (updated.ok) setResults(updated.data);
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader
        title="Player of the Match"
        description={hasVoted ? "Thanks for voting!" : "Cast your vote for the best performer."}
        aside={
          totalVotes > 0 ? (
            <Badge tone="gold">{totalVotes} vote{totalVotes === 1 ? "" : "s"}</Badge>
          ) : undefined
        }
      />
      <div className="p-4">
        {error && (
          <p className="mb-3 text-xs text-danger">{error}</p>
        )}

        {results.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {results.map((r, i) => {
              const isWinner = i === 0 && r.votes > 0;
              const pct = totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0;
              return (
                <div
                  key={r.playerId}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                    isWinner
                      ? "border-gold/50 bg-gold/10"
                      : votedFor === r.playerId
                        ? "border-brand/40 bg-brand/5"
                        : "border-line bg-bg-raised",
                  )}
                >
                  {isWinner && <span className="text-xs">🏆</span>}
                  <span className="min-w-0 flex-1 font-medium text-fg">{r.playerName}</span>
                  <span className="shrink-0 text-xs text-muted">{r.votes} vote{r.votes === 1 ? "" : "s"}</span>
                  <div className="hidden w-16 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className={cn("h-full rounded-full", isWinner ? "bg-gold" : "bg-brand/60")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {starters.length === 0 ? (
          <p className="text-sm text-muted">No players available for voting.</p>
        ) : hasVoted ? (
          <p className="text-sm text-muted">Your vote has been recorded.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {starters.map((p) => (
              <button
                key={p.userId}
                type="button"
                disabled={busy}
                onClick={() => handleVote(p.userId)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-line bg-bg-raised px-3 py-2 text-left text-sm transition-colors hover:border-brand/40 hover:bg-bg-elevated disabled:opacity-50",
                )}
              >
                {busy && <Spinner className="size-3" />}
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{p.name}</span>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", p.team === "HOME" ? "text-teama" : "text-teamb")}>
                  {p.team === "HOME" ? "A" : "B"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
