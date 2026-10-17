import { PublicShell } from "@/components/site";
import { TransferAdminClient } from "./client";

export const dynamic = "force-dynamic";

export default function TransferAdminPage() {
  return (
    <PublicShell>
      <TransferAdminClient />
    </PublicShell>
  );
}
