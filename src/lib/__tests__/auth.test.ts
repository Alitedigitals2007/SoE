import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import { homePath, requireRole, type SessionUser } from "@/lib/authz";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("homePath", () => {
  it("returns /admin for ADMIN", () => {
    expect(homePath("ADMIN")).toBe("/admin");
  });

  it("returns /referee for REFEREE", () => {
    expect(homePath("REFEREE")).toBe("/referee");
  });

  it("returns /player for PLAYER", () => {
    expect(homePath("PLAYER")).toBe("/player");
  });

  it("returns /fantasy for USER", () => {
    expect(homePath("USER")).toBe("/fantasy");
  });
});

describe("requireRole", () => {
  it("returns user when session is valid", async () => {
    const mockUser: SessionUser = { id: "u1", role: "ADMIN", name: "Admin", email: "a@b.com" };
    (auth as any).mockResolvedValue({ user: mockUser });

    const user = await requireRole(["ADMIN"]);
    expect(user).toEqual(mockUser);
  });

  it("redirects to /login when no session", async () => {
    (auth as any).mockResolvedValue(null);

    await expect(requireRole()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to home when role not in allowed list", async () => {
    const mockUser: SessionUser = { id: "u1", role: "PLAYER", name: "Player", email: "p@b.com" };
    (auth as any).mockResolvedValue({ user: mockUser });

    await expect(requireRole(["ADMIN"])).rejects.toThrow("REDIRECT:/player");
  });

  it("allows any role when roles array is empty", async () => {
    const mockUser: SessionUser = { id: "u1", role: "USER", name: "User", email: "u@b.com" };
    (auth as any).mockResolvedValue({ user: mockUser });

    const user = await requireRole([]);
    expect(user).toEqual(mockUser);
  });
});
