"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction, registerAction } from "@/app/actions/auth";
import { Button, Card, Field, Input } from "@/components/ui";
import { SiteLogo } from "@/components/site";

export function AuthCard({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const isLogin = mode === "login";

  return (
    <Card className="w-full max-w-md">
      <div className="p-7">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-brand/10 blur-xl" />
              <span className="relative grid size-16 place-items-center rounded-2xl border-2 border-fg brand-gradient text-3xl text-white shadow-[3px_3px_0_rgba(11,32,48,.2)]">
                ⚽
              </span>
            </div>
          </div>
          <h1 className="font-display text-2xl font-black uppercase tracking-wider text-fg">
            {isLogin ? "Welcome back" : "Join the Stadium"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isLogin
              ? "Sign in to your account"
              : "Free fan account — follow competitions and manage fantasy."}
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            const action = isLogin
              ? loginAction({ email, password })
              : registerAction({ name, email, password });
            void action
              .then((res) => {
                if (res.ok) {
                  router.replace("/dashboard");
                  router.refresh();
                } else {
                  setError(res.error);
                }
              })
              .finally(() => setBusy(false));
          }}
        >
          {!isLogin ? (
            <Field label="Full name" htmlFor="name">
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ade Jones" autoComplete="name" />
            </Field>
          ) : null}
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {!isLogin ? (
            <p className="text-xs text-subtle">
              You are registering as an ordinary user/fan. You can use fantasy, profiles and comparisons;
              an admin must separately create a Player account before you can enter a match or team roster.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={busy} variant="primary">
            {isLogin ? "Sign in" : "Create free account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {isLogin ? (
            <>
              No account yet?{" "}
              <Link href="/register" className="font-semibold text-brand underline-offset-2 hover:underline">
                Register free
              </Link>
            </>
          ) : (
            <>
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
