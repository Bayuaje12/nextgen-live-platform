import { create } from "zustand";
import { config } from "../lib/config";

type GuestSession = { id: string; guestId: string; displayName: string | null; expiresAt: string };

interface GuestState {
  token: string | null;
  session: GuestSession | null;
  loading: boolean;
  init: () => Promise<void>;
  ensureSession: (displayName?: string) => Promise<string | null>;
  clear: () => void;
}

const TOKEN_KEY = "nextgen_guest_token";

export const useGuestStore = create<GuestState>((set, get) => ({
  token: typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,
  session: null,
  loading: true,
  init: async () => {
    const token = get().token || (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
    if (!token) { set({ loading: false, token: null, session: null }); return; }
    try {
      const res = await fetch(`${config.apiUrl}/api/guest/session`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("invalid");
      const body = await res.json();
      set({ token, session: body.session, loading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, session: null, loading: false });
    }
  },
  ensureSession: async (displayName?: string) => {
    const existing = get().token;
    if (existing && get().session) return existing;
    const res = await fetch(`${config.apiUrl}/api/guest/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    localStorage.setItem(TOKEN_KEY, body.token);
    set({ token: body.token, session: body.session, loading: false });
    return body.token as string;
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, session: null });
  },
}));
