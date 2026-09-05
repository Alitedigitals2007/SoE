import { prisma } from "@/lib/prisma";

function csvEscape(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export async function exportTeamStats(teamId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!team) return null;

  const finished = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    select: {
      homeTeamId: true,
      homeScore: true,
      awayScore: true,
      rounds: {
        where: { decision: "GOAL" },
        select: {
          goalSubmission: {
            select: { player: { select: { userId: true } } },
          },
        },
      },
    },
  });

  const rows: (string | number)[][] = [];
  for (const member of team.members) {
    let matches = 0;
    let goals = 0;
    let wins = 0;

    for (const m of finished) {
      const isHome = m.homeTeamId === teamId;
      const myScore = isHome ? m.homeScore : m.awayScore;
      const oppScore = isHome ? m.awayScore : m.homeScore;

      const played = await prisma.matchPlayer.findFirst({
        where: { matchId: m.homeTeamId ? "" : "", userId: member.userId },
        select: { id: true },
      });
      if (played) {
        matches++;
        if (myScore > oppScore) wins++;
      }
    }

    for (const m of finished) {
      for (const round of m.rounds) {
        if (round.goalSubmission?.player.userId === member.userId) {
          goals++;
        }
      }
    }

    rows.push([member.user.name, matches, goals, wins, team.name]);
  }

  return toCsv(["Player", "Matches", "Goals", "Wins", "Teams"], rows);
}

export async function exportMatchStats(matchCode: string): Promise<string | null> {
  const match = await prisma.match.findUnique({
    where: { code: matchCode.toUpperCase() },
    include: {
      rounds: {
        orderBy: { number: "asc" },
        include: {
          question: { select: { text: true } },
          submissions: {
            include: {
              player: {
                include: { user: { select: { name: true } } },
              },
            },
          },
          goalSubmission: {
            include: {
              player: {
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
      },
      incidents: {
        include: {
          player: {
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!match) return null;

  const rows: (string | number)[][] = [];
  for (const round of match.rounds) {
    if (round.status === "PENDING") continue;
    const scorer = round.goalSubmission?.player.user.name ?? "";
    const incident = match.incidents.find((i) => {
      const slot = round.submissions.find((s) => s.playerId === i.playerId);
      return !!slot;
    });
    rows.push([
      round.number,
      round.question.text,
      round.decision ?? "",
      scorer,
      incident ? `${incident.action} - ${incident.player.user.name}` : "",
    ]);
  }

  return toCsv(["Round", "Question", "Decision", "Scorer", "Cards"], rows);
}

export async function exportCompetitionStandings(competitionId: string): Promise<string | null> {
  const comp = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!comp) return null;

  const teams = await prisma.competitionTeam.findMany({
    where: { competitionId },
    include: { team: { select: { id: true, name: true } } },
    orderBy: { seed: "asc" },
  });

  const matches = await prisma.match.findMany({
    where: {
      competitionId,
      status: "FINISHED",
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  type Row = { name: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number };
  const rows = new Map<string, Row>();
  for (const t of teams) {
    rows.set(t.team.id, { name: t.team.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  }

  for (const m of matches) {
    const h = rows.get(m.homeTeamId!);
    const a = rows.get(m.awayTeamId!);
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) { h.w++; h.pts += 3; a.l++; }
    else if (m.homeScore < m.awayScore) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }

  const sorted = [...rows.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  const csvRows = sorted.map((r) => [r.name, r.p, r.w, r.d, r.l, r.gf, r.ga, r.gf - r.ga, r.pts]);

  return toCsv(["Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"], csvRows);
}
