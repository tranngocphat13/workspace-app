import { create } from 'zustand';
import type { AuthUser, AuthStoreState } from '../types';

// ─── Fake user database (stored in localStorage) ─────────────────────────────

const DB_KEY = 'workspace_users';
const SESSION_KEY = 'workspace_session';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // in real app: bcrypt. Here: simple base64 simulation
  avatarUrl?: string;
}

function getUsers(): StoredUser[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(DB_KEY, JSON.stringify(users));
}

function saveSession(user: AuthUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function getSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// Simple hash: NOT secure — for demo only
function simpleHash(password: string): string {
  return btoa(encodeURIComponent(password));
}

function generateAvatar(name: string): string {
  const index = name.charCodeAt(0) % 8;
  const seeds = [
    'Felix', 'Aneka', 'Jasper', 'Mia', 'Leo', 'Zara', 'Noah', 'Aria',
  ];
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seeds[index]}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

// ─── Simulate async network delay ────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStoreState>()((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initAuth: () => {
    const session = getSession();
    set({ user: session, isInitialized: true });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    await delay(800); // simulate network

    const users = getUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!found || found.passwordHash !== simpleHash(password)) {
      set({ isLoading: false, error: 'Email hoặc mật khẩu không đúng.' });
      return;
    }

    const authUser: AuthUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      avatarUrl: found.avatarUrl,
      statusText: 'Online',
    };

    saveSession(authUser);
    set({ user: authUser, isLoading: false, error: null });
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true, error: null });
    await delay(800); // simulate network

    const users = getUsers();
    const exists = users.some(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (exists) {
      set({ isLoading: false, error: 'Email này đã được đăng ký.' });
      return;
    }

    const newUser: StoredUser = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: simpleHash(password),
      avatarUrl: generateAvatar(name),
    };

    saveUsers([...users, newUser]);

    const authUser: AuthUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatarUrl: newUser.avatarUrl,
      statusText: 'Online',
    };

    saveSession(authUser);
    set({ user: authUser, isLoading: false, error: null });
  },

  logout: () => {
    clearSession();
    set({ user: null, error: null });
  },
}));
