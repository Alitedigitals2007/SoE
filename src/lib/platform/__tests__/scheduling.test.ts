import { describe, it, expect } from "vitest";
import {
  legOneIndex,
  returnLegNotBefore,
  returnLegWaits,
  TIE_GAP_MS,
  type SchedMatch,
} from "@/lib/platform/scheduling";

const MINUTE = 60 * 1000;

function leg(over: Partial<SchedMatch> = {}): SchedMatch {
  return { id: "m1", status: "DRAFT", scheduledAt: null, cupTie: null, cupLeg: null, ...over };
}

describe("two-legged tie scheduling", () => {
  it("leaves single-leg ties completely alone", () => {
    const solo = leg();
    const idx = legOneIndex([solo]);
    expect(returnLegWaits(solo, idx)).toBe(false);
    expect(returnLegNotBefore(solo, idx)).toBeNull();
  });

  it("holds a return leg while its first leg has no kick-off", () => {
    const first = leg({ id: "leg1", cupTie: "t1", cupLeg: 1 });
    const second = leg({ id: "leg2", cupTie: "t1", cupLeg: 2 });
    const idx = legOneIndex([first, second]);

    expect(returnLegWaits(first, idx)).toBe(false);
    expect(returnLegWaits(second, idx)).toBe(true);
  });

  it("releases the return leg and pushes it a full day past leg one", () => {
    const at = new Date("2026-10-05T15:00:00.000Z");
    const first = leg({ id: "leg1", cupTie: "t1", cupLeg: 1, scheduledAt: at });
    const second = leg({ id: "leg2", cupTie: "t1", cupLeg: 2 });
    const idx = legOneIndex([first, second]);

    expect(returnLegWaits(second, idx)).toBe(false);
    expect(returnLegNotBefore(second, idx)).toEqual(new Date(at.getTime() + TIE_GAP_MS));
  });

  it("keeps two legs apart when both waves are run back to back", () => {
    const first = leg({ id: "leg1", cupTie: "t1", cupLeg: 1 });
    const second = leg({ id: "leg2", cupTie: "t1", cupLeg: 2 });
    const idx = legOneIndex([first, second]);

    // Wave one hands leg one its time...
    const waveOne = new Date(Date.now() + 90 * MINUTE);
    idx.setLegOneTime("t1", waveOne);

    // ...and wave two fires a minute later, wanting "now + 90 minutes".
    const waveTwo = new Date(waveOne.getTime() + MINUTE);
    const notBefore = returnLegNotBefore(second, idx);
    expect(notBefore).not.toBeNull();

    const chosen = notBefore && notBefore > waveTwo ? notBefore : waveTwo;
    expect(chosen!.getTime() - waveOne.getTime()).toBeGreaterThanOrEqual(TIE_GAP_MS);
  });

  it("does not drag a return leg back to a first leg played months ago", () => {
    const at = new Date("2026-01-01T15:00:00.000Z");
    const first = leg({ id: "leg1", cupTie: "t1", cupLeg: 1, scheduledAt: at });
    const second = leg({ id: "leg2", cupTie: "t1", cupLeg: 2 });
    const idx = legOneIndex([first, second]);

    const notBefore = returnLegNotBefore(second, idx);
    expect(notBefore).not.toBeNull();
    expect(new Date(Date.now() + 90 * MINUTE) > notBefore!).toBe(true);
  });

  it("releases the return leg when the first leg was awarded rather than played", () => {
    // A team leaving the competition awards fixtures 3-0 — a first leg can end
    // up FINISHED without ever having been scheduled. That must not wedge the
    // return leg out of every future scheduling wave.
    const first = leg({ id: "leg1", cupTie: "t1", cupLeg: 1, status: "FINISHED", scheduledAt: null });
    const second = leg({ id: "leg2", cupTie: "t1", cupLeg: 2 });
    const idx = legOneIndex([first, second]);

    expect(returnLegWaits(second, idx)).toBe(false);
    expect(returnLegNotBefore(second, idx)).toBeNull();
  });

  it("does not block a return leg whose first leg has gone missing", () => {
    const orphan = leg({ id: "leg2", cupTie: "t9", cupLeg: 2 });
    const idx = legOneIndex([orphan]);

    expect(idx.legOne("t9")).toBeNull();
    expect(returnLegWaits(orphan, idx)).toBe(false);
    expect(returnLegNotBefore(orphan, idx)).toBeNull();
  });

  it("reports the first leg only for its own tie", () => {
    const first = leg({ id: "leg1", cupTie: "t1", cupLeg: 1, scheduledAt: null });
    const second = leg({ id: "leg2", cupTie: "t1", cupLeg: 2 });
    const unrelated = leg({ id: "x", cupTie: "t2", cupLeg: 2 });
    const idx = legOneIndex([first, second, unrelated]);

    expect(idx.legOne("t1")?.id).toBe("leg1");
    expect(idx.legOne("t2")).toBeNull();
    expect(idx.legOne("t1")?.scheduledAt).toBeNull();
  });
});
