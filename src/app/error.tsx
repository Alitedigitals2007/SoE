"use client";

import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="stadium-glow flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p aria-hidden className="text-5xl">
        ⚽
      </p>
      <h1 className="text-2xl font-black uppercase tracking-wide text-fg">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-muted">
        {error.message || "An unexpected error interrupted the match. Your data is safe — try again."}
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
