/**
 * Scheduling rules for two-legged ties.
 *
 * Deliberately free of Prisma so the ordering rules are unit-testable. Before
 * this existed, two "schedule wave" clicks in quick succession would happily
 * kick both legs off an hour apart — and because the fixture query had no
 * ordering, the return leg could even be handed a kick-off before its first
 * leg had one.
 */

/** Minimum gap between the two legs of a tie (first leg → return leg). */
export const TIE_GAP_MS = 24 * 60 * 60 * 1000;

/** The tie fields a scheduler needs. */
export type SchedMatch = {
  id: string;
  status: string;
  scheduledAt: Date | null;
  cupTie: string | null;
  cupLeg: number | null;
};

export type LegOne = {
  id: string;
  finished: boolean;
  scheduledAt: Date | null;
};

export type LegOneIndex = {
  /**
   * The first leg of a tie — null when the tie is single-legged (or its first
   * leg has somehow gone missing), both of which mean "nothing to wait for".
   */
  legOne: (tie: string) => LegOne | null;
  /** Record the kick-off handed to a first leg, so its return leg can react. */
  setLegOneTime: (tie: string, at: Date) => void;
};

/**
 * Index the first legs of every two-legged tie. One-legged ties never enter the
 * index, so a straight knockout bracket is entirely unaffected by these rules.
 */
export function legOneIndex(matches: SchedMatch[]): LegOneIndex {
  const byTie = new Map<string, LegOne>();
  for (const m of matches) {
    if (m.cupTie && m.cupLeg === 1) {
      byTie.set(m.cupTie, { id: m.id, finished: m.status === "FINISHED", scheduledAt: m.scheduledAt });
    }
  }
  return {
    legOne: (tie) => byTie.get(tie) ?? null,
    setLegOneTime: (tie, at) => {
      const one = byTie.get(tie);
      if (one) one.scheduledAt = at;
    },
  };
}

/**
 * Earliest sensible kick-off for a return leg, or null when it isn't one (or
 * its first leg has no time to anchor to).
 */
export function returnLegNotBefore(m: SchedMatch, index: LegOneIndex): Date | null {
  if (m.cupLeg !== 2 || !m.cupTie) return null;
  const first = index.legOne(m.cupTie);
  return first?.scheduledAt ? new Date(first.scheduledAt.getTime() + TIE_GAP_MS) : null;
}

/**
 * True when a return leg must be held back because its first leg is still
 * waiting for a kick-off. A first leg that has already been played (even if it
 * somehow never got a scheduled time) has nothing left to wait for, so it
 * releases the return leg instead of blocking it forever.
 */
export function returnLegWaits(m: SchedMatch, index: LegOneIndex): boolean {
  if (m.cupLeg !== 2 || !m.cupTie) return false;
  const first = index.legOne(m.cupTie);
  if (!first || first.finished) return false;
  return !first.scheduledAt;
}
