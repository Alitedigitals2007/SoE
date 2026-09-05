"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/Pagination";

interface FixturesPaginationProps {
  section: string;
  page: number;
  totalPages: number;
}

export function FixturesPagination({ section, page, totalPages }: FixturesPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handlePageChange(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(`${section}Page`, String(p));
    router.push(`/fixtures?${params.toString()}`);
  }

  return <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />;
}
