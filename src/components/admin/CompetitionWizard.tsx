"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createWizardCompetitionAction } from "@/app/actions/admin";
import {
  competitionStandingsAction,
  generateCupRoundAction,
  generateGroupFixturesAction,
  generateLeagueFixturesAction,
  pickSourceCompetitionsAction,
} from "@/app/actions/platform";
import { Button, Card, CardHeader, cn, Field, Input, Select } from "@/components/ui";
import type { TeamOption } from "@/components/platformAdmin";

/* -------------------------------------------------------------------------- */
/*                                    types                                   */
/* -------------------------------------------------------------------------- */

type Format = "LEAGUE" | "CUP" | "LEAGUE_CUP" | "CUSTOM";

type Settings = {
  name: string;
  season: string;
  teamIds: string[];
  roundsCount: number;
  countdownSecs: number;
  seedingMethod: "random" | "rank";
  groupsCount: number;
  teamsPerGroup: number;
  topAdvancing: number;
  /** CUP: 1 leg, or 2 legs settled on aggregate (no away goals). */
  legsPerTie: 1 | 2;
  /** CUP: play a third-place match between the semi-final losers. */
  thirdPlace: boolean;
  /** Where the team list came from — "all" or an existing competition. */
  source: "all" | string;
};

type Step = 1 | 2 | 3;

type Notice = { kind: "ok" | "err"; text: string } | null;

/** A competition an admin can lift a team list from. */
type SourceComp = { id: string; name: string; season: string; type: string; teamCount: number };

/** The columns of a standings table the picker needs — the row also carries
 *  trend/form/left, which this form doesn't display. */
