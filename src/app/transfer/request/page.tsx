"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createTransferRequestAction, getCaptainTransferRequestsAction, getMyCaptainTeamsAction, getTeamMembersAction } from "@/app/actions/transfer";
import { Button, Card, CardHeader, cn, Field, Select, Badge } from "@/components/ui";
import { PublicShell } from "@/components/site";

type RequestRow = {
  id: string;
  status: string;
  createdAt: Date;
  player: { name: string; imageUrl: string | null };
  fromTeam: { name: string; code: string };
  toTeam: { name: string; code: string };
};

type MyTeam = { id: string; name: string; code: string };
type MyPlayer = { id: string; name: string; imageUrl: string | null };

export default function TransferRequestPage() {
  const router = useRouter();
  const [teams, setTeams] = React.useState<MyTeam[]>([]);
  const [players, setPlayers] = React.useState<MyPlayer[]>([]);
  const [requests, setRequests] = React.useState<RequestRow[]>([]);
  const [fromTeamId, setFromTeamId] = React.useState("");
  const [toTeamId, setToTeamId] = React.useState("");
  const [playerId, setPlayerId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, r] = await Promise.all([getMyCaptainTeamsAction(), getCaptainTransferRequestsAction()]);
      if (!cancelled) {
        setTeams((t.ok ? t.data : []) as MyTeam[]);
        setRequests((r.ok ? r.data : []) as RequestRow[]);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!fromTeamId) return;
    (async () => {
      const r = await getTeamMembersAction(fromTeamId);
      if (!cancelled) setPlayers((r.ok ? r.data : []) as MyPlayer[]);
    })();
    return () => { cancelled = true; };
  }, [fromTeamId]);

  function flash(r: { ok: boolean; error?: string }, okText: string) {
    if (r.ok) {
      setNotice({ kind: "ok", text: okText });
      setPlayerId("");
      setToTeamId("");
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Action failed." });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!fromTeamId || !toTeamId || !playerId) return;
    setBusy(true);
    setNotice(null);
    const r = await createTransferRequestAction({ playerId, fromTeamId, toTeamId });
    setBusy(false);
    flash(r, "Transfer request sent to admin for review.");
  }

  if (!loaded) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="text-3xl font-black tracking-tight text-fg">Request Transfer</h1>
          <p className="mt-1 text-muted">Loading…</p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Request a Transfer</h1>
        <p className="mt-1 text-muted">
          As a team captain, ask to move one of your players to another club. An admin will review and, if
          approved, the player can accept or decline the move.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader title="New transfer request" description="Pick your team, the player, and the destination club." />
            <form className="space-y-4 p-4 sm:grid-cols-3 sm:gap-4" onSubmit={onSubmit}>
              <Field label="Your team (from)">
                <Select value={fromTeamId} onChange={(e) => setFromTeamId(e.target.value)} required>
                  <option value="">Choose your team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Player to transfer">
                <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)} required disabled={!fromTeamId}>
                  <option value="">Choose a player…</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Destination team (to)">
                <Select value={toTeamId} onChange={(e) => setToTeamId(e.target.value)} required disabled={!fromTeamId}>
                  <option value="">Choose destination…</option>
                  {teams.filter((t) => t.id !== fromTeamId).map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </Select>
              </Field>
              {notice ? <div className="sm:col-span-3"><NoticeLine notice={notice} /></div> : null}
              <div className="sm:col-span-3 flex items-end">
                <Button type="submit" loading={busy} disabled={!fromTeamId || !toTeamId || !playerId || busy}>
                  Send request
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="My requests" description="Requests you have sent." />
            {requests.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No transfer requests yet.</p>
            ) : (
              <ul className="divide-y divide-line/70 p-3">
                {requests.map((r) => (
                  <li key={r.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg truncate">
                        {r.player.name} → {r.toTeam.name} ({r.toTeam.code})
                      </p>
                      <p className="text-xs text-muted">{r.fromTeam.name} · {new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge tone={r.status === "ADMIN_APPROVED" ? "warning" : r.status === "REJECTED" || r.status === "CANCELLED" ? "danger" : "neutral"}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}

function NoticeLine({ notice }: { notice: { kind: "ok" | "err"; text: string } | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.kind === "err" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        notice.kind === "err" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success",
      )}
    >
      {notice.text}
    </p>
  );
}
