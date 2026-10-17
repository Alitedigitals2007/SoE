import { PublicShell } from "@/components/site";
import { TransferRequestClient } from "./client";

export const dynamic = "force-dynamic";

export default function TransferRequestPage() {
  return (
    <PublicShell>
      <TransferRequestClient />
    </PublicShell>
  );
}
