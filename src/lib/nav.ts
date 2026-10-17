export type NavItem = { href: string; label: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/fixtures", label: "Fixtures" },
  { href: "/live", label: "Live" },
  { href: "/competitions", label: "Leagues & Cups" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
] as const;

export const SECONDARY_NAV: NavItem[] = [
  { href: "/news", label: "News" },
  { href: "/compare", label: "Compare" },
  { href: "/h2h", label: "H2H" },
  { href: "/transfer", label: "Transfer" },
  { href: "/fantasy", label: "Fantasy" },
  { href: "/bet", label: "Bet" },
] as const;

export const NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

/** Hidden behind the mobile "More" menu so the strip never scrolls. */
export const MOBILE_MORE = ["/competitions", "/teams", "/players", "/compare"] as const;