type StandingsRow = {
  id: string;
  name: string;
  p: number;
  gf: number;
  ga: number;
  pts: number;
  left: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                  constants                                 */
/* -------------------------------------------------------------------------- */

const FORMAT_OPTIONS: { value: Format; label: string; icon: string; hint: string }[] = [
  { value: "LEAGUE", label: "League", icon: "📊", hint: "Round-robin, all teams play each other. Standings table." },
  { value: "CUP", label: "Cup", icon: "🏆", hint: "Knockout bracket, single elimination. Seeded draw." },
  { value: "LEAGUE_CUP", label: "League + Cup", icon: "⚽", hint: "Group stage round-robin, then top teams advance to knockout." },
  { value: "CUSTOM", label: "Custom", icon: "🔧", hint: "Create shell competition. Add fixtures manually later." },
];

const DEFAULT_SETTINGS: Settings = {
  name: "",
  season: `${new Date().getFullYear()}/${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`,
  teamIds: [],
  roundsCount: 1,
  countdownSecs: 15,
  seedingMethod: "rank",
  groupsCount: 2,
  teamsPerGroup: 4,
  topAdvancing: 2,
  legsPerTie: 1,
  thirdPlace: false,
  source: "all",
};

/* -------------------------------------------------------------------------- */
/*                                helper fns                                  */
/* -------------------------------------------------------------------------- */

function leagueFixtureCount(teams: number, rounds: number): number {
  if (teams < 2) return 0;
  const n = teams % 2 === 0 ? teams : teams + 1;
  return Math.floor(n / 2) * (n - 1) * rounds;
}

/**
 * A single-elimination bracket with `teams` entries always runs `teams - 1`
 * ties. Every tie is two legs except the final, which is always one match.
 */
function cupFixtureCount(teams: number, legs: 1 | 2 = 1, thirdPlace = false): number {
  if (teams < 2) return 0;
  const ties = teams - 1;
  const legsBeforeFinal = Math.max(0, ties - 1);
  // A two-team "cup" is just the final — there are no semi-finals to play off.
  return legsBeforeFinal * legs + 1 + (thirdPlace && teams >= 4 ? 1 : 0);
}

/** Ties in the first round: the top seeds get a bye when the field isn't 2ⁿ. */
function cupRoundOneTies(teams: number): number {
  if (teams < 2) return 0;
  const power = 2 ** Math.ceil(Math.log2(teams));
  return (teams - (power - teams)) / 2;
}

function groupCupFixtureCount(
  teams: number,
  groups: number,
  perGroup: number,
  advance: number,
  legs: 1 | 2 = 1,
): { groupFixtures: number; knockoutFixtures: number } {
  const groupFixtures = groups * Math.floor((perGroup * (perGroup - 1)) / 2);
  const advancingTeams = groups * advance;
  const knockoutFixtures = advancingTeams >= 2 ? cupFixtureCount(advancingTeams, legs) : 0;
  return { groupFixtures, knockoutFixtures };
}

/* -------------------------------------------------------------------------- */
/*                             Progress bar                                   */
/* -------------------------------------------------------------------------- */

function ProgressBar({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Format" },
    { n: 2, label: "Settings" },
    { n: 3, label: "Preview" },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          {i > 0 ? <div className="h-px flex-1 bg-line" /> : null}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                step >= s.n ? "border-brand bg-brand text-white" : "border-line bg-bg-raised text-muted",
              )}
            >
              {s.n}
            </span>
            <span className={cn("text-xs font-semibold", step >= s.n ? "text-fg" : "text-muted")}>{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  wizard                                    */
/* -------------------------------------------------------------------------- */

export function CompetitionWizard({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [format, setFormat] = React.useState<Format>("LEAGUE");
  const [settings, setSettings] = React.useState<Settings>({ ...DEFAULT_SETTINGS });
  const [notice, setNotice] = React.useState<Notice>(null);
  const [loading, setLoading] = React.useState(false);

  const [sources, setSources] = React.useState<SourceComp[] | null>(null);
  const [standings, setStandings] = React.useState<StandingsRow[] | null>(null);
  const [sourceLoading, setSourceLoading] = React.useState(false);
  const [sourceError, setSourceError] = React.useState<string | null>(null);

  /** Load the competitions list once, when the league picker is first opened. */
  async function openSources() {
    if (sources) return;
    const r = await pickSourceCompetitionsAction();
    if (r.ok) setSources(r.data ?? []);
    else setSourceError(r.error ?? "Could not load competitions.");
  }

  /** Pull a competition's standings so rows can be tapped to add those teams. */
  async function loadStandings(id: string) {
    setSourceLoading(true);
    setSourceError(null);
    const r = await competitionStandingsAction(id);
    if (r.ok) {
      setStandings(r.data ?? []);
      update("source", id);
    } else {
      setSourceError(r.error ?? "Could not load that competition's standings.");
    }
    setSourceLoading(false);
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function toggleTeam(id: string) {
    setSettings((s) => ({
      ...s,
      teamIds: s.teamIds.includes(id) ? s.teamIds.filter((x) => x !== id) : [...s.teamIds, id],
    }));
  }

  /* ---- predictions ---- */

  const teamCount = settings.teamIds.length;
  const predictedLeague = format === "LEAGUE" || format === "LEAGUE_CUP" ? leagueFixtureCount(teamCount, settings.roundsCount) : 0;
  const predictedCupTies = format === "CUP" ? cupRoundOneTies(teamCount) : 0;
  const predictedCup = format === "CUP" ? cupFixtureCount(teamCount, settings.legsPerTie, settings.thirdPlace) : 0;
  let predictedGroup = 0;
  let predictedKnockout = 0;
  if (format === "LEAGUE_CUP" && teamCount >= 2) {
    const g = groupCupFixtureCount(
      teamCount,
      settings.groupsCount,
      settings.teamsPerGroup,
      settings.topAdvancing,
      settings.legsPerTie,
    );
    predictedGroup = g.groupFixtures;
    predictedKnockout = g.knockoutFixtures;
  }

  /* ---- navigation guards ---- */

  function canProceedStep1(): boolean {
    return true; // any format is valid
  }

  function canProceedStep2(): boolean {
    if (!settings.name.trim() || !settings.season.trim()) return false;
    if (settings.teamIds.length < 2) return false;
    if (format === "CUP" && settings.teamIds.length % 2 !== 0) return false;
    if (format === "LEAGUE_CUP") {
      if (settings.teamsPerGroup < 2) return false;
      if (settings.groupsCount < 1) return false;
      if (settings.topAdvancing < 1 || settings.topAdvancing >= settings.teamsPerGroup) return false;
      if (settings.groupsCount * settings.teamsPerGroup !== settings.teamIds.length) return false;
    }
    return true;
  }

  /* ---- create & generate ---- */

  async function handleGenerate() {
    setLoading(true);
    setNotice(null);
    try {
      const result = await createWizardCompetitionAction({
        name: settings.name.trim(),
        type: format,
        season: settings.season.trim(),
        teamIds: settings.teamIds,
        groupsCount: format === "LEAGUE_CUP" ? settings.groupsCount : undefined,
        teamsPerGroup: format === "LEAGUE_CUP" ? settings.teamsPerGroup : undefined,
        topAdvancing: format === "LEAGUE_CUP" ? settings.topAdvancing : undefined,
        roundsCount: format === "LEAGUE" ? settings.roundsCount : undefined,
        countdownSecs: settings.countdownSecs,
        legsPerTie: format === "CUP" || format === "LEAGUE_CUP" ? settings.legsPerTie : undefined,
        thirdPlace: format === "CUP" ? settings.thirdPlace : undefined,
      });

      if (!result.ok) {
        setNotice({ kind: "err", text: result.error ?? "Could not create competition." });
        setLoading(false);
        return;
      }
      if (!result.data) {
        setNotice({ kind: "err", text: "Could not create competition." });
        setLoading(false);
        return;
      }

      const { competitionId, slug } = result.data;

      // Generate fixtures based on format
      let genResult: { ok: boolean; error?: string } = { ok: true };
      if (format === "LEAGUE") {
        genResult = await generateLeagueFixturesAction({ competitionId });
      } else if (format === "CUP") {
        genResult = await generateCupRoundAction({ competitionId });
      } else if (format === "LEAGUE_CUP") {
        genResult = await generateGroupFixturesAction({ competitionId });
      }
      // CUSTOM: no auto-generation

      if (!genResult.ok) {
        setNotice({ kind: "ok", text: `Competition created, but fixtures could not be generated: ${genResult.error}` });
        router.push(`/admin/competitions/${slug}`);
        return;
      }

      router.push(`/admin/competitions/${slug}`);
    } catch {
      setNotice({ kind: "err", text: "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  /* ---- format descriptions ---- */

  function formatDescription(): string {
    switch (format) {
      case "LEAGUE":
        return `All ${teamCount} teams play each other in a round-robin. Each round has ${Math.floor(teamCount / 2)} fixtures.`;
      case "CUP":
        return `${teamCount} teams in a single-elimination bracket${
          settings.legsPerTie === 2 ? " — two legs per tie, settled on aggregate (no away goals)" : ""
        }${settings.thirdPlace ? ", plus a third-place match" : ""}. ${predictedCupTies} tie${
          predictedCupTies === 1 ? "" : "s"
        } in round 1.`;
      case "LEAGUE_CUP":
        return `${settings.groupsCount} groups of ${settings.teamsPerGroup}. Top ${settings.topAdvancing} from each group advance to knockout.`;
      case "CUSTOM":
        return "Shell competition created. Add fixtures manually from the competition page.";
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Create competition"
        description={<ProgressBar step={step} />}
      />

      <div className="space-y-5 p-5">
        {notice ? (
          <p
            role={notice.kind === "err" ? "alert" : "status"}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              notice.kind === "err" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success",
            )}
          >
            {notice.text}
          </p>
        ) : null}

        {/* -------- Step 1: Format -------- */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-fg">Choose competition format</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  aria-pressed={format === opt.value}
                  className={cn(
                    "rounded-xl border-2 px-4 py-3 text-left transition-all",
                    format === opt.value
                      ? "border-brand bg-brand/10 shadow-sm"
                      : "border-line bg-bg-raised hover:border-line-strong",
                  )}
                >
                  <p className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>{opt.icon}</span>
                    <span className={cn("font-bold", format === opt.value ? "text-brand-deep" : "text-fg")}>{opt.label}</span>
                  </p>
                  <p className="mt-1 text-xs text-subtle">{opt.hint}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Next</Button>
            </div>
          </div>
        )}

        {/* -------- Step 2: Settings -------- */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Competition name" className="sm:col-span-2">
                <Input
                  value={settings.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Elite Premier League"
                  required
                />
              </Field>
              <Field label="Season">
                <Input
                  value={settings.season}
                  onChange={(e) => update("season", e.target.value)}
                  placeholder="2026/27"
                  required
                />
              </Field>
            </div>

            <Field label={`Teams (${teamCount} selected${format === "CUP" ? " — needs even count" : ""})`}>
              {/* Pick from every team, or lift the list straight out of a league table. */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => update("source", "all")}
                  aria-pressed={settings.source === "all"}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors",
                    settings.source === "all"
                      ? "border-brand bg-brand/10 text-brand-deep"
                      : "border-line bg-bg-raised text-muted hover:border-line-strong",
                  )}
                >
                  All teams
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update("source", settings.source === "all" ? "browse" : settings.source);
                    void openSources();
                  }}
                  aria-pressed={settings.source !== "all"}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors",
                    settings.source !== "all"
                      ? "border-brand bg-brand/10 text-brand-deep"
                      : "border-line bg-bg-raised text-muted hover:border-line-strong",
                  )}
                >
                  From a league table
                </button>
              </div>

              {settings.source !== "all" ? (
                <div className="space-y-2">
                  <Select
                    value={settings.source === "browse" ? "" : settings.source}
                    onChange={(e) => {
                      if (e.target.value) void loadStandings(e.target.value);
                    }}
                    aria-label="Source competition"
                  >
                    <option value="">Choose a competition…</option>
                    {(sources ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.season} ({c.teamCount} teams)
                      </option>
                    ))}
                  </Select>

                  {sourceError ? <p className="text-xs text-danger">{sourceError}</p> : null}

                  {sourceLoading ? (
                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
                      Loading the table…
                    </p>
                  ) : standings && standings.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-bg-raised text-[10px] uppercase tracking-wide text-subtle">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-bold">#</th>
                            <th className="px-2 py-1.5 text-left font-bold">Team</th>
                            <th className="px-1 py-1.5 text-right font-bold">P</th>
                            <th className="px-1 py-1.5 text-right font-bold">GD</th>
                            <th className="px-2 py-1.5 text-right font-bold">Pts</th>
                            <th className="px-2 py-1.5 text-center font-bold">Pick</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, i) => {
                            const picked = settings.teamIds.includes(row.id);
                            return (
                              <tr
                                key={row.id}
                                onClick={() => toggleTeam(row.id)}
                                className={cn(
                                  "cursor-pointer border-t border-line",
                                  picked ? "bg-brand/10" : "bg-white hover:bg-surface",
                                )}
                              >
                                <td className="px-2 py-1.5 font-black tabular-nums text-fg">{i + 1}</td>
                                <td className="max-w-[10rem] truncate px-2 py-1.5 font-semibold text-fg">
                                  {row.name}
                                  {row.left ? <span className="ml-1 text-[10px] text-subtle">(left)</span> : null}
                                </td>
                                <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.p}</td>
                                <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.gf - row.ga}</td>
                                <td className="px-2 py-1.5 text-right font-black tabular-nums text-fg">{row.pts}</td>
                                <td className="px-2 py-1.5 text-center">
                                  <span
                                    className={cn(
                                      "inline-grid size-5 place-items-center rounded border text-[10px] font-black",
                                      picked ? "border-brand bg-brand text-white" : "border-line text-subtle",
                                    )}
                                    aria-hidden
                                  >
                                    {picked ? "✓" : "+"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : standings && standings.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
                      That competition has no teams yet.
                    </p>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
                      Choose a competition to pull up its standings, then tap rows to add those teams.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTeam(t.id)}
                      aria-pressed={settings.teamIds.includes(t.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        settings.teamIds.includes(t.id)
                          ? "border-brand bg-brand/10 text-brand-deep"
                          : "border-line bg-bg-raised text-muted hover:border-line-strong",
                      )}
                    >
                      <span aria-hidden>{settings.teamIds.includes(t.id) ? "✓" : "+"}</span>
                      <span className="truncate font-medium">{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>

            {/* Format-specific settings */}
            {(format === "LEAGUE" || format === "LEAGUE_CUP") && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Rounds">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.roundsCount}
                    onChange={(e) => update("roundsCount", Math.max(1, Number(e.target.value)))}
                  />
                </Field>
                <Field label="Countdown seconds">
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={settings.countdownSecs}
                    onChange={(e) => update("countdownSecs", Math.max(5, Number(e.target.value)))}
                  />
                </Field>
              </div>
            )}

            {(format === "CUP" || format === "LEAGUE_CUP") && (
              <div className="space-y-3 rounded-xl border border-line bg-bg-raised p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                  {format === "CUP" ? "Cup rules" : "Knockout rules"}
                </p>
                <div className={cn("grid gap-3", format === "CUP" ? "sm:grid-cols-2" : "")}>
                  <Field label="Ties">
                    <Select
                      value={String(settings.legsPerTie)}
                      onChange={(e) => update("legsPerTie", Number(e.target.value) === 2 ? 2 : 1)}
                    >
                      <option value="1">1 leg — straight knockout</option>
                      <option value="2">2 legs — aggregate score</option>
                    </Select>
                  </Field>
                  {format === "CUP" ? (
                    <Field label="Seeding method">
                      <Select
                        value={settings.seedingMethod}
                        onChange={(e) => update("seedingMethod", e.target.value as "random" | "rank")}
                      >
                        <option value="rank">By rank (seed order)</option>
                        <option value="random">Random draw</option>
                      </Select>
                    </Field>
                  ) : null}
                </div>

                {format === "CUP" ? (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={settings.thirdPlace}
                      onChange={(e) => update("thirdPlace", e.target.checked)}
                      className="mt-1 size-4 accent-[var(--color-brand,#0b6b5b)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-fg">Third-place match</span>
                      <span className="block text-xs text-subtle">
                        The two semi-final losers play off once, alongside the final.
                      </span>
                    </span>
                  </label>
                ) : null}

                {settings.legsPerTie === 2 ? (
                  <p className="rounded-lg border border-brand/25 bg-brand/5 px-3 py-2 text-xs text-muted">
                    Both legs count towards the aggregate. There is <strong className="text-fg">no away-goals
                    rule</strong> — if the tie is level after the second leg it goes to a penalty shootout on that
                    leg. The final is always a single match.
                  </p>
                ) : null}
              </div>
            )}

            {format === "LEAGUE_CUP" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Number of groups">
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={settings.groupsCount}
                    onChange={(e) => update("groupsCount", Math.max(1, Number(e.target.value)))}
                  />
                </Field>
                <Field label="Teams per group">
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={settings.teamsPerGroup}
                    onChange={(e) => update("teamsPerGroup", Math.max(2, Number(e.target.value)))}
                  />
                </Field>
                <Field label="Top N advance">
                  <Input
                    type="number"
                    min={1}
                    max={settings.teamsPerGroup - 1}
                    value={settings.topAdvancing}
                    onChange={(e) => {
                      const raw = Math.max(1, Number(e.target.value));
                      const max = Math.max(1, settings.teamsPerGroup - 1);
                      update("topAdvancing", Math.min(raw, max));
                    }}
                  />
                </Field>
                {settings.groupsCount * settings.teamsPerGroup !== teamCount && (
                  <p className="sm:col-span-3 text-xs text-danger">
                    Team count must match your groups exactly: need {settings.groupsCount * settings.teamsPerGroup} but {teamCount} selected.
                  </p>
                )}
              </div>
            )}

            {format === "CUSTOM" && (
              <Field label="Countdown seconds" hint="Default countdown for matches created later">
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={settings.countdownSecs}
                  onChange={(e) => update("countdownSecs", Math.max(5, Number(e.target.value)))}
                />
              </Field>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2()}>Next</Button>
            </div>
          </div>
        )}

        {/* -------- Step 3: Preview -------- */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-fg">Preview & generate</h3>

            <div className="rounded-xl border border-line bg-bg-raised p-4 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted">Format</span>
                <span className="font-semibold text-fg">{FORMAT_OPTIONS.find((f) => f.value === format)?.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Name</span>
                <span className="font-semibold text-fg">{settings.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Season</span>
                <span className="font-semibold text-fg">{settings.season}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Teams</span>
                <span className="font-semibold text-fg">{teamCount}</span>
              </div>

              <div className="border-t border-line pt-2 mt-2">
                <p className="text-muted mb-1">Description</p>
                <p className="text-fg">{formatDescription()}</p>
              </div>

              <div className="border-t border-line pt-2 mt-2">
                <p className="text-muted mb-1">Predicted fixture count</p>
                {format === "LEAGUE" && (
                  <p className="font-semibold text-fg">
                    {predictedLeague} matches ({settings.roundsCount} round{settings.roundsCount > 1 ? "s" : ""} × {leagueFixtureCount(teamCount, 1) / Math.max(1, settings.roundsCount)} fixtures per round)
                  </p>
                )}
                {format === "CUP" && (
                  <p className="font-semibold text-fg">
                    {predictedCup} matches total — {predictedCupTies} tie{predictedCupTies === 1 ? "" : "s"} in round 1
                    {settings.legsPerTie === 2 ? ", two legs each except the final" : ""}
                    {settings.thirdPlace ? ", plus a third-place match" : ""}
                  </p>
                )}
                {format === "LEAGUE_CUP" && (
                  <p className="font-semibold text-fg">
                    {predictedGroup} group matches + {predictedKnockout} knockout matches = {predictedGroup + predictedKnockout} total
                  </p>
                )}
                {format === "CUSTOM" && (
                  <p className="text-muted italic">No fixtures — add manually from the competition page.</p>
                )}
              </div>

              {format !== "CUSTOM" && (
                <div className="border-t border-line pt-2 mt-2">
                  <p className="text-muted mb-1">Selected teams</p>
                  <div className="flex flex-wrap gap-1.5">
                    {settings.teamIds.map((id) => {
                      const team = teams.find((t) => t.id === id);
                      return team ? (
                        <span key={id} className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand-deep">
                          {team.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button
                variant="primary"
                loading={loading}
                disabled={!canProceedStep2()}
                onClick={() => void handleGenerate()}
              >
                {format === "CUSTOM" ? "Create competition" : "Create & generate fixtures"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
