"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { backfillMotmAction } from "@/app/actions/admin";
import { Button } from "@/components/ui";

/** Runs the automatic-MOTM backfill for finished matches without one. */
export function MotmBackfillButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    setError(null);
    const r = await backfillMotmAction();
    setBusy(false);
    if (r.ok) {
      setResult(`Done — ${r.data.filled} of ${r.data.considered} pending match(es) gained a MOTM.`);
      router.refresh();
    } else {
      setError(r.error);
    }
  }

  return (
    <div>
      <Button variant="ghost" loading={busy} onClick={() => void run()}>
        🏅 Backfill automatic MOTM
      </Button>
      {result ? <p className="mt-1 text-[11px] font-medium text-success">{result}</p> : null}
      {error ? <p className="mt-1 text-[11px] font-medium text-danger">{error}</p> : null}
    </div>
  );
}
