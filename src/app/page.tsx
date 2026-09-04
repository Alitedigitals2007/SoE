import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homePath } from "@/lib/authz";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(homePath(session.user.role));
}
