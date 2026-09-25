"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimDailyAction, placeAccaAction, placeBetAction } from "@/app/actions/bet";
import { Badge, Button, Input, cn } from "@/components/ui";
import { formatKickoffWat } from "@/lib/format";

export type MarketOdds = {
  home: number;
  draw: number;
  away: number;
  /** Exact-score prices for every 0–10 v 0–10 line (index = home*11+away). */
  scoreOdds: number[];
  source: "table" | "default";
};

export type GoalsOddsUI = {
  btts: { yes: number; no: number };
  lines: { line: number; over: number; under: number }[];
};

export type FormGuideUI = { home: ("W" | "D" | "L")[]; away: ("W" | "D" | "L")[] };

export type BetMatch = {
  id: string;
  fixture: string;
  homeName: string;
  awayName: string;
  competition: string | null;
  kickoff: string;
  odds: MarketOdds;
  goals: GoalsOddsUI;
  form: FormGuideUI;
  doubleChance: { "1X": number; X2: number; "12": number };
  drawNoBet: { HOME: number; AWAY: number };
  halfResult: { HOME: number; DRAW: number; AWAY: number };
  /** HT/FT cells keyed HH, HD, HA, DH, DD, DA, AH, AD, AA. */
  halfFull: Record<string, number>;
  teamTotals: { HOME: { line: number; over: number; under: number }[]; AWAY: { line: number; over: number; under: number }[] };
};

export type BetRow = {
  id: string;
  /** Public share code → /bet/slip/[code]. */
  code: string;
  fixture: string;
  market: string;
  selectionLabel: string;
  odds: number;
  stake: number;
  potentialReturn: number;
  status: "PENDING" | "WON" | "LOST" | "VOID";
  payout: number;
  placedAt: string;
  result: string | null;
  legs?: { fixture: string; label: string; odds: number }[];
};

export type TxnRow = {
  id: string;
  amount: number;
  balanceAfter: number;
  kind: string;
  note: string;
  createdAt: string;
};

export type LeaderRow = { rank: number; name: string; balance: number; mine: boolean };

type SlipLeg = {
  matchId: string;
  fixture: string;
  kickoff: string;
  market: string;
  selection: string;
  label: string;
  odds: number;
};

type Notice = { ok: boolean; msg: string } | null;

const MAX_ACCA_LEGS = 6;
const MAX_STAKE_POINTS = 500;

