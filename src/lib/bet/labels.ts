/** Human labels for stored bets — shared by the server pages and the client terminal. */

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
      return { HOME: "Home win", DRAW: "Draw", AWAY: "Away win" }[selection as "HOME" | "DRAW" | "AWAY"] ?? selection;
    case "EXACT_SCORE":
      return `Score ${selection}`;
    case "TOTAL_GOALS":
      return selection.startsWith("O") ? `Over ${selection.slice(1)} goals` : `Under ${selection.slice(1)} goals`;
    case "BOTH_TEAMS_TO_SCORE":
      return selection === "YES" ? "Yes" : "No";
    case "DOUBLE_CHANCE":
      return { "1X": "Home or draw", X2: "Draw or away", "12": "Either team to win" }[selection as "1X" | "X2" | "12"] ?? selection;
    case "DRAW_NO_BET":
      return selection === "HOME" ? "Home win (draw refunds)" : "Away win (draw refunds)";
    case "HALF_RESULT":
      return { HOME: "Home at half-time", DRAW: "Draw at half-time", AWAY: "Away at half-time" }[selection as "HOME" | "DRAW" | "AWAY"] ?? selection;
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
