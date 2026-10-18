import { Badge, Card, CardHeader, cn } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import type { MatchSnapshot } from "@/lib/domain";

/**
 * Automatic Player of the Match — computed from performance at full time,
 * not from votes. Shows the winner with their score breakdown.
 */
export function MotmPanel({ snapshot }: { snapshot: MatchSnapshot }) {
  const motm = snapshot.motm;
  if (!motm) {
    return (
      <Card>
        <CardHeader title="Player of the Match" description="Nobody stood out — no MOTM was awarded for this game." />
      </Card>
    );
  }

  const breakdown = [
    { label: "Goals", value: motm.goals, points: motm.goals * 3, tone: "text-fg" },
    { label: "Assists", value: motm.assists, points: motm.assists * 2, tone: "text-fg" },
    { label: "Yellow cards", value: motm.yellowCards, points: motm.yellowCards * -1, tone: "text-card-yellow" },
    { label: "Red cards", value: motm.redCards, points: motm.redCards * -3, tone: "text-card-red" },
  ].filter((b) => b.value > 0);

  return (
    <Card className="animate-soe-flip-in">
      <CardHeader
        title="Player of the Match"
        description="Decided automatically from match performance — goals, assists and conduct."
        aside={<Badge tone="gold">🏅 {motm.points} pts</Badge>}
      />
      <div className="p-5">
        <div
          className="flex items-center gap-4 rounded-xl border border-gold/40 bg-gold/10 p-4"
          style={{ perspective: "600px" }}
        >
          <Avatar name={motm.name} src={motm.imageUrl} size={56} className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-fg">{motm.name}</p>
            <p className="text-xs font-semibold text-muted">
              {motm.goals > 0 ? `${motm.goals} goal${motm.goals === 1 ? "" : "s"}` : null}
              {motm.goals > 0 && motm.assists > 0 ? " · " : null}
              {motm.assists > 0 ? `${motm.assists} assist${motm.assists === 1 ? "" : "s"}` : null}
              {motm.goals === 0 && motm.assists === 0 ? "Discipline held the top score" : null}
              {motm.decidingGoal ? " · ⚽ deciding goal" : ""}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-3xl font-black tabular-nums text-gold-strong">{motm.points}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-subtle">perf pts</p>
          </div>
        </div>

        {breakdown.length > 0 ? (
          <ul className={cn("mt-3 flex flex-wrap gap-1.5")}>
            {breakdown.map((b) => (
              <li
                key={b.label}
                className={cn(
                  "rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted",
                  b.tone,
                )}
              >
                {b.label} ×{b.value}
                <span className="ml-1 font-black text-fg">
                  {b.points > 0 ? `+${b.points}` : b.points}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-3 text-[10px] text-subtle">
          Formula: goal +3 · assist +2 · deciding goal +1 · yellow −1 · red −3. No voting — the maths picks it.
        </p>
      </div>
    </Card>
  );
}
