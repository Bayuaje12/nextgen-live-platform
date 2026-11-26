import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSupabaseAdmin } = vi.hoisted(() => ({
  mockGetSupabaseAdmin: vi.fn(),
}));

vi.mock("../supabase.js", () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

vi.mock("../auth.js", () => ({
  requireAuth: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    req.authUser = { id: "user-1", role: "user" };
  },
  requireAdmin: async (req: any, reply: any) => {
    if (req.authUser?.role !== "admin") return reply.code(403).send({ error: "forbidden" });
  },
}));

import { roomRoutes } from "./rooms.js";

function makeSupabase() {
  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq: any = vi.fn().mockReturnValue({ single, eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) });
  const order = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) });
  const select = vi.fn().mockReturnValue({ eq, order, single });
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const from = vi.fn().mockReturnValue({ select, insert, update });
  return { from, auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) } };
}

describe("room routes", () => {
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

  it("rejects room creation without auth", async () => {
    mockGetSupabaseAdmin.mockReturnValue(makeSupabase());
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "POST", url: "/rooms", payload: { title: "Test room" } });
    expect(res.statusCode).toBe(401);
  });

  it("rejects lock without auth", async () => {
    mockGetSupabaseAdmin.mockReturnValue(makeSupabase());
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "POST", url: "/rooms/test-room/lock", payload: { locked: true } });
    expect(res.statusCode).toBe(401);
  });

  it("rejects member review without auth", async () => {
    mockGetSupabaseAdmin.mockReturnValue(makeSupabase());
    const app = Fastify();
    await app.register(roomRoutes);
    const res = await app.inject({ method: "POST", url: "/rooms/test-room/members/11111111-1111-1111-1111-111111111111/review", payload: { action: "approve" } });
    expect(res.statusCode).toBe(401);
  });
});
