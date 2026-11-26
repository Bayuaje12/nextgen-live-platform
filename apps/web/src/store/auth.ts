import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  init: async () => {
    if (!supabase) {
      set({ loading: false, initialized: true, user: null, session: null });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, loading: false, initialized: true });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false, initialized: true });
    });
  },
  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
