export const NAV = [
  { href: "/fixtures", label: "Fixtures" },
  { href: "/live", label: "Live" },
  { href: "/news", label: "News" },
  { href: "/competitions", label: "Leagues & Cups" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/compare", label: "Compare" },
  { href: "/fantasy", label: "Fantasy" },
  { href: "/bet", label: "Bet" },
] as const;

/** Hidden behind the mobile "More" menu so the strip never scrolls. */
export const MOBILE_MORE = ["/competitions", "/teams", "/players", "/compare"] as const;
