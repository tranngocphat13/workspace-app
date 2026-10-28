import { create } from 'zustand';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { AuthUser, AuthStoreState } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWorkspaceStore } from './useWorkspaceStore';

// ─── Avatar Generator ────────────────────────────────────────────────────────

function generateAvatar(seed: string): string {
  const seeds = [
    'Felix', 'Aneka', 'Jasper', 'Mia', 'Leo', 'Zara', 'Noah', 'Aria',
  ];
  const charCode = seed.charCodeAt(0) || 0;
  const picked = seeds[charCode % seeds.length];
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${picked}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

// ─── Profile Hydration Helper ────────────────────────────────────────────────

async function buildAuthUser(sessionUser: SupabaseAuthUser): Promise<AuthUser> {
  let name =
    (typeof sessionUser.user_metadata?.name === 'string' && sessionUser.user_metadata.name.trim()) ||
    (typeof sessionUser.user_metadata?.full_name === 'string' && sessionUser.user_metadata.full_name.trim()) ||
    sessionUser.email?.split('@')[0] ||
    'User';
  let avatarUrl =
    (typeof sessionUser.user_metadata?.avatar_url === 'string' && sessionUser.user_metadata.avatar_url) ||
    generateAvatar(name || sessionUser.id);
  let statusText = 'Online';

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (profile) {
        if (profile.name) name = profile.name;
        if (profile.avatar_url) avatarUrl = profile.avatar_url;
        if (profile.status_text) statusText = profile.status_text;
      }
    } catch {
      // If profile query fails, fall back gracefully to session metadata
    }
  }

  return {
    id: sessionUser.id,
    name,
    email: sessionUser.email || '',
    avatarUrl,
    statusText,
  };
}

let authListenerUnsubscribe: (() => void) | null = null;

// ─── Auth Store ──────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStoreState>()((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initAuth: () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ isInitialized: true, isLoading: false });
      return;
    }

    // Recover session asynchronously on mount
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Supabase getSession error:', error.message);
        }

        if (session?.user) {
          const authUser = await buildAuthUser(session.user);
          useWorkspaceStore.getState().setCurrentUser(authUser);
          set({ user: authUser, isInitialized: true, isLoading: false, error: null });
        } else {
          set({ user: null, isInitialized: true, isLoading: false });
        }
      } catch (err) {
        console.warn('Failed to recover session:', err);
        set({ isInitialized: true, isLoading: false });
      }
    })();

    // Attach onAuthStateChange listener (ensures single subscription)
    if (!authListenerUnsubscribe) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            const currentUserId = get().user?.id;
            if (event === 'SIGNED_IN' && currentUserId && currentUserId !== session.user.id) {
              useWorkspaceStore.getState().resetWorkspaceState();
            }
            const authUser = await buildAuthUser(session.user);
            useWorkspaceStore.getState().setCurrentUser(authUser);
            set({ user: authUser, error: null, isLoading: false });
          }
        } else if (event === 'SIGNED_OUT') {
          useWorkspaceStore.getState().resetWorkspaceState();
          set({ user: null, error: null, isLoading: false });
        }
      });
      authListenerUnsubscribe = () => {
        data.subscription.unsubscribe();
      };
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    if (!isSupabaseConfigured || !supabase) {
      // Safe offline fallback for tests and development without active Supabase credentials
      const offlineUser: AuthUser = {
        id: `offline-${Date.now()}`,
        name: email.split('@')[0] || 'Demo User',
        email: email.trim(),
        avatarUrl: generateAvatar(email),
        statusText: 'Online',
      };
      useWorkspaceStore.getState().resetWorkspaceState();
      useWorkspaceStore.getState().setCurrentUser(offlineUser);
      set({ user: offlineUser, isLoading: false, error: null });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        set({
          isLoading: false,
          error:
            error.message === 'Invalid login credentials'
              ? 'Email hoặc mật khẩu không đúng.'
              : error.message,
        });
        return;
      }

      if (data.user) {
        useWorkspaceStore.getState().resetWorkspaceState();
        const authUser = await buildAuthUser(data.user);
        useWorkspaceStore.getState().setCurrentUser(authUser);
        set({ user: authUser, isLoading: false, error: null });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đăng nhập thất bại.';
      set({ isLoading: false, error: message });
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true, error: null });

    const avatarUrl = generateAvatar(name);

    if (!isSupabaseConfigured || !supabase) {
      // Safe offline fallback for tests and development without active Supabase credentials
      const offlineUser: AuthUser = {
        id: `offline-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        avatarUrl,
        statusText: 'Online',
      };
      useWorkspaceStore.getState().resetWorkspaceState();
      useWorkspaceStore.getState().setCurrentUser(offlineUser);
      set({ user: offlineUser, isLoading: false, error: null });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            avatar_url: avatarUrl,
          },
        },
      });

      if (error) {
        set({
          isLoading: false,
          error: error.message.includes('already registered')
            ? 'Email này đã được đăng ký.'
            : error.message,
        });
        return;
      }

      if (data.user) {
        if (data.session) {
          useWorkspaceStore.getState().resetWorkspaceState();
          const authUser = await buildAuthUser(data.user);
          useWorkspaceStore.getState().setCurrentUser(authUser);
          set({ user: authUser, isLoading: false, error: null });
        } else {
          // If project requires email verification before creating session
          set({
            isLoading: false,
            error: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.',
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đăng ký thất bại.';
      set({ isLoading: false, error: message });
    }
  },

  logout: async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Supabase signOut error:', err);
    } finally {
      useWorkspaceStore.getState().resetWorkspaceState();
      set({ user: null, error: null, isLoading: false });
    }
  },

  signIn: async (email: string, password: string): Promise<void> => {
    return get().login(email, password);
  },

  signUp: async (name: string, email: string, password: string): Promise<void> => {
    return get().register(name, email, password);
  },

  signOut: async (): Promise<void> => {
    await get().logout();
  },
}));
