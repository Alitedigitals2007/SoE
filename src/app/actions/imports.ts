"use server";

import { currentActor } from "@/lib/session";
import { commitImport, previewImport } from "@/lib/imports/service";
import type { ImportCommitResult, ImportKind, ImportPreview } from "@/lib/imports/types";
import type { ImportActionResult } from "@/lib/imports/service";

function isAdmin(role: string | undefined): boolean {
  return role === "ADMIN";
}

export async function previewImportAction(
  kind: ImportKind,
  csv: string,
): Promise<ImportActionResult<ImportPreview>> {
  const actor = await currentActor();
  if (!isAdmin(actor?.role)) return { ok: false, error: "Only admins can import data.", issues: [] };
  if (csv.length > 2_000_000) return { ok: false, error: "CSV file is too large. Keep imports under 2 MB.", issues: [] };
  try {
    return { ok: true, data: await previewImport(kind, csv) };
  } catch (error) {
    console.error("previewImportAction failed", error);
    return { ok: false, error: "Could not validate this CSV.", issues: [] };
  }
}

export async function commitImportAction(
  kind: ImportKind,
  csv: string,
): Promise<ImportActionResult<ImportCommitResult>> {
  const actor = await currentActor();
  if (!isAdmin(actor?.role)) return { ok: false, error: "Only admins can import data.", issues: [] };
  if (csv.length > 2_000_000) return { ok: false, error: "CSV file is too large. Keep imports under 2 MB.", issues: [] };
  return commitImport(kind, csv);
}
