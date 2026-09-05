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
    <Card className="w-full max-w-md overflow-hidden">
      <div className="p-7">
        {/* Crest header with pop animation */}
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="animate-pop relative">
              <div className="absolute -inset-3 rounded-full bg-brand/10 blur-xl" />
              <span className="relative grid size-16 place-items-center rounded-2xl border-2 border-fg brand-gradient text-3xl text-white shadow-[3px_3px_0_rgba(11,32,48,.2)]">
                ⚽
              </span>
              {/* Orbiting dot */}
              <span className="absolute -right-1 -top-1 size-3 animate-pulse-brand rounded-full border-2 border-white bg-gold" />
            </div>
          </div>
          <h1 className="animate-fade-up font-display text-2xl font-black uppercase tracking-wider text-fg" style={{ animationDelay: "0.3s" }}>
            {isLogin ? "Welcome back" : "Join the Stadium"}
          </h1>
          <p className="animate-fade-in mt-1 text-sm text-muted" style={{ animationDelay: "0.45s" }}>
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
            <div className="animate-fade-up" style={{ animationDelay: "0.35s" }}>
              <Field label="Full name" htmlFor="name">
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ade Jones" autoComplete="name" />
              </Field>
            </div>
          ) : null}
          <div className="animate-fade-up" style={{ animationDelay: isLogin ? "0.35s" : "0.42s" }}>
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
          </div>
          <div className="animate-fade-up" style={{ animationDelay: isLogin ? "0.42s" : "0.49s" }}>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>
          {!isLogin ? (
            <p className="text-xs text-subtle">
              You are registering as an ordinary user/fan. You can use fantasy, profiles and comparisons;
              an admin must separately create a Player account before you can enter a match or team roster.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="animate-fade-up rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="animate-fade-up" style={{ animationDelay: isLogin ? "0.5s" : "0.56s" }}>
            <Button type="submit" className="w-full" loading={busy} variant="primary">
              {isLogin ? "Sign in" : "Create free account"}
            </Button>
          </div>
        </form>

        <p className="animate-fade-in mt-5 text-center text-sm text-muted" style={{ animationDelay: "0.6s" }}>
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
