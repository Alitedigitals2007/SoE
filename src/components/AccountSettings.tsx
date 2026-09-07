"use client";

import * as React from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { Button, Card, CardHeader, Field, Input, cn } from "@/components/ui";

type Notice = { kind: "ok" | "err"; text: string } | null;

export function AccountSettings({ name, email }: { name: string; email: string }) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="h-fit">
        <CardHeader title="Profile" description="Your sign-in identity." />
        <dl className="space-y-3 p-5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Name</dt>
            <dd className="font-semibold text-fg">{name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Email</dt>
            <dd className="font-semibold text-fg">{email}</dd>
          </div>
        </dl>
      </Card>

      <Card className="h-fit">
        <CardHeader title="Change password" description="Pick a new password. You’ll keep using your current email to sign in." />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            if (next !== confirm) {
              setNotice({ kind: "err", text: "The new password and confirmation do not match." });
              return;
            }
            setBusy(true);
            setNotice(null);
            void changePasswordAction({ currentPassword: current, newPassword: next }).then((r) => {
              setBusy(false);
              if (r.ok) {
                setCurrent("");
                setNext("");
                setConfirm("");
                setNotice({ kind: "ok", text: "Password updated." });
              } else {
                setNotice({ kind: "err", text: r.error });
              }
            });
          }}
        >
          <Field label="Current password" htmlFor="pw-current">
            <Input id="pw-current" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password" htmlFor="pw-next" hint="At least 8 characters.">
            <Input id="pw-next" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm">
            <Input id="pw-confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={busy}>
            Update password
          </Button>
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
        </form>
      </Card>
    </div>
  );
}
