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

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result.ok && result.data) {
        const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} loading={busy}>
      {label}
    </Button>
  );
}
