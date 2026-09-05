import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => {
  class AuthError extends Error {
    type: string = "";
  }
  return { AuthError };
});

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));

vi.mock("@/lib/session", () => ({
  currentActor: vi.fn(),
}));

import { loginAction, registerAction } from "@/app/actions/auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "next-auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginAction", () => {
  it("rejects empty email", async () => {
    const result = await loginAction({ email: "", password: "pass1234" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("required");
    }
  });

  it("rejects empty password", async () => {
    const result = await loginAction({ email: "test@test.com", password: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("required");
    }
  });

  it("calls signIn with credentials", async () => {
    (signIn as any).mockResolvedValue(undefined);

    const result = await loginAction({ email: "test@test.com", password: "pass1234" });
    expect(result.ok).toBe(true);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "test@test.com",
      password: "pass1234",
      redirectTo: "/dashboard",
    });
  });

  it("trims and lowercases email", async () => {
    (signIn as any).mockResolvedValue(undefined);

    await loginAction({ email: "  TEST@Test.COM  ", password: "pass1234" });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "test@test.com",
      password: "pass1234",
      redirectTo: "/dashboard",
    });
  });

  it("returns error for CredentialsSignin", async () => {
    const error = new AuthError("test");
    error.type = "CredentialsSignin";
    (signIn as any).mockRejectedValue(error);

    const result = await loginAction({ email: "test@test.com", password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid");
    }
  });

  it("returns generic error for other AuthErrors", async () => {
    const error = new AuthError("test");
    (signIn as any).mockRejectedValue(error);

    const result = await loginAction({ email: "test@test.com", password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("try again");
    }
  });
});

describe("registerAction", () => {
  it("rejects empty name", async () => {
    const result = await registerAction({ name: "", email: "test@test.com", password: "pass1234" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("name");
    }
  });

  it("rejects invalid email", async () => {
    const result = await registerAction({ name: "John", email: "notanemail", password: "pass1234" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("valid email");
    }
  });

  it("rejects short password", async () => {
    const result = await registerAction({ name: "John", email: "test@test.com", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("8 characters");
    }
  });

  it("creates user and signs in on success", async () => {
    (prisma.user.create as any).mockResolvedValue({});
    (signIn as any).mockResolvedValue(undefined);

    const result = await registerAction({ name: "John", email: "test@test.com", password: "pass1234" });
    expect(result.ok).toBe(true);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(signIn).toHaveBeenCalled();
  });

  it("returns error for duplicate email", async () => {
    const { Prisma } = await import("@prisma/client");
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
    (prisma.user.create as any).mockRejectedValue(prismaError);

    const result = await registerAction({ name: "John", email: "test@test.com", password: "pass1234" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already exists");
    }
  });
});
