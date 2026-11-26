export const APP_DEFAULT_NAME = "NextGen Live";
export const WHATSAPP_COMMUNITY_URL =
  "https://whatsapp.com/channel/0029Vb8XyJkGehERjMvj1R1k";

export const ROOM_ROLES = ["host", "cohost", "moderator", "guest", "viewer"] as const;
export const ROOM_VISIBILITY = ["public", "private"] as const;
export const ROOM_STATUS = ["scheduled", "live", "ended", "cancelled"] as const;

export const ROOM_TEMPLATES = [
  "live",
  "conference",
  "podcast",
  "gaming",
  "webinar",
  "classroom",
  "interview",
  "event",
] as const;
