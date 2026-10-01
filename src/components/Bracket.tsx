import Link from "next/link";

/**
 * The knockout bracket.
 *
 * A "tie" is one node of the bracket: either a single match, or two legs that
 * add up to an aggregate. Round positions come from a bottom-up pass — each
 * tie's vertical centre is the mean of the two ties that fed into it — so the
 * columns line up like a real bracket even when a top seed took a bye.
 */

export type BracketMatch = {
  id: string;
  code: string;
  homeName: string;
  awayName: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  status: string;
  scheduledAt: Date | null;
  cupRound: number | null;
  cupTie: string | null;
  cupLeg: number | null;
  cupThirdPlace: boolean;
  penaltyShootout?: { status: string; winner: string | null } | null;
};

type Tie = {
  key: string;
  round: number;
  legs: BracketMatch[];
  twoLegged: boolean;
  aName: string;
  bName: string;
  aId: string | null;
  bId: string | null;
  aggA: number;
  aggB: number;
  played: number;
  allDone: boolean;
  /** "a" = the team listed first (leg one's home side). */
  winner: "a" | "b" | null;
  wonOnPens: boolean;
  live: boolean;
  kickoff: Date | null;
};

const CARD_W = 200;
const COL_W = 236;
const HEADER = 34;

/** Round 1 of 16 teams → "Round of 16"; the last round with one tie → "Final". */
function roundLabel(matchCount: number, roundNo: number, isLast: boolean): string {
  if (isLast && matchCount === 1) return "🏆 Final";
  const byTeams: Record<number, string> = {
    2: "Final",
    4: "Semi-finals",
    8: "Quarter-finals",
    16: "Round of 16",
    32: "Round of 32",
    64: "Round of 64",
  };
  const name = byTeams[matchCount * 2];
  return name ?? `Round ${roundNo}`;
}

function abbr(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "—";
}

function buildTies(matches: BracketMatch[]): Tie[] {
  const groups = new Map<string, BracketMatch[]>();
  for (const m of matches) {
    const key = `${m.cupRound ?? 0}::${m.cupTie ?? m.id}`;
    const g = groups.get(key);
    if (g) g.push(m);
    else groups.set(key, [m]);
  }

  return [...groups.entries()].map(([key, legs]) => {
    const first = legs[0];
    const aId = first.homeTeamId;
    const bId = first.awayTeamId;
    const aName = first.homeName;
    const bName = first.awayName;

    let aggA = 0;
    let aggB = 0;
    let played = 0;
    let live = false;
    for (const leg of legs) {
      if (leg.status === "LIVE") live = true;
      if (leg.status !== "FINISHED") continue;
      played++;
      const aIsHome = leg.homeTeamId === aId;
      aggA += aIsHome ? leg.homeScore : leg.awayScore;
      aggB += aIsHome ? leg.awayScore : leg.homeScore;
    }

    const allDone = played === legs.length && legs.length > 0;
    let winner: "a" | "b" | null = null;
    let wonOnPens = false;
    if (allDone) {
      if (aggA !== aggB) {
        winner = aggA > aggB ? "a" : "b";
      } else {
        // Level on aggregate: no away-goals rule, so the shootout on the
        // deciding (second) leg settles it — the same rule the engine applies.
        const decider = legs[legs.length - 1];
        const so = decider.penaltyShootout;
        if (so && so.status === "COMPLETE" && so.winner) {
          const deciderA = decider.homeTeamId === aId;
          const aWonShootout = so.winner === "HOME" ? deciderA : !deciderA;
          winner = aWonShootout ? "a" : "b";
          wonOnPens = true;
        }
      }
    }

    return {
      key,
      round: first.cupRound ?? 0,
      legs,
      twoLegged: legs.length > 1,
      aName,
      bName,
      aId,
      bId,
      aggA,
      aggB,
      played,
      allDone,
      winner,
      wonOnPens,
      live,
      kickoff: legs[0].scheduledAt,
    };
  });
}

