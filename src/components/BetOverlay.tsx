"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button, cn, Input } from "@/components/ui";
import { formatKickoffWat } from "@/lib/format";
import { marketTitle } from "@/lib/bet/labels";

export type BetOverlayMatch = {
  id: string;
  fixture: string;
  homeName: string;
  awayName: string;
  competition: string | null;
  kickoff: string;
  odds: {
    home: number;
    draw: number;
    away: number;
    scoreOdds: number[];
    source: "table" | "default";
  };
  bettable: boolean;
  bettableReason: string;
};

type SlipLeg = {
  matchId: string;
  fixture: string;
  market: string;
  selection: string;
  label: string;
  odds: number;
};

const MAX_ACCA_LEGS = 6;
const MAX_STAKE_POINTS = 500;

export function BetOverlay({
  matches,
  balance = 0,
  signedIn = false,
  onPlaceBet,
  onClose,
}: {
  matches: BetOverlayMatch[];
  balance?: number;
  signedIn?: boolean;
  onPlaceBet?: (legs: SlipLeg[], stake: number) => Promise<{ ok: boolean; msg: string }>;
  onClose?: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [slipOpen, setSlipOpen] = React.useState(false);
  const [legs, setLegs] = React.useState<SlipLeg[]>([]);
  const [stakeStr, setStakeStr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [wallet, setWallet] = React.useState(balance);

  if (wallet !== balance) {
    setWallet(balance);
  }

  const stake = Math.floor(Number(stakeStr)) || 0;
  const oddsProduct = legs.reduce((p, l) => p * l.odds, 1);
  const combinedOdds = Math.min(999.99, Math.round(oddsProduct * 100) / 100);
  const potential = legs.length > 0 ? Math.floor(stake * combinedOdds) : 0;

  function pick(l: SlipLeg) {
    setNotice(null);
    const fixture = matches.find((m) => m.id === l.matchId);
    if (fixture && !fixture.bettable) {
      setNotice({ ok: false, msg: `Not bettable — ${fixture.bettableReason}.` });
      return;
    }
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
    setLegs((prev) => (exists ? prev.filter((x) => !(x.matchId === l.matchId && x.market === l.market && x.selection === l.selection)) : [...prev, l]));
    if (!slipOpen) setSlipOpen(true);
  }

  function removeLeg(i: number) {
    setNotice(null);
    setLegs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearSlip() {
    setLegs([]);
    setNotice(null);
    setStakeStr("");
    setSlipOpen(false);
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
      const result = onPlaceBet ? await onPlaceBet(legs, stake) : { ok: true, msg: "Bet placed (demo)" };
      if (result.ok) {
        setWallet((w) => w - stake);
        setNotice({ ok: true, msg: result.msg });
        setLegs([]);
        setStakeStr("");
        setSlipOpen(false);
      } else {
        setNotice({ ok: false, msg: result.msg });
      }
    } catch {
      setNotice({ ok: false, msg: "Could not place the bet — please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={() => { setOpen(false); onClose?.(); }}>
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        className="absolute bottom-0 left-0 right-0 z-10 max-h-[90vh] overflow-hidden rounded-t-2xl border-2 border-fg/15 bg-bg-elevated shadow-[0_-8px_24px_rgba(11,32,48,.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-fg/15">
          <div className="flex items-center gap-2">
            <span aria-hidden>🪙</span>
            <span className="font-black text-fg">Betting</span>
            {signedIn && (
              <span className="ml-2 rounded-lg border border-line bg-surface px-2 py-0.5 text-[10px] font-bold tabular-nums text-fg">
                {wallet} pts
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSlipOpen(!slipOpen)}
              className={cn(
                "rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                slipOpen ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-surface text-muted hover:border-brand/50",
              )}
              aria-expanded={slipOpen}
            >
              {slipOpen ? "✕ Close slip" : `🎟️ Slip (${legs.length})`}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onClose?.(); }}
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-fg"
              aria-label="Close betting"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Match list */}
        <div className={cn("overflow-y-auto max-h-[60vh] px-4 py-4", slipOpen && "pr-4")}>
          {matches.length === 0 ? (
            <p className="text-center text-sm text-muted py-8">No open matches right now — markets appear when a kick-off is scheduled.</p>
          ) : (
            matches.map((m) => (
              <BetMatchCard key={m.id} match={m} onPick={pick} selected={legs.some((l) => l.matchId === m.id)} />
            ))
          )}
        </div>

        {/* Bet slip drawer */}
        {slipOpen && legs.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-fg/15 bg-bg-elevated shadow-[0_-8px_24px_rgba(11,32,48,.18)]">
            <BetSlip
              legs={legs}
              stakeStr={stakeStr}
              setStakeStr={setStakeStr}
              wallet={wallet}
              potential={potential}
              combinedOdds={combinedOdds}
              notice={notice}
              busy={busy}
              onRemoveLeg={removeLeg}
              onClear={clearSlip}
              onPlace={place}
            />
          </div>
        )}

        {/* Floating slip button when closed */}
        {legs.length > 0 && !slipOpen && (
          <button
            type="button"
            onClick={() => setSlipOpen(true)}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border-2 border-brand bg-brand px-4 py-2 text-sm font-black text-brand-ink shadow-lg animate-pop"
            aria-label={`Open bet slip (${legs.length} selections)`}
          >
            <span aria-hidden>🎟️</span>
            <span className="font-black">{legs.length}</span>
            <span className="text-[10px]">legs</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

function BetMatchCard({ match, onPick, selected }: { match: BetOverlayMatch; onPick: (l: SlipLeg) => void; selected: boolean }) {
  const isSelected = () => selected;
  
  const outcomes = [
    { sel: "HOME", label: match.homeName, odds: match.odds.home },
    { sel: "DRAW", label: "Draw", odds: match.odds.draw },
    { sel: "AWAY", label: match.awayName, odds: match.odds.away },
  ];

  return (
    <article
      className={cn(
        "rounded-2xl border-2 p-3 shadow-sm",
        match.bettable ? "border-fg/15 bg-bg-elevated" : "border-danger/40 bg-danger/5",
        selected && "ring-2 ring-brand"
      )}
    >
      {!match.bettable && (
        <div className="mb-2 text-center text-[10px] font-bold text-danger">
          {match.bettableReason}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {match.competition && <span className="text-[9px] font-bold uppercase text-muted">{match.competition}</span>}
          <span className="text-[10px] text-muted">{formatKickoffWat(match.kickoff)}</span>
        </div>
        <span className={cn("text-[9px] font-bold uppercase", match.odds.source === "table" ? "text-info" : "text-muted")}>
          {match.odds.source === "table" ? "Table odds" : "Standard"}
        </span>
      </div>
      <p className="mt-1 text-center text-sm font-black text-fg">{match.fixture}</p>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {outcomes.map((o) => {
          const on = isSelected();
          return (
            <button
              key={o.sel}
              type="button"
              onClick={() => onPick({ matchId: match.id, fixture: match.fixture, market: "MATCH_RESULT", selection: o.sel, label: o.label, odds: o.odds })}
              aria-pressed={on}
              className={cn(
                "rounded-xl border-2 px-2 py-2 text-center transition-all",
                on ? "border-brand bg-brand text-white shadow-sm" : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/50",
                !match.bettable && "opacity-50 cursor-not-allowed"
              )}
              disabled={!match.bettable}
            >
              <span className={cn("block truncate text-[10px] font-semibold", on ? "text-white/90" : "text-muted")}>{o.label}</span>
              <span className="mt-0.5 block text-base font-black tabular-nums">{o.odds}</span>
            </button>
          );
        })}
      </div>

      {/* Quick BTTS & Over/Under */}
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
        <button
          type="button"
          onClick={() => onPick({ matchId: match.id, fixture: match.fixture, market: "BOTH_TEAMS_TO_SCORE", selection: "YES", label: "BTTS Yes", odds: 1.85 })}
          className="rounded-xl border border-line bg-surface px-1 py-1.5 hover:border-brand/50"
        >
          <span className="block text-[9px] font-semibold text-muted">BTTS</span>
          <span className="block text-sm font-black">Yes</span>
        </button>
        <button
          type="button"
          onClick={() => onPick({ matchId: match.id, fixture: match.fixture, market: "BOTH_TEAMS_TO_SCORE", selection: "NO", label: "BTTS No", odds: 1.85 })}
          className="rounded-xl border border-line bg-surface px-1 py-1.5 hover:border-brand/50"
        >
          <span className="block text-[9px] font-semibold text-muted">BTTS</span>
          <span className="block text-sm font-black">No</span>
        </button>
        <button
          type="button"
          onClick={() => onPick({ matchId: match.id, fixture: match.fixture, market: "TOTAL_GOALS", selection: "O2.5", label: "Over 2.5", odds: 1.95 })}
          className="rounded-xl border border-line bg-surface px-1 py-1.5 hover:border-brand/50"
        >
          <span className="block text-[9px] font-semibold text-muted">Goals</span>
          <span className="block text-sm font-black">O 2.5</span>
        </button>
        <button
          type="button"
          onClick={() => onPick({ matchId: match.id, fixture: match.fixture, market: "TOTAL_GOALS", selection: "U2.5", label: "Under 2.5", odds: 1.95 })}
          className="rounded-xl border border-line bg-surface px-1 py-1.5 hover:border-brand/50"
        >
          <span className="block text-[9px] font-semibold text-muted">Goals</span>
          <span className="block text-sm font-black">U 2.5</span>
        </button>
      </div>
    </article>
  );
}

function BetSlip({
  legs,
  stakeStr,
  setStakeStr,
  wallet,
  potential,
  combinedOdds,
  notice,
  busy,
  onRemoveLeg,
  onClear,
  onPlace,
}: {
  legs: SlipLeg[];
  stakeStr: string;
  setStakeStr: (v: string) => void;
  wallet: number;
  potential: number;
  combinedOdds: number;
  notice: { ok: boolean; msg: string } | null;
  busy: boolean;
  onRemoveLeg: (i: number) => void;
  onClear: () => void;
  onPlace: () => void;
}) {
  const stake = Math.floor(Number(stakeStr)) || 0;

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center justify-between px-4 pt-3 border-b border-fg/15">
        <p className="text-xs font-black uppercase tracking-widest text-brand">Bet slip · {legs.length} leg{legs.length > 1 ? "s" : ""}</p>
        <button type="button" onClick={onClear} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg" aria-label="Clear bet slip">✕</button>
      </div>

      <div className="max-h-[30vh] space-y-1.5 overflow-y-auto px-4 pb-1 pt-2">
        {legs.map((l, i) => (
          <div key={`${l.matchId}-${l.market}-${l.selection}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-fg">{l.fixture}</p>
              <p className="truncate text-[9px] text-muted">{marketTitle(l.market)} · {l.label}</p>
            </div>
            <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-black tabular-nums text-white">{l.odds}</span>
            <button type="button" onClick={() => onRemoveLeg(i)} className="grid size-5 shrink-0 place-items-center rounded text-xs text-subtle hover:bg-line hover:text-danger" aria-label={`Remove ${l.label}`}>✕</button>
          </div>
        ))}
      </div>

      {legs.length > 1 && (
        <div className="mx-4 mt-1.5 flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2 text-xs">
          <span className="font-bold text-brand-deep">Accumulator · all legs must win</span>
          <span className="font-black tabular-nums text-brand-deep">@ {combinedOdds}</span>
        </div>
      )}

      <div className="px-4 pb-4 pt-3 space-y-3">
        {notice && (
          <p role="alert" className={cn("rounded-lg border px-3 py-2 text-xs font-medium", notice.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger")}>
            {notice.msg}
          </p>
        )}

        <div className="flex items-end justify-between gap-2">
          <label htmlFor="overlay-stake" className="block text-xs font-black uppercase tracking-wider text-fg">Stake (points)</label>
          <span className="text-[10px] text-muted">Balance <span className="font-bold tabular-nums text-fg">{wallet}</span> · max {MAX_STAKE_POINTS}</span>
        </div>
        <Input
          id="overlay-stake"
          type="number"
          min={1}
          max={MAX_STAKE_POINTS}
          inputMode="numeric"
          value={stakeStr}
          onChange={(e) => setStakeStr(e.target.value)}
          placeholder="e.g. 50"
          className="h-12 text-lg font-black tabular-nums"
        />
        <div className="flex flex-wrap gap-1.5">
          {[10, 25, 50, 100].map((v) => (
            <button key={v} type="button" onClick={() => setStakeStr(String(Math.min(v, MAX_STAKE_POINTS, wallet)))} className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors", stake === v ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-surface text-muted hover:border-brand/50")}>{v}</button>
          ))}
          <button type="button" onClick={() => setStakeStr(String(Math.min(wallet, MAX_STAKE_POINTS)))} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-muted hover:border-brand/50">Max {Math.min(wallet, MAX_STAKE_POINTS)}</button>
        </div>

        <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted">Potential return</p>
          <p className="text-2xl font-black tabular-nums text-success">{stake > 0 && legs.length > 0 ? `${potential} pts` : "—"}</p>
          {stake > 0 && legs.length > 0 ? (
            <p className="text-[9px] text-subtle">{stake} pts × {legs.length > 1 ? `${legs.length}-fold @ ${combinedOdds}` : `@ ${legs[0].odds}`}</p>
          ) : (
            <p className="text-[9px] text-subtle">Enter a stake to see your return</p>
          )}
        </div>

        <Button variant="primary" className="w-full" loading={busy} onClick={onPlace}>
          {legs.length > 1 ? `Place accumulator (${legs.length} legs)` : "Place bet"}
        </Button>
        <p className="text-center text-[9px] text-subtle">Virtual points only — no real money.</p>
      </div>
    </div>
  );
}

export function BetTrigger({ children, matches, ...props }: { children: React.ReactNode; matches: BetOverlayMatch[] } & Omit<React.ComponentProps<typeof BetOverlay>, "matches">) {
  const [, setOverlayOpen] = React.useState(false);

  return (
    <>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ onClick?: () => void }>, { onClick: () => setOverlayOpen(true) })
          : child
      )}
      <BetOverlay matches={matches} {...props} onClose={() => setOverlayOpen(false)} />
    </>
  );
}