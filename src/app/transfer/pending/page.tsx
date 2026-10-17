import { PublicShell } from "@/components/site";
import { TransferPendingClient } from "./client";

export const dynamic = "force-dynamic";

export default function TransferPendingPage() {
  return (
    <PublicShell>
      <TransferPendingClient />
    </PublicShell>
  );
}
