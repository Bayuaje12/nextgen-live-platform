export type RoomRole = "host" | "cohost" | "moderator" | "guest" | "viewer";
export type MemberStatus = "pending" | "approved" | "rejected" | "joined" | "left" | "removed";

export interface RoomMemberLike {
  userId?: string | null;
  role: RoomRole;
  status: MemberStatus;
}

export function canModerate(role: RoomRole) {
  return role === "host" || role === "cohost" || role === "moderator";
}

export function canManageRoom(role: RoomRole) {
  return role === "host" || role === "cohost";
}

export function canPublish(member: RoomMemberLike) {
  return (member.status === "joined" || member.status === "approved") && ["host", "cohost", "moderator", "guest"].includes(member.role);
}

export function canChat(member: RoomMemberLike) {
  return member.status === "joined" || member.status === "approved";
}

export function canApproveGuests(role: RoomRole) {
  return role === "host" || role === "cohost" || role === "moderator";
}

export function canRemoveParticipants(actorRole: RoomRole, targetRole: RoomRole) {
  if (actorRole === "host") return targetRole !== "host";
  if (actorRole === "cohost") return ["guest", "viewer"].includes(targetRole);
  if (actorRole === "moderator") return ["guest", "viewer"].includes(targetRole);
  return false;
}

export function canChangeRole(actorRole: RoomRole, targetRole: RoomRole, nextRole: RoomRole) {
  if (actorRole !== "host") return false;
  if (targetRole === "host" || nextRole === "host") return false; // host transfer is separate
  return ["cohost", "moderator", "guest", "viewer"].includes(nextRole);
}