function TeamRow({
  name,
  score,
  isWinner,
  bold,
}: {
  name: string;
  score: number | null;
  isWinner: boolean;
  bold: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-[3px]">
      <span
        className={
          "min-w-0 truncate text-[11px] " +
          (isWinner ? "font-black text-fg" : bold ? "font-semibold text-fg" : "font-medium text-muted")
        }
      >
        {isWinner ? <span aria-hidden className="mr-1 text-brand">▸</span> : null}
        {name}
      </span>
      <span
        className={
          "shrink-0 tabular-nums " +
          (score === null
            ? "text-[11px] text-subtle"
            : isWinner
              ? "text-[13px] font-black text-fg"
              : "text-[12px] font-bold text-muted")
        }
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function TieCard({ tie }: { tie: Tie }) {
  const label = tie.legs[0].code;
  const showAggregate = tie.twoLegged;

  const footer = tie.twoLegged
    ? tie.legs
        .map((l) => `L${l.cupLeg ?? 1} ${abbr(l.homeName)} ${l.homeScore}–${l.awayScore}`)
        .join("  ·  ")
    : null;

  return (
    <Link
      href={`/match/${label}`}
      className="block overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-colors hover:border-brand/50"
      style={{
        borderColor: tie.winner ? "var(--color-brand, #0b6b5b)" : undefined,
        // min-height rather than a hard height: the penalties line is a whole
        // extra row, and clipping it would hide how the tie was settled.
        minHeight: tie.twoLegged ? 108 : 78,
      }}
    >
      <div className="flex items-center justify-between gap-1 border-b border-line bg-bg-elevated px-2.5 py-1">
        <span className="truncate text-[9px] font-black uppercase tracking-wider text-subtle">
          {tie.live ? "Live" : showAggregate ? "Aggregate" : tie.allDone ? "Full time" : "Kick-off"}
        </span>
        <span className="shrink-0 text-[9px] font-bold text-subtle">
          {tie.live ? (
            <span aria-hidden className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-danger align-middle" />
          ) : null}
          {tie.allDone && showAggregate ? `${tie.aggA}–${tie.aggB}` : ""}
          {!tie.allDone && tie.kickoff
            ? tie.kickoff.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : ""}
        </span>
      </div>

      <div className="py-1">
        <TeamRow
          name={tie.aName}
          score={showAggregate ? tie.aggA : tie.legs[0].status === "FINISHED" ? legScore(tie.legs[0], tie.aId) : null}
          isWinner={tie.winner === "a"}
          bold={tie.twoLegged}
        />
        <TeamRow
          name={tie.bName}
          score={showAggregate ? tie.aggB : tie.legs[0].status === "FINISHED" ? legScore(tie.legs[0], tie.bId) : null}
          isWinner={tie.winner === "b"}
          bold={tie.twoLegged}
        />
      </div>

      {footer ? (
        <p className="truncate border-t border-line px-2.5 py-1 text-[9px] font-semibold tracking-tight text-subtle">
          {footer}
        </p>
      ) : null}
      {tie.wonOnPens ? (
        <p className="truncate border-t border-line bg-brand/5 px-2.5 py-1 text-[9px] font-black text-brand">
          Decided on penalties
        </p>
      ) : null}
    </Link>
  );
}

function legScore(leg: BracketMatch, teamId: string | null): number {
  return leg.homeTeamId === teamId ? leg.homeScore : leg.awayScore;
}

export function Bracket({
  matches,
  entrants,
}: {
  matches: BracketMatch[];
  entrants: string[];
}) {
  const bracketMatches = matches.filter((m) => !m.cupThirdPlace);
  const thirdPlaceMatch = matches.find((m) => m.cupThirdPlace) ?? null;

  if (bracketMatches.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-8 text-center text-sm text-muted">
        The bracket will appear here once the first round is generated.
        {entrants.length ? (
          <p className="mt-3 text-xs text-subtle">Entrants: {entrants.join(", ")}</p>
        ) : null}
      </div>
    );
  }

  const ties = buildTies(bracketMatches);

  // One column per round, ties in bracket order within it.
  const roundNos = [...new Set(ties.map((t) => t.round))].sort((a, b) => a - b);
  const columns: Tie[][] = roundNos.map((r) => ties.filter((t) => t.round === r));
  const twoLegged = ties.some((t) => t.twoLegged);

  // A tie settled on penalties prints an extra row — size the slots for it so
  // nothing collides with the tie above or below.
  const pensRow = ties.some((t) => t.wonOnPens) ? 20 : 0;
  const CARD_H = (twoLegged ? 108 : 78) + pensRow;
  const SLOT = CARD_H + 26;

  // Bottom-up: round 1 stacks at one slot per tie, each later round sits at the
  // mean of the ties feeding it. A bye shows up as a single feeder and still
  // lands where it should.
  const centers: number[][] = [];
  centers[0] = columns[0].map((_, i) => i * SLOT + SLOT / 2);
  for (let r = 1; r < columns.length; r++) {
    const prev = columns[r - 1];
    const computed = columns[r].map((tie, i) => {
      const feeds = prev
        .map((p, pi) => ((p.aId && p.aId === tie.aId) || (p.aId && p.aId === tie.bId) ||
              (p.bId && p.bId === tie.aId) || (p.bId && p.bId === tie.bId) ? pi : -1))
        .filter((pi) => pi >= 0);
      if (feeds.length > 0) {
        return feeds.reduce((sum, pi) => sum + centers[r - 1][pi], 0) / feeds.length;
      }
      const last = centers[r - 1][centers[r - 1].length - 1] ?? 0;
      return last + SLOT * (i + 1);
    });
    for (let i = 1; i < computed.length; i++) {
      if (computed[i] - computed[i - 1] < SLOT) computed[i] = computed[i - 1] + SLOT;
    }
    centers[r] = computed;
  }

  const maxCenter = Math.max(...centers.flat());
  const height = HEADER + maxCenter + CARD_H / 2 + 18;
  const width = Math.max(columns.length, 1) * COL_W;

  // Connectors between consecutive rounds.
  const connectors: { key: string; left: number; top: number; w: number; h: number }[] = [];
  for (let r = 1; r < columns.length; r++) {
    const midX = (r - 1) * COL_W + CARD_W + (COL_W - CARD_W) / 2;
    columns[r].forEach((tie, i) => {
      const destTop = HEADER + centers[r][i];
      const prev = columns[r - 1];
      const feeds = prev
        .map((p, pi) => ((p.aId && p.aId === tie.aId) || (p.aId && p.aId === tie.bId) ||
              (p.bId && p.bId === tie.aId) || (p.bId && p.bId === tie.bId) ? pi : -1))
        .filter((pi) => pi >= 0);
      if (feeds.length === 0) return;

      const feederTops = feeds.map((pi) => HEADER + centers[r - 1][pi]);
      for (const ft of feederTops) {
        connectors.push({
          key: `h-${r}-${i}-${ft}`,
          left: (r - 1) * COL_W + CARD_W,
          top: ft - 1,
          w: midX - ((r - 1) * COL_W + CARD_W),
          h: 2,
        });
      }
      if (feeds.length > 1) {
        const lo = Math.min(...feederTops);
        const hi = Math.max(...feederTops);
        connectors.push({ key: `v-${r}-${i}`, left: midX - 1, top: lo, w: 2, h: hi - lo });
      }
      connectors.push({
        key: `out-${r}-${i}`,
        left: midX,
        top: destTop - 1,
        w: r * COL_W - midX,
        h: 2,
      });
    });
  }

  // Champion, when the last round is a decided single tie.
  const lastIdx = columns.length - 1;
  const lastCol = columns[lastIdx];
  const champion =
    lastCol.length === 1 && lastCol[0].winner
      ? lastCol[0].winner === "a"
        ? lastCol[0].aName
        : lastCol[0].bName
      : null;

  return (
    <div className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-fg">Bracket</h2>
        <p className="text-xs text-subtle">
          {twoLegged ? "Two legs per tie · aggregate, no away goals · final is one match" : "Single elimination"}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="relative" style={{ width, height }}>
          {connectors.map((c) => (
            <span
              key={c.key}
              aria-hidden
              className="absolute bg-line"
              style={{ left: c.left, top: c.top, width: c.w, height: c.h }}
            />
          ))}

          {columns.map((col, r) => (
            <div key={roundNos[r]}>
              <p
                className="absolute text-[10px] font-black uppercase tracking-widest text-brand"
                style={{ left: r * COL_W, top: 0, width: CARD_W }}
              >
                {roundLabel(col.length, roundNos[r], r === lastIdx)}
              </p>
              {col.map((tie, i) => (
                <div
                  key={tie.key}
                  className="absolute"
                  style={{ left: r * COL_W, top: HEADER + centers[r][i] - CARD_H / 2, width: CARD_W }}
                >
                  <TieCard tie={tie} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {champion ? (
        <p className="mt-4 rounded-xl border-2 border-brand/40 bg-brand/5 px-4 py-3 text-center text-sm">
          <span className="text-xs font-black uppercase tracking-widest text-subtle">Champion</span>
          <span className="mt-0.5 block text-base font-black text-fg">🏆 {champion}</span>
        </p>
      ) : null}

      {thirdPlaceMatch ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-subtle">Third place</p>
          <div className="max-w-[260px]">
            <TieCard
              tie={{
                key: "third",
                round: thirdPlaceMatch.cupRound ?? 0,
                legs: [thirdPlaceMatch],
                twoLegged: false,
                aName: thirdPlaceMatch.homeName,
                bName: thirdPlaceMatch.awayName,
                aId: thirdPlaceMatch.homeTeamId,
                bId: thirdPlaceMatch.awayTeamId,
                aggA: 0,
                aggB: 0,
                played: 0,
                allDone: thirdPlaceMatch.status === "FINISHED",
                winner:
                  thirdPlaceMatch.status === "FINISHED"
                    ? thirdPlaceMatch.homeScore > thirdPlaceMatch.awayScore
                      ? "a"
                      : thirdPlaceMatch.homeScore < thirdPlaceMatch.awayScore
                        ? "b"
                        : thirdPlaceMatch.penaltyShootout?.winner === "HOME"
                          ? "a"
                          : thirdPlaceMatch.penaltyShootout?.winner === "AWAY"
                            ? "b"
                            : null
                    : null,
                wonOnPens:
                  thirdPlaceMatch.status === "FINISHED" &&
                  thirdPlaceMatch.homeScore === thirdPlaceMatch.awayScore &&
                  !!thirdPlaceMatch.penaltyShootout?.winner,
                live: thirdPlaceMatch.status === "LIVE",
                kickoff: thirdPlaceMatch.scheduledAt,
              }}
            />
          </div>
        </div>
      ) : null}

      {entrants.length ? (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-xs text-muted">Entrants: {entrants.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}
