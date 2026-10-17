"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getAllTransferRequestsAction, adminDecideTransferRequestAction } from "@/app/actions/transfer";
import {
  createTransferWindowAction,
  deleteTransferWindowAction,
  getTransferWindowsAction,
  setTransferWindowStatusAction,
} from "@/app/actions/transferWindow";
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

type WindowRow = {
  id: string;
  season: string;
  name: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  openAt: Date | null;
  closeAt: Date | null;
  createdAt: Date;
  listingCount: number;
  active: boolean;
};

function toLocalInput(value: Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------ window manager ------------------------------ */

function TransferWindowPanel() {
  const router = useRouter();
  const [windows, setWindows] = React.useState<WindowRow[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [season, setSeason] = React.useState("");
  const [name, setName] = React.useState("");
  const [closeAt, setCloseAt] = React.useState("");
  const [openNow, setOpenNow] = React.useState(true);
  const [rowClose, setRowClose] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function reload() {
    const r = await getTransferWindowsAction();
    if (r.ok) {
      const rows = (r.data ?? []) as WindowRow[];
      setWindows(rows);
      setRowClose(Object.fromEntries(rows.map((w) => [w.id, toLocalInput(w.closeAt)])));
    }
    setLoaded(true);
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getTransferWindowsAction();
      if (cancelled) return;
      if (r.ok) {
        const rows = (r.data ?? []) as WindowRow[];
        setWindows(rows);
        setRowClose(Object.fromEntries(rows.map((w) => [w.id, toLocalInput(w.closeAt)])));
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const active = windows.find((w) => w.active) ?? null;

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setNotice(null);
    const r = await createTransferWindowAction({
      season,
      name,
      closeAt: closeAt || undefined,
      openImmediately: openNow,
    });
    setCreating(false);
    if (r.ok) {
      setNotice({ kind: "ok", text: openNow ? "Window created and opened." : "Window created as draft." });
      setSeason("");
      setName("");
      setCloseAt("");
      await reload();
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Could not create the window." });
    }
  }

  async function setStatus(w: WindowRow, status: "DRAFT" | "OPEN" | "CLOSED") {
    if (busyId) return;
    setBusyId(w.id);
    setNotice(null);
    const r = await setTransferWindowStatusAction({
      windowId: w.id,
      status,
      closeAt: rowClose[w.id] ?? undefined,
    });
    setBusyId(null);
    if (r.ok) {
      setNotice({ kind: "ok", text: status === "OPEN" ? "Transfer window is now OPEN." : status === "CLOSED" ? "Transfer window closed." : "Window moved back to draft." });
      await reload();
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Could not update the window." });
    }
  }

  async function remove(w: WindowRow) {
    if (busyId) return;
    if (!window.confirm(`Delete “${w.name}” and its ${w.listingCount} listing(s)?`)) return;
    setBusyId(w.id);
    setNotice(null);
    const r = await deleteTransferWindowAction(w.id);
    setBusyId(null);
    if (r.ok) {
      setNotice({ kind: "ok", text: "Window deleted." });
      await reload();
      router.refresh();
    } else {
      setNotice({ kind: "err", text: r.error ?? "Could not delete the window." });
    }
  }

  return (
    <Card>
      <CardHeader
        title="Transfer window"
        description="Open a window so captains can request transfers. Requests and completed moves are only allowed while a window is open."
        aside={
          active ? (
            <Badge tone="success">Open · {active.name}</Badge>
          ) : (
            <Badge tone="warning">Closed</Badge>
          )
        }
      />
      <div className="space-y-4 p-4">
        {active ? (
          <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            <span className="font-bold">{active.season} {active.name}</span> is open
            {active.closeAt ? ` — closes ${formatDate(active.closeAt)}` : " — no closing date set"}.
          </p>
        ) : (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            No transfer window is open. Captains cannot submit requests and players cannot complete moves.
          </p>
        )}

        <form className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={onCreate}>
          <Field label="Season">
            <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026/27" required />
          </Field>
          <Field label="Window name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer 2026" required />
          </Field>
          <Field label="Closes (optional)">
            <Input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
          </Field>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-fg">
              <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} />
              Open now
            </label>
            <Button type="submit" loading={creating}>
              Create
            </Button>
          </div>
        </form>

        {notice ? (
          <p
            role={notice.kind === "err" ? "alert" : "status"}
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              notice.kind === "err" ? "border border-danger/40 bg-danger/10 text-danger" : "border border-success/40 bg-success/10 text-success",
            )}
          >
            {notice.text}
          </p>
        ) : null}

        <div className="border-t border-line pt-4">
          <p className="text-xs font-black uppercase tracking-wider text-muted">
            All windows ({windows.length})
          </p>
          {!loaded ? (
            <p className="mt-3 text-sm text-muted">Loading windows…</p>
          ) : windows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No transfer windows yet — create the first one above.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70">
              {windows.map((w) => (
                <li key={w.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-fg">
                      {w.season} · {w.name}
                      <span className="ml-2 align-middle">
                        <Badge tone={w.active ? "success" : w.status === "CLOSED" ? "neutral" : "warning"}>
                          {w.active ? "OPEN" : w.status}
                        </Badge>
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      Opened {formatDate(w.openAt)} · Closes {formatDate(w.closeAt)} · {w.listingCount} listing{w.listingCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {w.status !== "OPEN" ? (
                      <Input
                        type="datetime-local"
                        value={rowClose[w.id] ?? ""}
                        onChange={(e) => setRowClose((prev) => ({ ...prev, [w.id]: e.target.value }))}
                        aria-label={`Close date for ${w.name}`}
                        className="w-52"
                      />
                    ) : null}
                    {w.active ? (
                      <Button size="sm" variant="danger" loading={busyId === w.id} onClick={() => setStatus(w, "CLOSED")}>
                        Close window
                      </Button>
                    ) : (
                      <Button size="sm" variant="success" loading={busyId === w.id} onClick={() => setStatus(w, "OPEN")}>
                        Open window
                      </Button>
                    )}
                    {w.status !== "OPEN" ? (
                      <Button size="sm" variant="ghost" loading={busyId === w.id} onClick={() => remove(w)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ requests review ------------------------------ */

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
        Open or close the transfer window, then review captain-initiated transfer requests. Approve to let the
        player decide, or reject to close it.
      </p>

      <div className="mt-6 space-y-4">
        <TransferWindowPanel />

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
