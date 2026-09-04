import { requireRole, homePath } from "@/lib/authz";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardIndex() {
  const user = await requireRole();
  redirect(homePath(user.role));
}
