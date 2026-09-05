"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Pagination } from "@/components/Pagination";

interface UrlPaginationProps {
  page: number;
  totalPages: number;
  paramKey?: string;
  basePath?: string;
}

export function UrlPagination({ page, totalPages, paramKey = "page", basePath }: UrlPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (p === 1) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, String(p));
      }
      const qs = params.toString();
      router.push(qs ? `${basePath ?? ""}?${qs}` : basePath ?? "/");
    },
    [router, searchParams, paramKey, basePath],
  );

  return <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />;
}
