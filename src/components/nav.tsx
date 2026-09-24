"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_MORE, NAV } from "@/lib/nav";
import { cn } from "@/components/ui";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const primary = NAV.filter((n) => !(MOBILE_MORE as readonly string[]).includes(n.href));
  const more = NAV.filter((n) => (MOBILE_MORE as readonly string[]).includes(n.href));

  return (
    <div className="border-t-2 border-fg/10 bg-surface lg:hidden">
      <nav className="mx-auto flex max-w-7xl items-center gap-0.5 px-3 py-2" aria-label="Primary small screens">
        {primary.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex-1 rounded-md px-1 py-1.5 text-center text-[.62rem] font-black uppercase tracking-wider transition-colors",
              pathname === n.href || pathname.startsWith(n.href)
                ? "bg-fg text-white"
                : "text-muted hover:bg-bg-elevated hover:text-fg",
            )}
          >
            {n.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          className={cn(
            "flex-1 rounded-md px-1 py-1.5 text-center text-[.62rem] font-black uppercase tracking-wider transition-colors",
            open || more.some((n) => pathname.startsWith(n.href))
              ? "bg-fg text-white"
              : "text-muted hover:bg-bg-elevated hover:text-fg",
          )}
        >
          More {open ? "▴" : "▾"}
        </button>
      </nav>

      {open ? (
        <div className="mx-auto max-w-7xl px-3 pb-3">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border-2 border-fg/15 bg-bg-elevated p-2 shadow-[3px_3px_0_rgba(11,32,48,.08)]">
            {more.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-center text-[.68rem] font-black uppercase tracking-wider transition-colors",
                  pathname.startsWith(n.href) ? "bg-brand text-white" : "bg-surface text-muted hover:text-fg",
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
