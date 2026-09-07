"use client";

import * as React from "react";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/domain";

export function CsvDownloadButton({
  label,
  action,
  filename,
}: {
  label: string;
  action: () => Promise<ActionResult<string>>;
  filename: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.ok && result.data) {
        const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (!result.ok) {
        setError(result.error ?? "Export failed.");
      }
    } catch {
      setError("Export failed — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="secondary" size="sm" onClick={handleClick} loading={busy}>
        {label}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
