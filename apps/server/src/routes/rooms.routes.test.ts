import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSupabaseAdmin } = vi.hoisted(() => ({
  mockGetSupabaseAdmin: vi.fn(),
}));

vi.mock("../supabase.js", () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

vi.mock("../guestSession.js", () => ({
  getGuestSessionFromRequest: async (req: any) => {
    const auth = req.headers.authorization;
    if (!auth) return null;
    return { id: "guest-1", guestId: "g_1", displayName: "Guest", expiresAt: new Date(Date.now() + 3600000).toISOString() };
  },
  requireGuestSession: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    req.guestSession = { id: "guest-1", guestId: "g_1", displayName: "Guest", expiresAt: new Date(Date.now() + 3600000).toISOString() };
  },
}));

import { roomRoutes } from "./rooms.js";

describe("room routes (accountless)", () => {
  beforeEach(() => {
    mockGetSupabaseAdmin.mockReset();
  });

  it("returns 503 when supabase not configured", async () => {
    mockGetSupabaseAdmin.mockReturnValue(null);
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "GET", url: "/rooms" });
    expect(res.statusCode).toBe(503);
  });

  it("rejects room creation without guest session", async () => {
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "POST", url: "/rooms", payload: { title: "Test room" } });
    expect(res.statusCode).toBe(401);
  });

  it("rejects lock without guest session", async () => {
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "POST", url: "/rooms/test-room/lock", payload: { locked: true } });
    expect(res.statusCode).toBe(401);
  });

  it("rejects member review without guest session", async () => {
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "POST", url: "/rooms/test-room/members/11111111-1111-1111-1111-111111111111/review", payload: { action: "approve" } });
    expect(res.statusCode).toBe(401);
  });

  it("rejects chat post without guest session", async () => {
    mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "POST", url: "/rooms/test-room/chat", payload: { content: "hi" } });
    expect(res.statusCode).toBe(401);
  });
});
