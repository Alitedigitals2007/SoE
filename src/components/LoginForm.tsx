"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { Button, Card, Field, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <Card className="w-full max-w-sm">
      <div className="p-6">
        <div className="mb-5 text-center">
          <div aria-hidden className="mx-auto grid size-11 place-items-center rounded-lg bg-gold text-xl text-gold-ink">
            ⚽
          </div>
          <h1 className="mt-3 text-lg font-bold text-fg">
            STADIUM <span className="text-gold">OF ELITE</span>
          </h1>
          <p className="text-sm text-muted">Sign in to your account</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            void loginAction({ email, password })
              .then((res) => {
                if (res.ok) {
                  router.replace("/");
                  router.refresh();
                } else {
                  setError(res.error);
                }
              })
              .finally(() => setBusy(false));
          }}
        >
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
      </div>
    </Card>
  );
}
