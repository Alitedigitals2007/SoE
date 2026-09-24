"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { adminAdjustWalletAction } from "@/app/actions/platform";
import { Button, Input, Select, cn } from "@/components/ui";

export type WalletUser = { id: string; name: string; balance: number };

const QUICK: { label: string; amount: number }[] = [
  { label: "+20", amount: 20 },
  { label: "+100", amount: 100 },
  { label: "+500", amount: 500 },
  { label: "−50", amount: -50 },
];

export function WalletAdjust({ users }: { users: WalletUser[] }) {
  const router = useRouter();
  const [userId, setUserId] = React.useState(users[0]?.id ?? "");
  const [amountStr, setAmountStr] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const amount = Math.floor(Number(amountStr)) || 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!userId) {
      setMsg({ ok: false, text: "Pick a user first." });
      return;
    }
    if (amount === 0) {
      setMsg({ ok: false, text: "Enter a non-zero amount — e.g. 50 or −50." });
      return;
    }
    setBusy(true);
    try {
      const r = await adminAdjustWalletAction({ userId, amount, note: note.trim() || undefined });
      if (r.ok) {
        setMsg({ ok: true, text: `Done — balance is now ${r.data.balance} pts.` });
        setAmountStr("");
        setNote("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: "Something went wrong — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-b border-line/70 bg-surface/60 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-fg">Adjust a wallet</p>
      <p className="mt-0.5 text-xs text-muted">Credit or debit virtual points — every change lands in the user&apos;s history.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_auto]">
        <label className="block text-xs font-semibold text-muted">
          User
          <Select className="mt-1" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.length === 0 ? <option value="">No users yet</option> : null}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.balance} pts
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-xs font-semibold text-muted">
          Amount (points)
          <Input
            className="mt-1"
            type="number"
            inputMode="numeric"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="e.g. 50 or -50"
          />
        </label>
        <div className="flex items-end gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setAmountStr(String((Math.floor(Number(amountStr)) || 0) + q.amount))}
              className="h-10 rounded-lg border border-line bg-bg-elevated px-2.5 text-xs font-black tabular-nums text-muted transition-colors hover:border-brand/50 hover:text-fg"
            >
              {q.label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-semibold text-muted sm:col-span-2 lg:col-span-3">
          Note (optional)
          <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Matchday giveaway" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" loading={busy}>
          Apply adjustment
        </Button>
        {msg ? (
          <p role="alert" className={cn("text-xs font-semibold", msg.ok ? "text-success" : "text-danger")}>
            {msg.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
