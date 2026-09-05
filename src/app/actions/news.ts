"use server";

import { Prisma } from "@prisma/client";
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
    const post = await prisma.newsPost.create({
      data: { title, excerpt, body, imageUrl, slug: slugify(title), authorId: (await currentActor())!.userId },
    });
    return { ok: true, data: { id: post.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.newsPost.findUnique({ where: { slug: slugify(title) } });
      const post = await prisma.newsPost.create({
        data: {
          title,
          excerpt,
          body,
          imageUrl,
          slug: `${slugify(title)}-${Date.now().toString(36)}`,
          authorId: (await currentActor())!.userId,
        },
      });
      void existing;
      return { ok: true, data: { id: post.id } };
    }
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

export async function setNewsPublishedAction(id: string, published: boolean): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return { ok: false, error: denied };
  await prisma.newsPost.update({ where: { id }, data: { published } });
  return { ok: true, data: undefined };
}
