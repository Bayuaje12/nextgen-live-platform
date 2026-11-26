import { ROOM_ROLES, ROOM_STATUS, ROOM_TEMPLATES, ROOM_VISIBILITY } from "./constants";

export type RoomRole = (typeof ROOM_ROLES)[number];
export type RoomVisibility = (typeof ROOM_VISIBILITY)[number];
export type RoomStatus = (typeof ROOM_STATUS)[number];
export type RoomTemplate = (typeof ROOM_TEMPLATES)[number];

export interface Profile {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  hostId: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  template: RoomTemplate;
  passwordProtected: boolean;
  waitingRoomEnabled: boolean;
  locked: boolean;
  maxParticipants: number;
  scheduledFor?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId?: string | null;
  guestName?: string | null;
  role: RoomRole;
  status: "pending" | "approved" | "rejected" | "joined" | "left" | "removed";
  canPublish: boolean;
  canChat: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId?: string | null;
  displayName: string;
  content: string;
  type: "message" | "announcement" | "system";
  createdAt: string;
  deletedAt?: string | null;
  pinned?: boolean;
}

export interface Recording {
  id: string;
  roomId: string;
  ownerId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  storage: "local-browser";
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Poll {
  id: string;
  roomId: string;
  question: string;
  status: "open" | "closed";
  createdAt: string;
  options: PollOption[];
}

export interface PollOption {
  id: string;
  pollId: string;
  label: string;
  votes: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export interface AuthSession {
  user: Profile;
  accessToken?: string;
}
