export interface UserSession {
  id: string;
  username: string;
  email?: string;
  isGuest: boolean;
  createdAt: number;
}

const USER_STORAGE_KEY = 'hobby_user_profile';
const TOKEN_STORAGE_KEY = 'hobby_session_token';

type AuthListener = (user: UserSession) => void;

function createDefaultGuest(): UserSession {
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return {
    id: `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    username: `Player ${randomSuffix}`,
    isGuest: true,
    createdAt: Date.now()
  };
}

class AuthStore {
  private currentUser: UserSession;
  private sessionToken: string | null = null;
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    this.sessionToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    let loadedUser: UserSession | null = null;

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(USER_STORAGE_KEY);
        if (raw) {
          loadedUser = JSON.parse(raw);
        }
      } catch {
        loadedUser = null;
      }
    }

    if (loadedUser && loadedUser.username) {
      this.currentUser = loadedUser;
    } else {
      this.currentUser = createDefaultGuest();
      this.persistUser(this.currentUser);
    }

    // If session token exists, verify with server in background
    if (this.sessionToken && !this.currentUser.isGuest) {
      this.validateRemoteSession().catch(() => {});
    }
  }

  public getUser(): UserSession {
    return this.currentUser;
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  private persistUser(user: UserSession): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } catch (e) {
        console.warn('Could not persist user to localStorage:', e);
      }
    }
  }

  private persistToken(token: string | null): void {
    if (typeof localStorage !== 'undefined') {
      try {
        if (token) {
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Could not persist session token to localStorage:', e);
      }
    }
  }

  public setGuestNickname(nickname: string): void {
    const trimmed = nickname.trim().slice(0, 30);
    if (!trimmed) return;

    this.currentUser = {
      ...this.currentUser,
      username: trimmed
    };
    this.persistUser(this.currentUser);
    this.notify();
  }

  public async requestMagicLink(email: string, username?: string): Promise<{ success: boolean; token?: string; simulatedUrl?: string; message?: string }> {
    const response = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to request magic link.');
    }

    return data;
  }

  public async verifyMagicLink(token: string): Promise<UserSession> {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to verify magic link token.');
    }

    this.sessionToken = data.sessionToken;
    this.currentUser = data.user;
    this.persistToken(this.sessionToken);
    this.persistUser(this.currentUser);
    this.notify();

    return this.currentUser;
  }

  public async validateRemoteSession(): Promise<boolean> {
    if (!this.sessionToken) return false;
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${this.sessionToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this.currentUser = data.user;
          this.persistUser(this.currentUser);
          this.notify();
          return true;
        }
      } else if (response.status === 401) {
        // Session expired or invalidated on server
        this.logout();
      }
    } catch {
      // ignore network errors
    }
    return false;
  }

  public logout(): void {
    if (this.sessionToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.sessionToken}` }
      }).catch(() => {});
    }

    this.sessionToken = null;
    this.persistToken(null);
    this.currentUser = createDefaultGuest();
    this.persistUser(this.currentUser);
    this.notify();
  }
}

export const authStore = new AuthStore();
