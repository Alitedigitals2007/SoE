"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { placeBetAction } from "@/app/actions/bet";
import { Badge, Button, Input, cn } from "@/components/ui";
import { formatKickoffWat } from "@/lib/format";

export type MarketOdds = {
  home: number;
  draw: number;
  away: number;
  scores: { home: number; away: number; odds: number }[];
  source: "table" | "default";
};

export type BetMatch = {
  id: string;
  fixture: string;
  homeName: string;
  awayName: string;
  competition: string | null;
  kickoff: string;
  odds: MarketOdds;
};

export type BetRow = {
  id: string;
  fixture: string;
  market: "MATCH_RESULT" | "EXACT_SCORE";
  selectionLabel: string;
  odds: number;
  stake: number;
  potentialReturn: number;
  status: "PENDING" | "WON" | "LOST" | "VOID";
  payout: number;
  placedAt: string;
  result: string | null;
};

export type TxnRow = {
  id: string;
  amount: number;
  balanceAfter: number;
  kind: string;
  note: string;
  createdAt: string;
};

type Slip = {
  matchId: string;
  fixture: string;
  kickoff: string;
  market: "MATCH_RESULT" | "EXACT_SCORE";
  selection: string;
  label: string;
  odds: number;
};

type Notice = { ok: boolean; msg: string } | null;

