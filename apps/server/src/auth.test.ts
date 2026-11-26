import { describe, expect, it, vi } from "vitest";
import { requireAdmin } from "./auth.js";

function mockReply() {
  const reply: any = {};
  reply.code = vi.fn(() => reply);
  reply.send = vi.fn(() => reply);
  return reply;
}

describe("requireAdmin", () => {
  it("rejects unauthenticated request", async () => {
    const req: any = {};
    const reply = mockReply();
    await requireAdmin(req, reply);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it("rejects non-admin user", async () => {
    const req: any = { authUser: { id: "u1", role: "user" } };
    const reply = mockReply();
    await requireAdmin(req, reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it("allows admin user", async () => {
    const req: any = { authUser: { id: "u1", role: "admin" } };
    const reply = mockReply();
    const result = await requireAdmin(req, reply);
    expect(reply.code).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
