"use server";

import { prisma } from "@/lib/prisma";
import { currentActor } from "@/lib/session";
import type { ActionResult } from "@/lib/domain";

function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

async function guardAdmin() {
  const actor = await currentActor();
  if (!actor) return "Sign in to continue.";
  if (actor.role !== "ADMIN") return "Only an admin can manage news.";
  return null;
}

export type NewsInput = { title: string; excerpt: string; body: string; imageUrl?: string | null };

export async function createNewsAction(input: NewsInput): Promise<ActionResult<{ id: string }>> {
  const denied = await guardAdmin();
  if (denied) return { ok: false, error: denied };
  const title = input.title.trim();
  const excerpt = input.excerpt.trim();
  const body = input.body.trim();
  if (!title || !excerpt || !body) return { ok: false, error: "Title, excerpt and body are required." };
  if (excerpt.length > 220) return { ok: false, error: "Keep the excerpt under 220 characters." };
  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && !/^https?:\/\/.+\..+/.test(imageUrl)) return { ok: false, error: "Enter a full image URL (https://…)." };

  try {
    const base = slugify(title);
    let slug = base;
    let i = 1;
    while (await prisma.newsPost.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${base}-${Date.now().toString(36)}-${i++}`;
    }
    const post = await prisma.newsPost.create({
      data: { title, excerpt, body, imageUrl, slug, authorId: (await currentActor())!.userId },
    });
    return { ok: true, data: { id: post.id } };
  } catch (e) {
    console.error("createNewsAction failed", e);
    return { ok: false, error: "Could not publish the post." };
  }
}

export async function deleteNewsAction(id: string): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return { ok: false, error: denied };
  await prisma.newsPost.delete({ where: { id } });
  return { ok: true, data: undefined };
}

const commentCooldown = new Map<string, number>();

export type NewsCommentView = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export async function addNewsCommentAction(input: {
  slug: string;
  content: string;
  guestName?: string | null;
}): Promise<ActionResult<NewsCommentView>> {
  const content = input.content.trim();
  if (!content) return { ok: false, error: "Comment cannot be empty." };
  if (content.length > 500) return { ok: false, error: "Comment must be 500 characters or fewer." };

  const actor = await currentActor();
  const guestName = input.guestName?.trim() ?? "";
  if (!actor && !guestName) return { ok: false, error: "Sign in or leave a temporary name to comment." };
  if (!actor && guestName.length > 50) return { ok: false, error: "Temporary name must be 50 characters or fewer." };

  const post = await prisma.newsPost.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (!post) return { ok: false, error: "Post not found." };

  // Light cooldown to stop spam.
  const key = actor ? actor.userId : `guest:${guestName.toLowerCase()}`;
  const last = commentCooldown.get(key) ?? 0;
  if (Date.now() - last < 8000) return { ok: false, error: "Please wait a moment before commenting again." };
  commentCooldown.set(key, Date.now());

  const comment = await prisma.newsComment.create({
    data: {
      newsId: post.id,
      userId: actor?.userId ?? null,
      guestName: actor ? null : guestName || null,
      content,
    },
  });

  return {
    ok: true,
    data: {
      id: comment.id,
      authorName: actor ? (await prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }))?.name ?? "You" : guestName,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    },
  };
}

export async function setNewsPublishedAction(id: string, published: boolean): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return { ok: false, error: denied };
  await prisma.newsPost.update({ where: { id }, data: { published } });
  return { ok: true, data: undefined };
}