const TABS = [
  { key: "markets", label: "Markets" },
  { key: "bets", label: "My bets" },
  { key: "wallet", label: "Wallet" },
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
};

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
}: {
  signedIn: boolean;
  balance: number;
  matches: BetMatch[];
  bets: BetRow[];
  txns: TxnRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("markets");
  const [slip, setSlip] = React.useState<Slip | null>(null);
  const [stakeStr, setStakeStr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [wallet, setWallet] = React.useState(balance);
  const [openScores, setOpenScores] = React.useState<string | null>(null);
  const [prevBalance, setPrevBalance] = React.useState(balance);
  // Sync when the server refreshes the balance prop (React's adjust-state-
  // during-render pattern — avoids a setState-inside-effect cascade).
  if (prevBalance !== balance) {
    setPrevBalance(balance);
    setWallet(balance);
  }

  const stake = Math.floor(Number(stakeStr)) || 0;
  const potential = slip ? Math.floor(stake * slip.odds) : 0;
  const pendingCount = bets.filter((b) => b.status === "PENDING").length;

  function pick(s: Slip) {
    setNotice(null);
    setSlip((prev) => (prev && prev.matchId === s.matchId && prev.selection === s.selection ? null : s));
  }

  async function place() {
    if (busy || !slip || !signedIn) return;
    if (stake < 1) {
      setNotice({ ok: false, msg: "Enter a stake of at least 1 point." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const r = await placeBetAction({ matchId: slip.matchId, market: slip.market, selection: slip.selection, stake });
      if (r.ok) {
        setWallet(r.data.balance);
        setNotice({
          ok: true,
          msg: `Bet placed — ${stake} pts on ${slip.label} @ ${slip.odds}. Returns ${r.data.potentialReturn} pts if it lands.`,
        });
        setSlip(null);
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
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3" role="tablist" aria-label="Betting sections">
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
      </div>

      {tab === "markets" ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          {/* -------- market list -------- */}
          <div className="space-y-4">
            {matches.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-8 text-center text-sm text-muted">
                No open matches right now — markets appear as soon as a kick-off is scheduled.
              </p>
            ) : (
              matches.map((m) => (
                <MarketCard
                  key={m.id}
                  match={m}
                  slip={slip}
                  onPick={pick}
                  openScores={openScores === m.id}
                  onToggleScores={() => setOpenScores((cur) => (cur === m.id ? null : m.id))}
                />
              ))
            )}
          </div>

          {/* -------- bet slip -------- */}
          <aside
            className={cn(
              slip
                ? "fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-b-none border-b-0 p-4 shadow-[0_-8px_24px_rgba(11,32,48,.18)] lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:max-h-none lg:self-start lg:overflow-visible lg:rounded-2xl lg:border-b-2"
                : "hidden lg:block lg:sticky lg:top-24 lg:self-start",
              "rounded-2xl border-2 border-fg/15 bg-bg-elevated shadow-[4px_4px_0_rgba(11,32,48,.08)]",
            )}
            aria-label="Bet slip"
          >
            {!slip ? (
              <div className="p-5 text-center">
                <p className="text-2xl" aria-hidden>🎟️</p>
                <p className="mt-2 text-sm font-bold text-fg">Bet slip</p>
                <p className="mt-1 text-xs text-muted">Tap any odds to open a selection here.</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-brand">Bet slip</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSlip(null);
                      setNotice(null);
                    }}
                    className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-fg"
                    aria-label="Clear bet slip"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-line bg-surface p-3">
                  <p className="truncate text-sm font-bold text-fg">{slip.fixture}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{formatKickoffWat(slip.kickoff)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-muted">
                      {slip.market === "MATCH_RESULT" ? "Match result" : "Exact score"} · <span className="text-fg">{slip.label}</span>
                    </span>
                    <span className="rounded-lg bg-brand px-2 py-1 text-sm font-black tabular-nums text-white">{slip.odds}</span>
                  </div>
                </div>

                {notice ? (
                  <p
                    role="alert"
                    className={cn(
                      "mt-3 rounded-lg border px-3 py-2 text-xs font-medium",
                      notice.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger",
                    )}
                  >
                    {notice.msg}
                  </p>
                ) : null}

                {signedIn ? (
                  <>
                    <label htmlFor="stake" className="mt-3 block text-xs font-semibold uppercase tracking-wider text-muted">
                      Stake (points)
                    </label>
                    <Input
                      id="stake"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={stakeStr}
                      onChange={(e) => setStakeStr(e.target.value)}
                      placeholder="e.g. 50"
                      className="mt-1"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[10, 25, 50].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setStakeStr(String(v))}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:border-brand/50 hover:text-fg"
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setStakeStr(String(wallet))}
                        className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-muted transition-colors hover:border-brand/50 hover:text-fg"
                      >
                        Max
                      </button>
                    </div>

                    <dl className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-muted">Potential return</dt>
                        <dd className="font-black tabular-nums text-success">{stake > 0 ? `${potential} pts` : "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted">Balance after stake</dt>
                        <dd className={cn("font-bold tabular-nums", stake > wallet ? "text-danger" : "text-fg")}>
                          {wallet - stake} pts
                        </dd>
                      </div>
                    </dl>

                    <Button variant="primary" className="mt-3 w-full" loading={busy} onClick={() => void place()}>
                      Place bet
                    </Button>
                    <p className="mt-2 text-center text-[10px] text-subtle">Virtual points only — no real money.</p>
                  </>
                ) : (
                  <div className="mt-4 space-y-2">
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
            )}
          </aside>
        </div>
      ) : null}

      {tab === "bets" ? <BetsList bets={bets} signedIn={signedIn} /> : null}
      {tab === "wallet" ? <WalletPanel signedIn={signedIn} balance={wallet} txns={txns} /> : null}
    </div>
  );
}

/* -------------------------------- market card ------------------------------ */

function MarketCard({
  match,
  slip,
  onPick,
  openScores,
  onToggleScores,
}: {
  match: BetMatch;
  slip: Slip | null;
  onPick: (s: Slip) => void;
  openScores: boolean;
  onToggleScores: () => void;
}) {
  const base = {
    matchId: match.id,
    fixture: match.fixture,
    kickoff: match.kickoff,
  };
  const isSelected = (market: Slip["market"], selection: string) =>
    slip?.matchId === match.id && slip.market === market && slip.selection === selection;

  const outcomes: { selection: "HOME" | "DRAW" | "AWAY"; label: string; sub: string; odds: number }[] = [
    { selection: "HOME", label: match.homeName, sub: "Home", odds: match.odds.home },
    { selection: "DRAW", label: "Draw", sub: "X", odds: match.odds.draw },
    { selection: "AWAY", label: match.awayName, sub: "Away", odds: match.odds.away },
  ];

  return (
    <article className="rounded-2xl border-2 border-fg/15 bg-bg-elevated p-4 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {match.competition ? <Badge tone="neutral" className="!text-[9px]">{match.competition}</Badge> : null}
          <span className="text-[11px] font-medium text-muted">{formatKickoffWat(match.kickoff)}</span>
        </div>
        <Badge tone={match.odds.source === "table" ? "info" : "neutral"} className="!text-[9px]">
          {match.odds.source === "table" ? "📊 table odds" : "⚙ standard odds"}
        </Badge>
      </div>

      <p className="mt-2 text-center text-sm font-black text-fg">{match.fixture}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {outcomes.map((o) => (
          <button
            key={o.selection}
            type="button"
            onClick={() =>
              onPick({
                ...base,
                market: "MATCH_RESULT",
                selection: o.selection,
                label: o.selection === "HOME" ? "Home win" : o.selection === "AWAY" ? "Away win" : "Draw",
                odds: o.odds,
              })
            }
            aria-pressed={isSelected("MATCH_RESULT", o.selection)}
            className={cn(
              "rounded-xl border-2 px-2 py-2.5 text-center transition-all",
              isSelected("MATCH_RESULT", o.selection)
                ? "border-brand bg-brand text-white shadow-[2px_2px_0_rgba(11,32,48,.15)]"
                : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/50",
            )}
          >
            <span className={cn("block truncate text-[11px] font-semibold", isSelected("MATCH_RESULT", o.selection) ? "text-white/90" : "text-muted")}>
              {o.label}
            </span>
            <span className="mt-0.5 block text-lg font-black tabular-nums">{o.odds}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleScores}
        aria-expanded={openScores}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-fg"
      >
        Exact scores
        <span aria-hidden className={cn("transition-transform duration-200", openScores && "rotate-180")}>▾</span>
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
                  const cell = match.odds.scores.find((s) => s.home === h && s.away === a);
                  const on = isSelected("EXACT_SCORE", `${h}-${a}`);
                  return (
                    <button
                      key={`${h}-${a}`}
                      type="button"
                      aria-label={`${match.homeName} ${h}-${a} ${match.awayName}, odds ${cell?.odds ?? "—"}`}
                      aria-pressed={on}
                      onClick={() =>
                        onPick({
                          ...base,
                          market: "EXACT_SCORE",
                          selection: `${h}-${a}`,
                          label: `Score ${h}-${a}`,
                          odds: cell?.odds ?? 0,
                        })
                      }
                      className={cn(
                        "rounded-lg border py-1.5 text-xs font-black tabular-nums transition-colors",
                        on
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-surface text-fg hover:border-brand/60 hover:bg-brand/5",
                      )}
                    >
                      {cell?.odds ?? "—"}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-subtle">Rows = {match.homeName} goals · Columns = {match.awayName} goals</p>
        </div>
      ) : null}
    </article>
  );
}

/* --------------------------------- my bets --------------------------------- */

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
            <Badge tone={STATUS_TONE[b.status]}>{b.status === "PENDING" ? "Pending" : b.status === "WON" ? "Won" : b.status === "LOST" ? "Lost" : "Void"}</Badge>
            <span className="text-[11px] text-subtle">{fmtStamp(b.placedAt)}</span>
          </div>
          <p className="mt-1.5 truncate text-sm font-bold text-fg">
            {b.fixture}
            {b.result ? <span className="ml-2 font-black text-brand">{b.result}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {b.market === "MATCH_RESULT" ? "Result" : "Exact score"} · {b.selectionLabel} @ <span className="font-bold text-fg">{b.odds}</span>
            {b.result ? "" : ` · settles at full time`}
          </p>
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

function WalletPanel({ signedIn, balance, txns }: { signedIn: boolean; balance: number; txns: TxnRow[] }) {
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
        <p className="mt-1 text-xs text-subtle">Virtual points · no real money · earn more from fantasy goals & winning bets</p>
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
              <span aria-hidden className="text-lg">{TXN_ICON[t.kind] ?? "•"}</span>
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
