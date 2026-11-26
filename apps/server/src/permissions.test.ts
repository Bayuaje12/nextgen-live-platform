import { describe, expect, it } from "vitest";
import {
  canApproveGuests,
  canChangeRole,
  canChat,
  canModerate,
  canPublish,
  canRemoveParticipants,
} from "./permissions.js";

describe("room permissions", () => {
  it("moderation roles can moderate", () => {
    expect(canModerate("host")).toBe(true);
    expect(canModerate("cohost")).toBe(true);
    expect(canModerate("moderator")).toBe(true);
    expect(canModerate("guest")).toBe(false);
    expect(canModerate("viewer")).toBe(false);
  });

  it("only approved/joined eligible roles can publish", () => {
    expect(canPublish({ role: "guest", status: "joined" })).toBe(true);
    expect(canPublish({ role: "guest", status: "approved" })).toBe(true);
    expect(canPublish({ role: "guest", status: "pending" })).toBe(false);
    expect(canPublish({ role: "viewer", status: "joined" })).toBe(false);
    expect(canPublish({ role: "moderator", status: "joined" })).toBe(true);
  });

  it("pending/rejected/removed cannot chat", () => {
    expect(canChat({ role: "guest", status: "joined" })).toBe(true);
    expect(canChat({ role: "guest", status: "approved" })).toBe(true);
    expect(canChat({ role: "guest", status: "pending" })).toBe(false);
    expect(canChat({ role: "guest", status: "rejected" })).toBe(false);
    expect(canChat({ role: "guest", status: "removed" })).toBe(false);
  });

  it("approval permissions", () => {
    expect(canApproveGuests("host")).toBe(true);
    expect(canApproveGuests("cohost")).toBe(true);
    expect(canApproveGuests("moderator")).toBe(true);
    expect(canApproveGuests("guest")).toBe(false);
    expect(canApproveGuests("viewer")).toBe(false);
  });

  it("removal permissions", () => {
    expect(canRemoveParticipants("host", "guest")).toBe(true);
    expect(canRemoveParticipants("host", "host")).toBe(false);
    expect(canRemoveParticipants("moderator", "cohost")).toBe(false);
    expect(canRemoveParticipants("moderator", "guest")).toBe(true);
    expect(canRemoveParticipants("cohost", "guest")).toBe(true);
    expect(canRemoveParticipants("guest", "guest")).toBe(false);
  });

  it("role changes only by host and cannot create host", () => {
    expect(canChangeRole("host", "guest", "moderator")).toBe(true);
    expect(canChangeRole("host", "guest", "cohost")).toBe(true);
    expect(canChangeRole("host", "guest", "host")).toBe(false);
    expect(canChangeRole("host", "host", "guest")).toBe(false);
    expect(canChangeRole("cohost", "guest", "moderator")).toBe(false);
    expect(canChangeRole("moderator", "guest", "viewer")).toBe(false);
  });
});
