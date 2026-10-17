"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getAllTransferRequestsAction, adminDecideTransferRequestAction } from "@/app/actions/transfer";
import { Button, Card, CardHeader, cn, Field, Input, Select, Badge } from "@/components/ui";

type RequestRow = {
  id: string;
  status: string;
  createdAt: Date;
  captain: { name: string };
  player: { name: string; imageUrl: string | null };
  fromTeam: { name: string; code: string };
  toTeam: { name: string; code: string };
  decidedByUser: { name: string } | null;
  adminNote: string | null;
};

type PendingProps = {
  r: RequestRow;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  decision: "APPROVE" | "REJECT";
  setDecision: (v: "APPROVE" | "REJECT") => void;
  note: string;
  setNote: (v: string) => void;
  onDecide: (id: string) => void;
  busy: boolean;
};

function PendingItem({
  r,
  openId,
  setOpenId,
  decision,
  setDecision,
  note,
  setNote,
  onDecide,
  busy,
}: PendingProps) {
  const isOpen = openId === r.id;
  return (
    <li className="px-3 py-3">
      <div className="space-y-2">
        <p className="text-sm font-medium text-fg">
          {r.captain.name} wants to move <span className="text-brand">{r.player.name}</span>
          <span className="text-muted"> from {r.fromTeam.name}</span>
          <span className="text-muted"> → </span>
          <span className="text-brand">to {r.toTeam.name}</span>.
        </p>
        <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</p>
        <div className="mt-3 flex items-end gap-2">
          <Button
            onClick={() => {
              setOpenId(r.id);
              setDecision("APPROVE");
              setNote("");
            }}
            size="sm"
          >
            Approve
          </Button>
          <Button
            onClick={() => {
              setOpenId(r.id);
              setDecision("REJECT");
              setNote("");
            }}
            size="sm"
            variant="danger"
          >
            Reject
          </Button>
        </div>
        {isOpen ? (
          <div className="mt-3 pt-3 border-t border-line/60 space-y-2">
            <Field label="Decision">
              <Select value={decision} onChange={(e) => setDecision(e.target.value as "APPROVE" | "REJECT")}>
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
              </Select>
            </Field>
            <Field label="Admin note (optional)">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for your decision…" />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onDecide(r.id)} loading={busy}>
                Save decision
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function TransferAdminClient() {
  const router = useRouter();
  const [requests, setRequests] = React.useState<RequestRow[]>([]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState<"APPROVE" | "REJECT">("APPROVE");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getAllTransferRequestsAction();
      if (!cancelled) {
        setRequests((r.ok ? r.data : []) as RequestRow[]);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onDecide(requestId: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const res = await adminDecideTransferRequestAction({ requestId, decision, note: note || undefined });
    setBusy(false);
    if (res.ok) {
      setNotice({ kind: "ok", text: decision === "APPROVE" ? "Transfer approved. Awaiting player decision." : "Transfer rejected." });
      setOpenId(null);
      setDecision("APPROVE");
      setNote("");
      router.refresh();
    } else {
      setNotice({ kind: "err", text: res.error ?? "Could not decide on the request." });
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Transfer Requests</h1>
        <p className="mt-1 text-muted">Loading…</p>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-fg">Transfer Requests</h1>
      <p className="mt-1 text-muted">
        Review captain-initiated transfer requests. Approve to let the player decide, or reject to close it.
      </p>

      <div className="mt-6 space-y-4">
        <Card>
          <CardHeader title={`Pending requests (${pending.length})`} description="Awaiting your review." />
          {pending.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No pending transfer requests.</p>
          ) : (
            <ul className="divide-y divide-line/70 p-3">
              {pending.map((r) => (
                <PendingItem
                  key={r.id}
                  r={r}
                  openId={openId}
                  setOpenId={setOpenId}
                  decision={decision}
                  setDecision={setDecision}
                  note={note}
                  setNote={setNote}
                  onDecide={onDecide}
                  busy={busy && openId === r.id}
                />
              ))}
            </ul>
          )}
        </Card>

        {decided.length > 0 ? (
          <Card>
            <CardHeader title="Decided" description="Previously reviewed transfers." />
            <ul className="divide-y divide-line/70 p-3">
              {decided.map((r) => (
                <li key={r.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {r.captain.name}: {r.player.name} — {r.fromTeam.name} → {r.toTeam.name}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(r.createdAt).toLocaleDateString()}
                      {r.decidedByUser ? ` · decided by ${r.decidedByUser.name}` : ""}
                    </p>
                    {r.adminNote ? <p className="mt-1 text-xs text-muted line-clamp-1">{r.adminNote}</p> : null}
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
              "rounded-md px-3 py-2 text-sm",
              notice.kind === "err" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success",
            )}
          >
            {notice.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
