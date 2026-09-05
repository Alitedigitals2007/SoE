"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createWizardCompetitionAction } from "@/app/actions/admin";
import {
  generateCupRoundAction,
  generateGroupFixturesAction,
  generateLeagueFixturesAction,
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
};

type Step = 1 | 2 | 3;

type Notice = { kind: "ok" | "err"; text: string } | null;

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
};

/* -------------------------------------------------------------------------- */
/*                                helper fns                                  */
/* -------------------------------------------------------------------------- */

function leagueFixtureCount(teams: number, rounds: number): number {
  if (teams < 2) return 0;
  const n = teams % 2 === 0 ? teams : teams + 1;
  return Math.floor(n / 2) * (n - 1) * rounds;
}

function cupFixtureCount(teams: number): number {
  if (teams < 2) return 0;
  return teams / 2;
}

function groupCupFixtureCount(
  teams: number,
  groups: number,
  perGroup: number,
  advance: number,
): { groupFixtures: number; knockoutFixtures: number } {
  const groupFixtures = groups * Math.floor((perGroup * (perGroup - 1)) / 2);
  const advancingTeams = groups * advance;
  const knockoutFixtures = advancingTeams >= 2 ? cupFixtureCount(advancingTeams) : 0;
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
  const predictedCup = format === "CUP" ? cupFixtureCount(teamCount) : 0;
  let predictedGroup = 0;
  let predictedKnockout = 0;
  if (format === "LEAGUE_CUP" && teamCount >= 2) {
    const g = groupCupFixtureCount(teamCount, settings.groupsCount, settings.teamsPerGroup, settings.topAdvancing);
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
      if (settings.topAdvancing < 1) return false;
      if (settings.groupsCount * settings.teamsPerGroup > settings.teamIds.length) return false;
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
        return `${teamCount} teams in a single-elimination bracket. Round 1 has ${teamCount / 2} fixtures.`;
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

            {format === "CUP" && (
              <Field label="Seeding method">
                <Select
                  value={settings.seedingMethod}
                  onChange={(e) => update("seedingMethod", e.target.value as "random" | "rank")}
                >
                  <option value="rank">By rank (seed order)</option>
                  <option value="random">Random draw</option>
                </Select>
              </Field>
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
                    onChange={(e) => update("topAdvancing", Math.max(1, Number(e.target.value)))}
                  />
                </Field>
                {settings.groupsCount * settings.teamsPerGroup > teamCount && (
                  <p className="sm:col-span-3 text-xs text-danger">
                    Not enough teams: need {settings.groupsCount * settings.teamsPerGroup} but only {teamCount} selected.
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
                    {predictedCup} matches (round 1) + {Math.max(0, predictedCup / 2)} finals
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
