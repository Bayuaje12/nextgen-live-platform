import { describe, expect, it } from "vitest";
import { z } from "zod";

const guestSessionSchema = z.object({ displayName: z.string().max(80).optional().nullable() });
const chatSchema = z.object({ content: z.string().min(1).max(1000), displayName: z.string().max(80).optional() });

describe("accountless validation", () => {
  it("accepts guest session without display name", () => {
    expect(guestSessionSchema.safeParse({}).success).toBe(true);
  });
  it("accepts guest session with display name", () => {
    expect(guestSessionSchema.safeParse({ displayName: "Bayu" }).success).toBe(true);
  });
  it("rejects too long display name", () => {
    expect(guestSessionSchema.safeParse({ displayName: "x".repeat(81) }).success).toBe(false);
  });
  it("accepts valid chat message", () => {
    expect(chatSchema.safeParse({ content: "hello" }).success).toBe(true);
  });
  it("rejects empty chat message", () => {
    expect(chatSchema.safeParse({ content: "" }).success).toBe(false);
  });
});
