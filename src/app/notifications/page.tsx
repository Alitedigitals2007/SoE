import Link from "next/link";
import { auth } from "@/auth";
import { homePath } from "@/lib/authz";
import { listNotifications, unreadCount } from "@/lib/notify";
import { PublicShell } from "@/components/site";
import { NotificationsPanel } from "@/components/NotificationsPanel";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  const user = session?.user ?? null;
  const items = user ? await listNotifications(user.id) : [];
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-fg">Notifications</h1>
            <p className="mt-1 text-muted">
              {unread > 0 ? `${unread} unread` : "You're all caught up"} ·{" "}
              {user?.name.split(" ")[0]}
            </p>
          </div>
          <Link href={user ? homePath(user.role) : "/"} className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
            ← Back
          </Link>
        </div>
        <div className="mt-6">
          <NotificationsPanel initial={items} />
        </div>
      </div>
    </PublicShell>
  );
}
