"use server";

import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/session";
import type { ActionResult } from "@/lib/domain";

/** Data URLs the browser sends after canvas-resizing the chosen photo. */
const ALLOWED_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
/** ≈300 KB of base64 — a 400–500px square headshot lands far below this. */
const MAX_IMAGE_BASE64 = 400_000;

export async function uploadAvatarAction(imageUrl: string): Promise<ActionResult<{ imageUrl: string | null }>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };

  const trimmed = imageUrl.trim();
  if (trimmed.length > MAX_IMAGE_BASE64)
    return { ok: false, error: "That photo is too large — pick a smaller one (it is resized automatically, so try again)." };
  if (!ALLOWED_IMAGE.test(trimmed))
    return { ok: false, error: "Only PNG, JPEG or WebP photos can be uploaded." };

  try {
    await prisma.user.update({ where: { id: actor.userId }, data: { imageUrl: trimmed } });
    return { ok: true, data: { imageUrl: trimmed } };
  } catch (e) {
    console.error("uploadAvatarAction failed", e);
    return { ok: false, error: "Could not save your photo — please try again." };
  }
}

export async function removeAvatarAction(): Promise<ActionResult<{ imageUrl: null }>> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "Sign in to continue." };
  try {
    await prisma.user.update({ where: { id: actor.userId }, data: { imageUrl: null } });
    return { ok: true, data: { imageUrl: null } };
  } catch (e) {
    console.error("removeAvatarAction failed", e);
    return { ok: false, error: "Could not remove your photo — please try again." };
  }
}
