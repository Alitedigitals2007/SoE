import type { ReactNode } from "react";
import { requireRole } from "@/lib/authz";
import { TopBar } from "@/components/app";
import { AdminNav } from "@/components/admin";

export const dynamic = "force-dynamic";

/**
 * One shell for every admin screen: the top bar, section tabs and the
 * ADMIN guard, so individual pages only render their own content.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(["ADMIN"]);
  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <AdminNav />
      {children}
    </>
  );
}
