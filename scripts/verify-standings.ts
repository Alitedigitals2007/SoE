import { prisma } from "@/lib/prisma";
import { leagueStandings } from "@/lib/platform/engine";

async function main() {
  const comps = await prisma.competition.findMany({ select: { id: true, name: true } });
  for (const c of comps) {
    const rows = await leagueStandings(c.id);
    if (rows.length === 0) continue;

    // Ground truth: count FINISHED matches per team straight from the DB.
    const finished = await prisma.match.findMany({
      where: { competitionId: c.id, status: "FINISHED", homeTeamId: { not: null }, awayTeamId: { not: null } },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
    });
    const truth = new Map<string, { p: number; gf: number; ga: number; pts: number }>();
    const bump = (id: string, gf: number, ga: number) => {
      const t = truth.get(id) ?? { p: 0, gf: 0, ga: 0, pts: 0 };
      t.p++; t.gf += gf; t.ga += ga;
      t.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
      truth.set(id, t);
    };
    for (const m of finished) {
      bump(m.homeTeamId!, m.homeScore, m.awayScore);
      bump(m.awayTeamId!, m.awayScore, m.homeScore);
    }

    const problems: string[] = [];
    for (const r of rows) {
      const t = truth.get(r.id) ?? { p: 0, gf: 0, ga: 0, pts: 0 };
      if (r.p !== t.p || r.gf !== t.gf || r.ga !== t.ga || r.pts !== t.pts) {
        problems.push(`  ${r.name}: standings P${r.p}/GF${r.gf}/GA${r.ga}/Pts${r.pts} vs db P${t.p}/GF${t.gf}/GA${t.ga}/Pts${t.pts}`);
      }
    }

    const leftover = [...truth.keys()].filter((id) => !rows.some((r) => r.id === id));
    console.log(`${c.name}: ${rows.length} rows, ${finished.length} finished matches`);
    console.log(problems.length === 0 && leftover.length === 0 ? "  OK - standings match the database exactly" : `  MISMATCH:\n${problems.join("\n")}${leftover.length ? `\n  teams missing from table: ${leftover.join(", ")}` : ""}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
