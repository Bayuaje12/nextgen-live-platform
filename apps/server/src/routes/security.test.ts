import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { SAFE_ROOM_COLUMNS } from "./rooms.js";

describe("room security", () => {
  it("safe room columns never expose password_hash", () => {
    expect(SAFE_ROOM_COLUMNS).not.toContain("password_hash");
    expect(SAFE_ROOM_COLUMNS).toContain("password_protected");
  });

  it("hashes and verifies room passwords", async () => {
    const hash = await bcrypt.hash("secret123", 10);
    expect(hash).not.toBe("secret123");
    expect(await bcrypt.compare("secret123", hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });
});
