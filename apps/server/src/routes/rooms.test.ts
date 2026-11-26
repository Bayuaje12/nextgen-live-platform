import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirror validation schema from rooms route for unit testing.
const createRoomSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  visibility: z.enum(["public", "private"]).default("private"),
  template: z
    .enum(["live", "conference", "podcast", "gaming", "webinar", "classroom", "interview", "event"])
    .default("live"),
  password: z.string().min(4).max(128).optional(),
  waitingRoomEnabled: z.boolean().default(true),
  maxParticipants: z.number().int().min(2).max(50).default(12),
  scheduledFor: z.string().datetime().optional(),
});

describe("room validation", () => {
  it("accepts valid room payload", () => {
    const result = createRoomSchema.safeParse({ title: "My Room", visibility: "public", template: "live" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.waitingRoomEnabled).toBe(true);
      expect(result.data.maxParticipants).toBe(12);
    }
  });

  it("rejects short title", () => {
    const result = createRoomSchema.safeParse({ title: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid visibility", () => {
    const result = createRoomSchema.safeParse({ title: "Room", visibility: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects too many participants", () => {
    const result = createRoomSchema.safeParse({ title: "Room", maxParticipants: 500 });
    expect(result.success).toBe(false);
  });

  it("rejects short password when provided", () => {
    const result = createRoomSchema.safeParse({ title: "Room", password: "123" });
    expect(result.success).toBe(false);
  });
});
