import { PageSpinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <PageSpinner label="Loading the Stadium…" />
    </div>
  );
}
