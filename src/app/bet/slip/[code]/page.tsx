import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { marketTitle, selectionLabel } from "@/lib/bet/labels";
import { selectionOutcomes } from "@/lib/bet/engine";
import { PublicShell } from "@/components/site";
import { Badge } from "@/components/ui";
import { RedeemCodeBox } from "@/components/bet";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: `Betting slip ${code.toUpperCase()} · Stadium of Elite` };
}

function fmtStamp(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 3600_000);
  return (
    shifted.toLocaleString("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " WAT"
  );
}

const STATUS_TONE = { PENDING: "warning", WON: "success", LOST: "danger", VOID: "neutral" } as const;
const STATUS_LABEL = { PENDING: "Pending", WON: "Won", LOST: "Lost", VOID: "Void" } as const;

type LegJson = {
  matchId?: string;
  fixture?: string;
  market?: string;
  selection?: string;
  label?: string;
  odds?: number;
};

type LegView = { fixture: string; label: string; odds: number; status: keyof typeof STATUS_LABEL };

/** Public read-only view of a placed slip: /bet/slip/[code]. */
export default async function BetSlipPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bet = await prisma.bet.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      user: { select: { name: true } },
      match: {
        select: {
          homeName: true,
          awayName: true,
          status: true,
          homeScore: true,
          awayScore: true,
          scheduledAt: true,
        },
      },
    },
  });

  if (!bet) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-black tracking-tight text-fg">Slip not found</h1>
          <p className="mt-2 text-sm text-muted">
            This share link doesn&apos;t match any slip — check the code, or make your own.
          </p>
          <Link
            href="/bet"
            className="mt-6 inline-flex h-10 items-center rounded-lg brand-gradient px-5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
          >
            Open the bet terminal
          </Link>
        </div>
      </PublicShell>
    );
  }

  const rawLegs = Array.isArray(bet.legs) ? (bet.legs as LegJson[]) : [];
  const isAcca = bet.market === "ACCA" && rawLegs.length > 0;

  // Each leg is judged on its own scoreline — one match query for the slip.
  const legs: LegView[] = [];
  if (isAcca) {
    const outcomes = await selectionOutcomes(
      prisma,
      rawLegs.map((l) => ({
        matchId: l.matchId ?? bet.matchId,
        market: l.market ?? bet.market,
        selection: l.selection ?? bet.selection,
      })),
    );
    rawLegs.forEach((l, i) => {
      legs.push({
        fixture: l.fixture ?? "",
        label: l.label || selectionLabel(l.market ?? "", l.selection ?? ""),
        odds: Number(l.odds ?? 0),
        status: outcomes[i] ?? "PENDING",
      });
    });
  }

  const finished = bet.match.status === "FINISHED";
  const result = finished ? `${bet.match.homeScore}–${bet.match.awayScore}` : null;

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-black tracking-tight text-fg">Betting slip</h1>
          <Badge tone={STATUS_TONE[bet.status]}>{STATUS_LABEL[bet.status]}</Badge>
        </div>
        <p className="mt-1 text-muted">
          Shared by {bet.user.name || "a player"} · {fmtStamp(bet.placedAt.toISOString())}
        </p>

        <RedeemCodeBox code={bet.code} caption="Redeem code" />

        <article className="mt-6 rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5 shadow-[4px_4px_0_rgba(11,32,48,.08)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-black text-fg">
              {bet.match.homeName} v {bet.match.awayName}
            </span>
            {bet.match.scheduledAt ? (
              <span className="text-[11px] text-muted">{fmtStamp(bet.match.scheduledAt.toISOString())}</span>
            ) : null}
          </div>

          {bet.market === "ACCA" ? (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
              {legs.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-fg">{l.fixture}</span>
                    <span className="block text-xs text-muted">{l.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-black tabular-nums text-fg">{l.odds}</span>
                    <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted">{marketTitle(bet.market)}</p>
                  <p className="text-lg font-black text-fg">{selectionLabel(bet.market, bet.selection, legs.length)}</p>
                  <p className="text-sm text-muted">
                    Odds <span className="font-black text-fg">{Number(bet.odds)}</span>
                  </p>
                </div>
                <Badge tone={STATUS_TONE[bet.status]}>{STATUS_LABEL[bet.status]}</Badge>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Stake</p>
              <p className="text-lg font-black tabular-nums text-fg">{bet.stake}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-subtle">To return</p>
              <p className="text-lg font-black tabular-nums text-fg">{bet.potentialReturn}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-subtle">Paid</p>
              <p
                className={
                  bet.status === "WON"
                    ? "text-lg font-black tabular-nums text-success"
                    : bet.status === "VOID"
                      ? "text-lg font-black tabular-nums text-muted"
                      : "text-lg font-black tabular-nums text-fg"
                }
              >
                {bet.status === "LOST" ? "0" : bet.payout}
              </p>
            </div>
          </div>

          {result ? (
            <p className="mt-3 rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-black text-fg">
              Final score {result}
              {bet.market !== "ACCA" ? "" : " · legs settled individually"}
            </p>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-2 text-center text-xs text-muted">
              Not settled yet — results land at full time.
            </p>
          )}
        </article>

        <p className="mt-4 text-center text-xs text-subtle">
          Virtual points only — no money is involved anywhere on Stadium of Elite.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/bet"
            className="inline-flex h-10 items-center rounded-lg brand-gradient px-5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
          >
            Make your own slip
          </Link>
          <Link
            href="/live"
            className="inline-flex h-10 items-center rounded-lg bg-surface px-5 text-sm font-semibold text-fg hover:bg-line"
          >
            Watch live
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
