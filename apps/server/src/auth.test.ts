import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ getSupabaseAdmin: () => null }));

import { hashToken, generateToken, generateGuestId } from "./guestSession.js";

describe("guest session helpers", () => {
  it("generates random guest id", () => {
    const a = generateGuestId();
    const b = generateGuestId();
    expect(a).toMatch(/^g_/);
    expect(a).not.toBe(b);
  });

  it("generates random token and stable hash", () => {
    const t = generateToken();
    expect(t.length).toBeGreaterThan(20);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(hashToken(generateToken()));
  });
});