const TABS = [
  { key: "markets", label: "Markets" },
  { key: "bets", label: "My bets" },
  { key: "wallet", label: "Wallet" },
  { key: "leaderboard", label: "Top players" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_TONE = { PENDING: "warning", WON: "success", LOST: "danger", VOID: "neutral" } as const;

const TXN_ICON: Record<string, string> = {
  WELCOME: "🎁",
  BET_PLACED: "🎯",
  BET_WON: "🏆",
  BET_LOST: "❌",
  BET_VOID: "↩️",
  FANTASY_GOAL: "⭐",
  DAILY_CLAIM: "📅",
  ADMIN_ADJUST: "🛠️",
};

export function marketTitle(market: string): string {
  return (
    {
      MATCH_RESULT: "Match result",
      EXACT_SCORE: "Exact score",
      TOTAL_GOALS: "Goals total",
      BOTH_TEAMS_TO_SCORE: "Both teams to score",
      DOUBLE_CHANCE: "Double chance",
      DRAW_NO_BET: "Draw no bet",
      HALF_RESULT: "Half-time result",
      HALF_FULL: "Half-time / full-time",
      TEAM_TOTALS: "Team goals",
      ACCA: "Accumulator",
    } as Record<string, string>
  )[market] ?? market;
}

/** Human label for a stored bet selection (used by My bets and the public slip page). */
export function selectionLabel(market: string, selection: string, legCount?: number): string {
  switch (market) {
    case "MATCH_RESULT":
      return { HOME: "Home win", DRAW: "Draw", AWAY: "Away win" }[selection] ?? selection;
    case "EXACT_SCORE":
      return `Score ${selection}`;
    case "TOTAL_GOALS":
      return selection.startsWith("O") ? `Over ${selection.slice(1)} goals` : `Under ${selection.slice(1)} goals`;
    case "BOTH_TEAMS_TO_SCORE":
      return selection === "YES" ? "Yes" : "No";
    case "DOUBLE_CHANCE":
      return { "1X": "Home or draw", X2: "Draw or away", "12": "Either team to win" }[selection] ?? selection;
    case "DRAW_NO_BET":
      return selection === "HOME" ? "Home win (draw refunds)" : "Away win (draw refunds)";
    case "HALF_RESULT":
      return { HOME: "Home at half-time", DRAW: "Draw at half-time", AWAY: "Away at half-time" }[selection] ?? selection;
    case "HALF_FULL":
      return `HT/FT ${selection}`;
    case "TEAM_TOTALS": {
      const team = selection.startsWith("H") ? "home" : "away";
      const over = selection.includes("_O");
      return `${over ? "Over" : "Under"} ${selection.slice(3)} (${team})`;
    }
    case "ACCA":
      return `${legCount ?? 0} legs`;
    default:
      return selection;
  }
}

/** Same WAT convention as formatKickoffWat, for plain timestamps. */
function fmtStamp(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 3600_000);
  return shifted.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " WAT";
}

export function BetTerminal({
  signedIn,
  balance,
  matches,
  bets,
  txns,
  leaderboard,
  myRank,
  claimedToday,
}: {
  signedIn: boolean;
  balance: number;
  matches: BetMatch[];
  bets: BetRow[];
  txns: TxnRow[];
  leaderboard: LeaderRow[];
  myRank: number | null;
  claimedToday: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("markets");
  const [legs, setLegs] = React.useState<SlipLeg[]>([]);
  const [stakeStr, setStakeStr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [wallet, setWallet] = React.useState(balance);
  const [prevBalance, setPrevBalance] = React.useState(balance);
  // Sync when the server refreshes the balance prop (React's adjust-state-
  // during-render pattern — avoids a setState-inside-effect cascade).
  if (prevBalance !== balance) {
    setPrevBalance(balance);
    setWallet(balance);
  }

  const stake = Math.floor(Number(stakeStr)) || 0;
  const oddsProduct = legs.reduce((p, l) => p * l.odds, 1);
  const combinedOdds = Math.min(999.99, Math.round(oddsProduct * 100) / 100);
  const potential = legs.length > 0 ? Math.floor(stake * oddsProduct) : 0;
  const pendingCount = bets.filter((b) => b.status === "PENDING").length;

  function pick(l: SlipLeg) {
    setNotice(null);
    const exists = legs.some((x) => x.matchId === l.matchId && x.market === l.market && x.selection === l.selection);
    if (!exists) {
      if (legs.some((x) => x.matchId === l.matchId)) {
        setNotice({ ok: false, msg: "One pick per match in an accumulator — remove the other selection first." });
        return;
      }
      if (legs.length >= MAX_ACCA_LEGS) {
        setNotice({ ok: false, msg: `Accumulators are capped at ${MAX_ACCA_LEGS} selections.` });
        return;
      }
    }
    setLegs((prev) =>
      exists ? prev.filter((x) => !(x.matchId === l.matchId && x.market === l.market && x.selection === l.selection)) : [...prev, l],
    );
  }

  function removeLeg(i: number) {
    setNotice(null);
    setLegs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearSlip() {
    setLegs([]);
    setNotice(null);
    setStakeStr("");
  }

  async function place() {
    if (busy || legs.length === 0 || !signedIn) return;
    if (stake < 1) {
      setNotice({ ok: false, msg: "Enter a stake of at least 1 point." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const r =
        legs.length === 1
          ? await placeBetAction({ matchId: legs[0].matchId, market: legs[0].market as never, selection: legs[0].selection, stake })
          : await placeAccaAction({ legs: legs.map((l) => ({ matchId: l.matchId, market: l.market as never, selection: l.selection })), stake });
      if (r.ok) {
        const data = r.data as { balance: number; potentialReturn: number; odds?: number };
        setWallet(data.balance);
        setNotice({
          ok: true,
          msg:
            legs.length === 1
              ? `Bet placed — ${stake} pts on ${legs[0].label} @ ${legs[0].odds}. Returns ${data.potentialReturn} pts if it lands.`
              : `Accumulator placed — ${stake} pts across ${legs.length} legs @ ${data.odds ?? combinedOdds}. Returns ${data.potentialReturn} pts if every leg lands.`,
        });
        setLegs([]);
        setStakeStr("");
        router.refresh();
      } else {
        setNotice({ ok: false, msg: r.error });
      }
    } catch (e) {
      console.error(e);
      setNotice({ ok: false, msg: "Could not place the bet — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Tab strip */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3" role="tablist" aria-label="Betting sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition-colors",
              t.key === tab
                ? "border-brand bg-brand/10 text-brand-deep"
                : "border-line bg-surface text-muted hover:border-brand/40 hover:text-fg",
            )}
          >
            {t.label}
            {t.key === "bets" && pendingCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-black text-subtle">{pendingCount}</span>
            ) : null}
            {t.key === "markets" && matches.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-black text-subtle">{matches.length}</span>
            ) : null}
          </button>
        ))}
        {signedIn ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-fg">
            <span aria-hidden>🪙</span>
            <span className="tabular-nums">{wallet}</span>
            <span className="font-medium text-muted">pts</span>
          </span>
        ) : null}
      </div>

      {tab === "markets" ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          {/* -------- market list -------- */}
          <div className={cn("space-y-4", legs.length > 0 && "pb-44 lg:pb-0")}>
            {matches.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-8 text-center text-sm text-muted">
                No open matches right now — markets appear as soon as a kick-off is scheduled.
              </p>
            ) : (
              matches.map((m) => <MarketCard key={m.id} match={m} legs={legs} onPick={pick} />)
            )}
          </div>

          {/* -------- bet slip -------- */}
          <aside
            className={cn(
              legs.length > 0
                ? "fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-x-0 border-b-0 shadow-[0_-8px_24px_rgba(11,32,48,.18)] lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:self-start lg:rounded-2xl lg:border-x-2 lg:border-b-2"
                : "hidden lg:block lg:sticky lg:top-24 lg:self-start",
              "border-2 border-fg/15 bg-bg-elevated",
            )}
            aria-label="Bet slip"
          >
            {legs.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-2xl" aria-hidden>
                  🎟️
                </p>
                <p className="mt-2 text-sm font-bold text-fg">Bet slip</p>
                <p className="mt-1 text-xs text-muted">Tap any odds to open a selection here. Add 2–6 picks for an accumulator.</p>
              </div>
            ) : (
              <div className="flex max-h-[82vh] flex-col lg:max-h-none">
                <div className="flex items-center justify-between px-4 pt-3">
                  <p className="text-xs font-black uppercase tracking-widest text-brand">
                    Bet slip{legs.length > 1 ? ` · ${legs.length} legs` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={clearSlip}
                    className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-fg"
                    aria-label="Clear bet slip"
                  >
                    ✕
                  </button>
                </div>

                {/* legs */}
                <div className="max-h-[26vh] space-y-1.5 overflow-y-auto px-4 pb-1 pt-2 lg:max-h-60">
                  {legs.map((l, i) => (
                    <div key={`${l.matchId}-${l.market}-${l.selection}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-fg">{l.fixture}</p>
                        <p className="truncate text-[10px] text-muted">
                          {marketTitle(l.market)} · {l.label}
                        </p>
                      </div>
                      <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-black tabular-nums text-white">{l.odds}</span>
                      <button
                        type="button"
                        onClick={() => removeLeg(i)}
                        className="grid size-5 shrink-0 place-items-center rounded text-xs text-subtle transition-colors hover:bg-line hover:text-danger"
                        aria-label={`Remove ${l.label} from slip`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {legs.length > 1 ? (
                  <div className="mx-4 mt-1.5 flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2 text-xs">
                    <span className="font-bold text-brand-deep">Accumulator · all legs must win</span>
                    <span className="font-black tabular-nums text-brand-deep">@ {combinedOdds}</span>
                  </div>
                ) : null}

                <div className="px-4 pb-4 pt-3">
                  {notice ? (
                    <p
                      role="alert"
                      className={cn(
                        "mb-3 rounded-lg border px-3 py-2 text-xs font-medium",
                        notice.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger",
                      )}
                    >
                      {notice.msg}
                    </p>
                  ) : null}

                  {signedIn ? (
                    <>
                      {/* -------- stake -------- */}
                      <div className="flex items-end justify-between gap-2">
                        <label htmlFor="stake" className="block text-xs font-black uppercase tracking-wider text-fg">
                          Stake (points)
                        </label>
                        <span className="text-[11px] text-muted">
                          Balance <span className="font-bold tabular-nums text-fg">{wallet}</span> · max {MAX_STAKE_POINTS}
                        </span>
                      </div>
                      <Input
                        id="stake"
                        type="number"
                        min={1}
                        max={MAX_STAKE_POINTS}
                        inputMode="numeric"
                        value={stakeStr}
                        onChange={(e) => setStakeStr(e.target.value)}
                        placeholder="e.g. 50"
                        className="mt-1 h-12 text-lg font-black tabular-nums"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[10, 25, 50, 100].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setStakeStr(String(Math.min(v, MAX_STAKE_POINTS)))}
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
                              stake === v ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-surface text-muted hover:border-brand/50 hover:text-fg",
                            )}
                          >
                            {v}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setStakeStr(String(Math.min(wallet, MAX_STAKE_POINTS)))}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:border-brand/50 hover:text-fg"
                        >
                          Max {Math.min(wallet, MAX_STAKE_POINTS)}
                        </button>
                      </div>

                      {/* -------- potential return -------- */}
                      <div className="mt-3 rounded-xl border border-success/30 bg-success/5 p-3 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Potential return</p>
                        <p className="text-2xl font-black tabular-nums text-success">{stake > 0 && legs.length > 0 ? `${potential} pts` : "—"}</p>
                        {stake > 0 && legs.length > 0 ? (
                          <p className="text-[10px] text-subtle">
                            {stake} pts × {legs.length > 1 ? `${legs.length}-fold @ ${combinedOdds}` : `@ ${legs[0].odds}`}
                          </p>
                        ) : (
                          <p className="text-[10px] text-subtle">Enter a stake to see your return</p>
                        )}
                      </div>

                      <Button variant="primary" className="mt-3 w-full" loading={busy} onClick={() => void place()}>
                        {legs.length > 1 ? `Place accumulator (${legs.length} legs)` : "Place bet"}
                      </Button>
                      <p className="mt-2 text-center text-[10px] text-subtle">Virtual points only — no real money.</p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Link
                        href="/login?next=/bet"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105"
                      >
                        Sign in to bet
                      </Link>
                      <Link
                        href="/register?next=/bet"
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-surface px-4 text-sm font-semibold text-fg hover:bg-line"
                      >
                        Create free account
                      </Link>
                      <p className="text-center text-[10px] text-subtle">Free account · 100 welcome points</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "bets" ? <BetsList bets={bets} signedIn={signedIn} /> : null}
      {tab === "wallet" ? (
        <WalletPanel signedIn={signedIn} balance={wallet} txns={txns} claimedToday={claimedToday} onClaimed={(b) => { setWallet(b); router.refresh(); }} />
      ) : null}
      {tab === "leaderboard" ? <Leaderboard rows={leaderboard} myRank={myRank} signedIn={signedIn} /> : null}
    </div>
  );
}

/* -------------------------------- market card ------------------------------ */

function MarketCard({ match, legs, onPick }: { match: BetMatch; legs: SlipLeg[]; onPick: (l: SlipLeg) => void }) {
  const [openScores, setOpenScores] = React.useState(false);
  const [openGoals, setOpenGoals] = React.useState(false);
  const [openHalf, setOpenHalf] = React.useState(false);
  const [customH, setCustomH] = React.useState(0);
  const [customA, setCustomA] = React.useState(0);

  const base = { matchId: match.id, fixture: match.fixture, kickoff: match.kickoff };
  const isSelected = (market: string, selection: string) =>
    legs.some((l) => l.matchId === match.id && l.market === market && l.selection === selection);

  const outcomes: { selection: "HOME" | "DRAW" | "AWAY"; label: string; odds: number }[] = [
    { selection: "HOME", label: match.homeName, odds: match.odds.home },
    { selection: "DRAW", label: "Draw", odds: match.odds.draw },
    { selection: "AWAY", label: match.awayName, odds: match.odds.away },
  ];

  const hasForm = match.form.home.length > 0 || match.form.away.length > 0;
  const customOdds = match.odds.scoreOdds[customH * 11 + customA] ?? 0;

  return (
    <article className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-4 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {match.competition ? (
            <Badge tone="neutral" className="!text-[9px]">
              {match.competition}
            </Badge>
          ) : null}
          <span className="text-[11px] font-medium text-muted">{formatKickoffWat(match.kickoff)}</span>
        </div>
        <Badge tone={match.odds.source === "table" ? "info" : "neutral"} className="!text-[9px]">
          {match.odds.source === "table" ? "📊 table odds" : "⚙ standard odds"}
        </Badge>
      </div>

      <p className="mt-2 text-center text-sm font-black text-fg">{match.fixture}</p>

      {hasForm ? (
        <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
          <FormChips form={match.form.home} />
          <span className="text-[9px] font-black uppercase tracking-widest text-subtle">form</span>
          <FormChips form={match.form.away} />
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {outcomes.map((o) => {
          const selection =
            o.selection === "HOME" ? "Home win" : o.selection === "AWAY" ? "Away win" : "Draw";
          const on = isSelected("MATCH_RESULT", o.selection);
          return (
            <button
              key={o.selection}
              type="button"
              onClick={() => onPick({ ...base, market: "MATCH_RESULT", selection: o.selection, label: selection, odds: o.odds })}
              aria-pressed={on}
              className={cn(
                "rounded-xl border-2 px-2 py-2.5 text-center transition-all",
                on ? "border-brand bg-brand text-white shadow-[2px_2px_0_rgba(11,32,48,.15)]" : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/50",
              )}
            >
              <span className={cn("block truncate text-[11px] font-semibold", on ? "text-white/90" : "text-muted")}>{o.label}</span>
              <span className="mt-0.5 block text-lg font-black tabular-nums">{o.odds}</span>
            </button>
          );
        })}
      </div>

      {/* -------- double chance -------- */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { sel: "1X", label: "1X", sub: "home or draw", odds: match.doubleChance["1X"] },
          { sel: "X2", label: "X2", sub: "draw or away", odds: match.doubleChance.X2 },
          { sel: "12", label: "12", sub: "either wins", odds: match.doubleChance["12"] },
        ].map((o) => {
          const on = isSelected("DOUBLE_CHANCE", o.sel);
          return (
            <button
              key={o.sel}
              type="button"
              onClick={() => onPick({ ...base, market: "DOUBLE_CHANCE", selection: o.sel, label: `Double chance ${o.label}`, odds: o.odds })}
              aria-pressed={on}
              className={cn(
                "rounded-xl border-2 px-2 py-2 text-center transition-all",
                on ? "border-brand bg-brand text-white shadow-[2px_2px_0_rgba(11,32,48,.15)]" : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/50",
              )}
            >
              <span className={cn("block text-sm font-black", on ? "text-white" : "text-fg")}>{o.label}</span>
              <span className={cn("block text-[9px] leading-tight", on ? "text-white/75" : "text-subtle")}>{o.sub}</span>
              <span className="mt-0.5 block text-base font-black tabular-nums">{o.odds}</span>
            </button>
          );
        })}
      </div>

      {/* -------- draw no bet -------- */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          { sel: "HOME", label: match.homeName, odds: match.drawNoBet.HOME },
          { sel: "AWAY", label: match.awayName, odds: match.drawNoBet.AWAY },
        ].map((o) => {
          const on = isSelected("DRAW_NO_BET", o.sel);
          return (
            <button
              key={o.sel}
              type="button"
              onClick={() => onPick({ ...base, market: "DRAW_NO_BET", selection: o.sel, label: `${o.label} (no draw)`, odds: o.odds })}
              aria-pressed={on}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border-2 px-2 py-2 text-left transition-all",
                on ? "border-brand bg-brand text-white shadow-[2px_2px_0_rgba(11,32,48,.15)]" : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/50",
              )}
            >
              <span className={cn("min-w-0 truncate text-[11px] font-semibold", on ? "text-white/90" : "text-muted")}>{o.label}</span>
              <span className={cn("text-base font-black tabular-nums", on ? "text-white" : "text-fg")}>{o.odds}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-center text-[9px] text-subtle">Draw no bet — a draw refunds the stake (singles only)</p>

      {/* -------- half-time markets -------- */}
      <button
        type="button"
        onClick={() => setOpenHalf((v) => !v)}
        aria-expanded={openHalf}
        className="mt-2 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-fg"
      >
        Half-time markets <span className="text-subtle">(HT result &amp; HT/FT)</span>
        <span aria-hidden className={cn("transition-transform duration-200", openHalf && "rotate-180")}>
          ▾
        </span>
      </button>

      {openHalf ? (
        <div className="mt-2 rounded-xl border border-line bg-surface p-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Result at the break</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {[
              { sel: "HOME", label: match.homeName, odds: match.halfResult.HOME },
              { sel: "DRAW", label: "Draw", odds: match.halfResult.DRAW },
              { sel: "AWAY", label: match.awayName, odds: match.halfResult.AWAY },
            ].map((o) => {
              const on = isSelected("HALF_RESULT", o.sel);
              return (
                <button
                  key={o.sel}
                  type="button"
                  onClick={() => onPick({ ...base, market: "HALF_RESULT", selection: o.sel, label: `Half-time ${o.label.toLowerCase()}`, odds: o.odds })}
                  aria-pressed={on}
                  className={cn(
                    "rounded-xl border-2 px-1.5 py-2 text-center transition-all",
                    on ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand/60",
                  )}
                >
                  <span className={cn("block truncate text-[10px] font-semibold", on ? "text-white/90" : "text-muted")}>{o.label}</span>
                  <span className="mt-0.5 block text-base font-black tabular-nums">{o.odds}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-subtle">Half-time → full-time</p>
          <div className="mt-1.5 grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1 text-center">
            <span className="grid place-items-center text-[9px] font-black uppercase text-subtle">HT\FT</span>
            {["H", "D", "A"].map((f) => (
              <span key={`f${f}`} className="grid place-items-center text-[9px] font-black text-subtle">
                {f === "H" ? "Home" : f === "D" ? "Draw" : "Away"}
              </span>
            ))}
            {["H", "D", "A"].map((h) => (
              <React.Fragment key={`ht${h}`}>
                <span className="grid place-items-center pr-1 text-right text-[9px] font-black text-subtle">
                  {h === "H" ? "Home" : h === "D" ? "Draw" : "Away"}
                </span>
                {["H", "D", "A"].map((f) => {
                  const cell = `${h}${f}`;
                  const odds = match.halfFull[cell] ?? 0;
                  const on = isSelected("HALF_FULL", cell);
                  return (
                    <button
                      key={cell}
                      type="button"
                      aria-label={`Half-time ${h}, full-time ${f}, odds ${odds}`}
                      aria-pressed={on}
                      onClick={() => onPick({ ...base, market: "HALF_FULL", selection: cell, label: `HT/FT ${cell}`, odds })}
                      className={cn(
                        "rounded-lg border py-1.5 text-xs font-black tabular-nums transition-colors",
                        on ? "border-brand bg-brand text-white" : "border-line bg-white text-fg hover:border-brand/60 hover:bg-brand/5",
                      )}
                    >
                      {odds}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-subtle">First letter = half-time · second = full time (H home, D draw, A away)</p>
        </div>
      ) : null}

      {/* -------- exact scores -------- */}
      <button
        type="button"
        onClick={() => setOpenScores((v) => !v)}
        aria-expanded={openScores}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-fg"
      >
        Exact scores <span className="text-subtle">(0–0 up to 10–0)</span>
        <span aria-hidden className={cn("transition-transform duration-200", openScores && "rotate-180")}>
          ▾
        </span>
      </button>

      {openScores ? (
        <div className="mt-2 overflow-x-auto">
          <div className="grid min-w-[280px] grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 text-center">
            <span className="grid place-items-center px-1 text-[9px] font-black uppercase text-subtle">H\A</span>
            {[0, 1, 2, 3, 4].map((a) => (
              <span key={`aw${a}`} className="grid place-items-center text-[9px] font-black text-subtle">
                {a}
              </span>
            ))}
            {[0, 1, 2, 3, 4].map((h) => (
              <React.Fragment key={`h${h}`}>
                <span className="grid place-items-center px-1 text-[9px] font-black text-subtle">{h}</span>
                {[0, 1, 2, 3, 4].map((a) => {
                  const odds = match.odds.scoreOdds[h * 11 + a] ?? 0;
                  const on = isSelected("EXACT_SCORE", `${h}-${a}`);
                  return (
                    <button
                      key={`${h}-${a}`}
                      type="button"
                      aria-label={`${match.homeName} ${h}-${a} ${match.awayName}, odds ${odds}`}
                      aria-pressed={on}
                      onClick={() => onPick({ ...base, market: "EXACT_SCORE", selection: `${h}-${a}`, label: `Score ${h}-${a}`, odds })}
                      className={cn(
                        "rounded-lg border py-1.5 text-xs font-black tabular-nums transition-colors",
                        on ? "border-brand bg-brand text-white" : "border-line bg-surface text-fg hover:border-brand/60 hover:bg-brand/5",
                      )}
                    >
                      {odds}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-subtle">
            Rows = {match.homeName} goals · Columns = {match.awayName} goals
          </p>

          {/* custom score beyond the quick grid — up to 10–0 */}
          <div className="mt-2 rounded-xl border border-line bg-surface p-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Any other score — up to 10–0 (10 questions)</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stepper
                label={match.homeName}
                value={customH}
                onDec={() => setCustomH((v) => Math.max(0, v - 1))}
                onInc={() => setCustomH((v) => Math.min(10, v + 1, 10 - customA))}
              />
              <Stepper
                label={match.awayName}
                value={customA}
                onDec={() => setCustomA((v) => Math.max(0, v - 1))}
                onInc={() => setCustomA((v) => Math.min(10, v + 1, 10 - customH))}
              />
            </div>
            <button
              type="button"
              onClick={() => onPick({ ...base, market: "EXACT_SCORE", selection: `${customH}-${customA}`, label: `Score ${customH}-${customA}`, odds: customOdds })}
              aria-pressed={isSelected("EXACT_SCORE", `${customH}-${customA}`)}
              className={cn(
                "mt-2 flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all",
                isSelected("EXACT_SCORE", `${customH}-${customA}`)
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-fg hover:border-brand/60",
              )}
            >
              <span>
                Add {customH}–{customA}
              </span>
              <span className="text-lg font-black tabular-nums">{customOdds}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* -------- goals markets -------- */}
      <button
        type="button"
        onClick={() => setOpenGoals((v) => !v)}
        aria-expanded={openGoals}
        className="mt-2 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-fg"
      >
        Goals markets <span className="text-subtle">(totals &amp; BTTS)</span>
        <span aria-hidden className={cn("transition-transform duration-200", openGoals && "rotate-180")}>
          ▾
        </span>
      </button>

      {openGoals ? (
        <div className="mt-2 rounded-xl border border-line bg-surface p-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Both teams to score</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {[
              { sel: "YES" as const, label: "Yes", odds: match.goals.btts.yes },
              { sel: "NO" as const, label: "No", odds: match.goals.btts.no },
            ].map((o) => {
              const on = isSelected("BOTH_TEAMS_TO_SCORE", o.sel);
              return (
                <button
                  key={o.sel}
                  type="button"
                  onClick={() => onPick({ ...base, market: "BOTH_TEAMS_TO_SCORE", selection: o.sel, label: `BTTS ${o.label.toLowerCase()}`, odds: o.odds })}
                  aria-pressed={on}
                  className={cn(
                    "rounded-xl border-2 px-2 py-2 text-center transition-all",
                    on ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand/60",
                  )}
                >
                  <span className={cn("block text-[11px] font-semibold", on ? "text-white/90" : "text-muted")}>{o.label}</span>
                  <span className="mt-0.5 block text-base font-black tabular-nums">{o.odds}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-[auto_1fr_1fr] items-center gap-1.5 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-subtle">Line</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-subtle">Over</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-subtle">Under</span>
            {match.goals.lines.map((l) => (
              <React.Fragment key={l.line}>
                <span className="pr-1 text-right text-xs font-black tabular-nums text-fg">{l.line}</span>
                {[
                  { sel: `O${l.line}`, label: "Over", odds: l.over },
                  { sel: `U${l.line}`, label: "Under", odds: l.under },
                ].map((o) => {
                  const on = isSelected("TOTAL_GOALS", o.sel);
                  return (
                    <button
                      key={o.sel}
                      type="button"
                      onClick={() => onPick({ ...base, market: "TOTAL_GOALS", selection: o.sel, label: `${o.label} ${l.line} goals`, odds: o.odds })}
                      aria-pressed={on}
                      className={cn(
                        "rounded-lg border-2 px-1 py-1.5 transition-all",
                        on ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand/60",
                      )}
                    >
                      <span className={cn("block text-[10px] font-semibold", on ? "text-white/90" : "text-muted")}>{o.label}</span>
                      <span className="block text-sm font-black tabular-nums">{o.odds}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-subtle">Team goals — over / under</p>
          {([["HOME", match.homeName], ["AWAY", match.awayName]] as const).map(([side, teamName]) => (
            <div key={side} className="mt-2">
              <p className="text-[10px] font-semibold text-muted">{teamName}</p>
              <div className="mt-1 grid grid-cols-[auto_1fr_1fr] items-center gap-1.5 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-subtle">Line</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-subtle">Over</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-subtle">Under</span>
                {(side === "HOME" ? match.teamTotals.HOME : match.teamTotals.AWAY).map((l) => (
                  <React.Fragment key={`${side}${l.line}`}>
                    <span className="pr-1 text-right text-xs font-black tabular-nums text-fg">{l.line}</span>
                    {[
                      { sel: `${side === "HOME" ? "H" : "A"}_O${l.line}`, label: "Over", odds: l.over },
                      { sel: `${side === "HOME" ? "H" : "A"}_U${l.line}`, label: "Under", odds: l.under },
                    ].map((o) => {
                      const on = isSelected("TEAM_TOTALS", o.sel);
                      return (
                        <button
                          key={o.sel}
                          type="button"
                          onClick={() =>
                            onPick({
                              ...base,
                              market: "TEAM_TOTALS",
                              selection: o.sel,
                              label: `${o.label} ${l.line} — ${teamName}`,
                              odds: o.odds,
                            })
                          }
                          aria-pressed={on}
                          className={cn(
                            "rounded-lg border-2 px-1 py-1.5 transition-all",
                            on ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand/60",
                          )}
                        >
                          <span className={cn("block text-[10px] font-semibold", on ? "text-white/90" : "text-muted")}>{o.label}</span>
                          <span className="block text-sm font-black tabular-nums">{o.odds}</span>
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/* --------------------------------- form chips ------------------------------ */

function FormChips({ form }: { form: ("W" | "D" | "L")[] }) {
  if (form.length === 0) return <span aria-hidden className="w-0" />;
  return (
    <span className="flex gap-0.5" aria-label={`Recent form: ${form.join(", ")}`}>
      {form.map((f, i) => (
        <span
          key={i}
          className={cn(
            "grid size-4 place-items-center rounded text-[8px] font-black text-white",
            f === "W" ? "bg-success" : f === "D" ? "bg-warning" : "bg-danger",
          )}
        >
          {f}
        </span>
      ))}
    </span>
  );
}

/* --------------------------------- steppers -------------------------------- */

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  const canInc = value < 10;
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-white px-1">
      <button
        type="button"
        onClick={onDec}
        disabled={value === 0}
        className="grid size-8 place-items-center rounded text-lg font-black text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-30"
        aria-label={`Decrease ${label} goals`}
      >
        −
      </button>
      <div className="min-w-0 text-center">
        <span className="block max-w-[90px] truncate text-[9px] font-bold uppercase text-subtle">{label}</span>
        <span className="block text-base font-black tabular-nums text-fg">{value}</span>
      </div>
      <button
        type="button"
        onClick={onInc}
        disabled={!canInc}
        className="grid size-8 place-items-center rounded text-lg font-black text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-30"
        aria-label={`Increase ${label} goals`}
      >
        +
      </button>
    </div>
  );
}

/* --------------------------------- my bets --------------------------------- */

/* --------------------------------- share ----------------------------------- */

function ShareSlipButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  const onShare = async () => {
    const url = `${window.location.origin}/bet/slip/${code}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "SoE betting slip", text: "My Stadium of Elite slip", url });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return; // user closed the sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — the link is on the slip page anyway
    }
  };
  return (
    <button
      type="button"
      onClick={onShare}
      className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-bold text-brand transition-colors hover:border-brand/50 hover:bg-brand/5"
    >
      {copied ? "Link copied ✓" : "Share"}
    </button>
  );
}

function BetsList({ bets, signedIn }: { bets: BetRow[]; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <div className="mt-6 rounded-2xl border border-brand/30 bg-brand/5 p-6 text-center">
        <p className="font-bold text-fg">Your bets live here</p>
        <p className="mt-1 text-sm text-muted">Sign in to see your bets and their results.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/login?next=/bet" className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
            Sign in
          </Link>
          <Link href="/register?next=/bet" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
            Register free
          </Link>
        </div>
      </div>
    );
  }
  if (bets.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-8 text-center text-sm text-muted">
        No bets yet — head to Markets and tap some odds.
      </p>
    );
  }
  return (
    <ol className="mt-5 space-y-2">
      {bets.map((b) => (
        <li key={b.id} className="rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_TONE[b.status]}>
                {b.status === "PENDING" ? "Pending" : b.status === "WON" ? "Won" : b.status === "LOST" ? "Lost" : "Void"}
              </Badge>
              {b.market === "ACCA" ? <Badge tone="info">Acca</Badge> : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-subtle">{fmtStamp(b.placedAt)}</span>
              <ShareSlipButton code={b.code} />
            </div>
          </div>
          <p className="mt-1.5 truncate text-sm font-bold text-fg">
            {b.fixture}
            {b.result ? <span className="ml-2 font-black text-brand">{b.result}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {marketTitle(b.market)} · {b.selectionLabel} @ <span className="font-bold text-fg">{b.odds}</span>
            {b.status === "PENDING" && b.result === null ? " · settles at full time" : ""}
          </p>
          {b.market === "ACCA" && b.legs?.length ? (
            <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5 text-[11px] text-muted">
              {b.legs.map((l, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{l.fixture}</span>
                  <span className="shrink-0 font-semibold text-fg">
                    {l.label} @ {l.odds}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span className="text-muted">
              Stake <span className="font-bold text-fg">{b.stake}</span> pts
            </span>
            <span className="text-muted">
              To return <span className="font-bold text-fg">{b.potentialReturn}</span> pts
            </span>
            {b.status === "WON" ? (
              <span className="font-black text-success">+{b.payout} pts won 🏆</span>
            ) : b.status === "LOST" ? (
              <span className="font-bold text-danger">lost</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------- wallet ---------------------------------- */

function WalletPanel({
  signedIn,
  balance,
  txns,
  claimedToday,
  onClaimed,
}: {
  signedIn: boolean;
  balance: number;
  txns: TxnRow[];
  claimedToday: boolean;
  onClaimed: (balance: number) => void;
}) {
  const [claimed, setClaimed] = React.useState(claimedToday);
  const [claiming, setClaiming] = React.useState(false);
  const [claimError, setClaimError] = React.useState<string | null>(null);

  async function claim() {
    if (claiming || claimed) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const r = await claimDailyAction();
      if (r.ok) {
        setClaimed(true);
        onClaimed(r.data.balance);
      } else {
        setClaimError(r.error);
      }
    } catch (e) {
      console.error(e);
      setClaimError("Could not claim your points — please try again.");
    } finally {
      setClaiming(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="mt-6 rounded-2xl border border-brand/30 bg-brand/5 p-6 text-center">
        <p className="font-bold text-fg">Your virtual wallet</p>
        <p className="mt-1 text-sm text-muted">Sign in to open your wallet with 100 welcome points.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/login?next=/bet" className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
            Sign in
          </Link>
          <Link href="/register?next=/bet" className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
            Register free
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-5">
      <div className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 text-center shadow-[4px_4px_0_rgba(11,32,48,.08)]">
        <p className="text-xs font-black uppercase tracking-widest text-muted">Balance</p>
        <p className="mt-1 text-4xl font-black tabular-nums text-brand">{balance}</p>
        <p className="mt-1 text-xs text-subtle">Virtual points · no real money · earn more from fantasy goals &amp; winning bets</p>

        <div className="mt-4">
          {claimed ? (
            <p className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs font-bold text-success">
              ✓ Daily claim done — back tomorrow
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void claim()}
              disabled={claiming}
              className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 disabled:opacity-60"
            >
              {claiming ? "Claiming…" : "🎁 Claim daily +20"}
            </button>
          )}
          {claimError ? <p className="mt-2 text-xs font-medium text-danger">{claimError}</p> : null}
        </div>
      </div>

      <h3 className="mt-6 text-sm font-black uppercase tracking-wider text-fg">Transaction history</h3>
      {txns.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-white p-6 text-center text-sm text-muted">
          No transactions yet.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {txns.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span aria-hidden className="text-lg">
                {TXN_ICON[t.kind] ?? "•"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{t.note}</span>
                <span className="block text-[11px] text-subtle">{fmtStamp(t.createdAt)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    "block text-sm font-black tabular-nums",
                    t.amount > 0 ? "text-success" : t.amount < 0 ? "text-danger" : "text-subtle",
                  )}
                >
                  {t.amount > 0 ? `+${t.amount}` : t.amount}
                </span>
                <span className="block text-[10px] text-subtle">bal {t.balanceAfter}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------- leaderboard ------------------------------- */

function Leaderboard({ rows, myRank, signedIn }: { rows: LeaderRow[]; myRank: number | null; signedIn: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-8 text-center text-sm text-muted">
        No wallets to rank yet — be the first to claim your welcome points.
      </p>
    );
  }
  return (
    <div className="mt-5">
      <p className="text-xs text-muted">Top virtual-point balances — win bets and fantasy goals to climb.</p>
      <ol className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
        {rows.map((r) => (
          <li
            key={r.rank}
            className={cn(
              "flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0",
              r.mine && "bg-brand/5 ring-1 ring-inset ring-brand/30",
            )}
          >
            <span
              className={cn(
                "grid w-8 shrink-0 place-items-center rounded-lg text-sm font-black tabular-nums",
                r.rank === 1 ? "bg-warning/20 text-warning" : r.rank === 2 ? "bg-line text-muted" : r.rank === 3 ? "bg-warning/10 text-warning" : "text-subtle",
              )}
            >
              {r.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-fg">
              {r.name}
              {r.mine ? <span className="ml-2 text-xs font-black text-brand">(you)</span> : null}
            </span>
            <span className="shrink-0 text-sm font-black tabular-nums text-brand">{r.balance} pts</span>
          </li>
        ))}
      </ol>
      {signedIn && myRank && myRank > rows.length ? (
        <p className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm text-muted">
          Your position: <span className="font-black text-fg">#{myRank}</span> — keep playing to enter the top {rows.length}.
        </p>
      ) : null}
      {!signedIn ? (
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/register?next=/bet" className="inline-flex h-10 items-center rounded-lg brand-gradient px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
            Join and start climbing
          </Link>
        </div>
      ) : null}
    </div>
  );
}
