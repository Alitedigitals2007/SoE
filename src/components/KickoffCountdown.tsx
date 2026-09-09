"use client";

import * as React from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function KickoffCountdown({ scheduledAt, label = "Kick-off in" }: { scheduledAt: string; label?: string }) {
  const target = new Date(scheduledAt).getTime();
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const diff = target - now;
  if (diff <= 0) return <span className="tabular-nums">⚽ Started</span>;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  const parts = days > 0 ? `${days}d ${pad(hours)}h` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span className="tabular-nums">
      {label} <span className="font-black text-gold">{parts}</span>
    </span>
  );
}
