import { describe, expect, it } from "vitest";
import { z } from "zod";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const signupSchema = z.object({
  username: z.string().min(3).max(30).regex(USERNAME_RE),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80).optional(),
});
const loginSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
});

describe("auth validation", () => {
  it("accepts valid username signup", () => {
    const r = signupSchema.safeParse({ username: "Bayu_01", password: "password123" });
    expect(r.success).toBe(true);
  });
  it("rejects short username", () => {
    expect(signupSchema.safeParse({ username: "ab", password: "password123" }).success).toBe(false);
  });
  it("rejects invalid username chars", () => {
    expect(signupSchema.safeParse({ username: "bad name", password: "password123" }).success).toBe(false);
  });
  it("rejects short password", () => {
    expect(signupSchema.safeParse({ username: "validname", password: "short" }).success).toBe(false);
  });
  it("accepts login payload", () => {
    expect(loginSchema.safeParse({ username: "user1", password: "password123" }).success).toBe(true);
  });
});
