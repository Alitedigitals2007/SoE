import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl" aria-hidden>
        🏟️
      </p>
      <h1 className="text-2xl font-black uppercase tracking-wide text-fg">Not found</h1>
      <p className="max-w-sm text-sm text-muted">
        That page, match or code does not exist — check the link and try again.
      </p>
      <Link href="/" className="text-sm font-medium text-gold hover:underline">
        Back to the Stadium
      </Link>
    </main>
  );
}
