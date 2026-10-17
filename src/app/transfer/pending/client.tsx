"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getPlayerTransferRequestsAction, playerDecideTransferRequestAction } from "@/app/actions/transfer";
import { Button, Card, CardHeader, cn, Badge } from "@/components/ui";

type PendingRow = {
  id: string;
  status: string;
  createdAt: Date;
  captain: { name: string };
  fromTeam: { name: string; code: string };
  toTeam: { name: string; code: string };
};

export function TransferPendingClient() {
  const router = useRouter();
  const [requests, setRequests] = React.useState<PendingRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getPlayerTransferRequestsAction();
      if (!cancelled) {
        setRequests((r.ok ? r.data : []) as PendingRow[]);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onDecide(requestId: string, decision: "ACCEPT" | "DECLINE") {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const r = await playerDecideTransferRequestAction({ requestId, decision });
    setBusy(false);
    if (r.ok) {
      setNotice({ kind: "ok", text: decision === "ACCEPT" ? "Transfer accepted — you have moved clubs." : "Transfer declined." });
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Could not process your decision." });
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Transfer Decisions</h1>
        <p className="mt-1 text-muted">Loading…</p>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "ADMIN_APPROVED");
  const history = requests.filter((r) => r.status !== "ADMIN_APPROVED");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-fg">Transfer Decisions</h1>
      <p className="mt-1 text-muted">
        An admin has reviewed a transfer involving you. Accept or decline the move below.
      </p>

      <Card>
        <CardHeader title="Pending decision" description="Awaiting your answer." />
        {pending.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No transfer requests awaiting your decision.</p>
        ) : (
          <ul className="divide-y divide-line/70 p-3">
            {pending.map((r) => (
              <li key={r.id} className="px-3 py-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-fg">
                    {r.captain.name} wants to move you <span className="text-brand">from {r.fromTeam.name}</span>
                    <span className="text-muted">→</span>
                    <span className="text-brand">to {r.toTeam.name}</span>.
                  </p>
                  <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() => onDecide(r.id, "ACCEPT")}
                      variant="success"
                      disabled={busy}
                    >
                      Accept move
                    </Button>
                    <Button
                      onClick={() => onDecide(r.id, "DECLINE")}
                      variant="danger"
                      disabled={busy}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {history.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="History" description="Previously decided transfers." />
          <ul className="divide-y divide-line/70 p-3">
            {history.map((r) => (
              <li key={r.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg truncate">
                    {r.captain.name}: {r.fromTeam.name} → {r.toTeam.name}
                  </p>
                  <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge tone={r.status === "PLAYER_ACCEPTED" ? "success" : "danger"}>
                  {r.status.replace("_", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {notice ? (
        <p
          role={notice.kind === "err" ? "alert" : "status"}
          className={cn(
            "mt-4 rounded-md px-3 py-2 text-sm",
            notice.kind === "err" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success",
          )}
        >
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
