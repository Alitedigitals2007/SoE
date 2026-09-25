import { prisma } from "@/lib/prisma";
import { allOdds, expectedGoals } from "@/lib/bet/odds";
import { MATCH_ROUNDS } from "@/lib/domain";
import { poisson, price } from "@/lib/bet/pricing";

export type LiveOdds = {
  matchId: string;
  code: string;
  /** PRE = before kick-off, IN_PLAY = while questions are being answered, FINAL = settled. */
  phase: "PRE" | "IN_PLAY" | "FINAL";
  home: number;
  draw: number;
  away: number;
  over25: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
};

/** How many extra goals each side can still score, in expected terms. */
function remainingGoalProbs(
  xg: number,
  share: number,
  max: number,
): number[] {
  const lambda = Math.max(0, xg * share);
  const p: number[] = [];
  for (let k = 0; k <= max; k++) p.push(poisson(k, lambda));
  return p;
}

/**
 * In-play prices: the pre-match expected-goals model scaled by the share of
 * questions still to come, then added on top of the score already on the board.
 */
export function inPlayPrices(
  xgHome: number,
  xgAway: number,
  decided: number,
  observed: { home: number; away: number },
): Pick<LiveOdds, "home" | "draw" | "away" | "over25" | "under25" | "bttsYes" | "bttsNo"> {
  const share = Math.max(0, MATCH_ROUNDS - decided) / MATCH_ROUNDS;
  const ph = remainingGoalProbs(xgHome, share, 8);
  const pa = remainingGoalProbs(xgAway, share, 8);

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver = 0;
  let pBtts = 0;
  for (let h = 0; h < ph.length; h++) {
    for (let a = 0; a < pa.length; a++) {
      const p = ph[h] * pa[a];
      if (!p) continue;
      const home = observed.home + h;
      const away = observed.away + a;
      if (home > away) pHome += p;
      else if (home < away) pAway += p;
      else pDraw += p;
      if (home + away > 2.5) pOver += p;
      if (home >= 1 && away >= 1) pBtts += p;
    }
  }

  return {
    home: price(pHome),
    draw: price(pDraw),
    away: price(pAway),
    over25: price(pOver),
    under25: price(1 - pOver),
    bttsYes: price(pBtts),
    bttsNo: price(1 - pBtts),
  };
}

/**
 * Odds snapshot for display: pre-match prices straight from the standings
 * model, in-play prices while the match runs, settled prices afterwards.
 * Nothing here accepts a bet — betting closes at kick-off.
 */
export async function liveOddsFor(matchIds: string[]): Promise<LiveOdds[]> {
  const ids = [...new Set(matchIds)].filter(Boolean);
  if (ids.length === 0) return [];

  const rows = await prisma.match.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      status: true,
      homeScore: true,
      awayScore: true,
      currentRound: true,
      homeTeamId: true,
      awayTeamId: true,
      competitionId: true,
    },
  });

  const odds = await Promise.all(
    rows.map(async (m): Promise<LiveOdds> => {
      const base = { matchId: m.id, code: m.code };
      if (m.status === "DRAFT") {
        const all = await allOdds(m);
        const line25 = all.goals.lines.find((l) => l.line === 2.5);
        return {
          ...base,
          phase: "PRE",
          home: all.match.home,
          draw: all.match.draw,
          away: all.match.away,
          over25: line25?.over ?? all.goals.lines[all.goals.lines.length - 1].over,
          under25: line25?.under ?? all.goals.lines[all.goals.lines.length - 1].under,
          bttsYes: all.goals.btts.yes,
          bttsNo: all.goals.btts.no,
        };
      }

      const { xgHome, xgAway } = await expectedGoals(m);
      const prices = inPlayPrices(xgHome, xgAway, m.currentRound, {
        home: m.homeScore,
        away: m.awayScore,
      });
      return {
        ...base,
        phase: m.status === "FINISHED" ? "FINAL" : "IN_PLAY",
        ...prices,
      };
    }),
  );

  // Keep the caller's order (handy for rendering a fixed list).
  const byId = new Map(odds.map((o) => [o.matchId, o]));
  return ids.map((id) => byId.get(id)).filter((o): o is LiveOdds => !!o);
}
