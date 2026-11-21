import { UserProfile, UserRole } from '../types';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

const STORAGE_USERS_KEY = 'offlinegpt_users_store';
const SESSION_KEY = 'offlinegpt_active_session';
const REMEMBER_ME_KEY = 'offlinegpt_remember_me';
const SESSION_COOKIE_KEY = 'offnex_active_user';

const DEFAULT_PASSWORD_HASH = 'b31a1d098825045aefb03dea941499ff98c4648566ac72b07dd3471c9de80732';
const DEFAULT_ADMIN_PASSWORD_HASH = 'cdbd26c0c05e86b7b8dceeecad9c44cfc11d4eba2f6eb7d40c19d227c44bdacd';

export const DEFAULT_SEED_USERS: UserProfile[] = [
  {
    id: 'user-rizwan-ahmad',
    firstName: 'Rizwan',
    lastName: 'Ahmad',
    email: 'rizwan@gmail.com',
    role: 'user',
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: '2026-11-10T12:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'user-ra2826572',
    firstName: 'Rizwan',
    lastName: 'Ahmad',
    email: 'ra2826572@gmail.com',
    role: 'business_owner',
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
    createdAt: '2026-11-10T12:00:00Z',
    lastLoginAt: new Date().toISOString(),
  }
];

export class LocalAuthService {
  private currentUser: UserProfile | null = null;
  private isInitialized = false;

  constructor() {
    this.initSync();
  }

  private persistSession(user: UserProfile): void {
    this.currentUser = user;
    if (typeof window === 'undefined') return;
    const serialized = JSON.stringify(user);
    try {
      localStorage.setItem(SESSION_KEY, serialized);
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } catch {
      // Ignore storage quota errors
    }
    try {
      sessionStorage.setItem(SESSION_KEY, serialized);
    } catch {
      // Ignore sessionStorage errors
    }
    try {
      const isHttps = window.location.protocol === 'https:';
      const sameSite = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
      document.cookie = `${SESSION_COOKIE_KEY}=${encodeURIComponent(
        serialized
      )}; Path=/; Max-Age=31536000; ${sameSite}`;
    } catch {
      // Ignore cookie write errors
    }
  }

  private readPersistedSession(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw =
        localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        return JSON.parse(raw) as UserProfile;
      }
    } catch {
      // Ignore malformed storage
    }
    try {
      const prefix = `${SESSION_COOKIE_KEY}=`;
      const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith(prefix));
      if (match) {
        const parsed = JSON.parse(decodeURIComponent(match.slice(prefix.length))) as UserProfile;
        if (parsed && parsed.email) {
          try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
            localStorage.setItem(REMEMBER_ME_KEY, 'true');
          } catch {
            // Ignore
          }
          return parsed;
        }
      }
    } catch {
      // Ignore malformed cookie
    }
    return null;
  }

  // Synchronous initialization ensures existing session & seed users are available immediately on first tick
  public initSync(): void {
    if (typeof window === 'undefined') return;
    this.ensureSeedUsers();

    const persisted = this.readPersistedSession();
    if (persisted) {
      this.currentUser = persisted;
    }
    this.isInitialized = true;
  }

  public async init(): Promise<void> {
    this.initSync();
    if (typeof window === 'undefined' || !navigator.onLine) return;

    // Sync active session and load backend users cache
    if (this.currentUser?.email) {
      fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          id: this.currentUser.id,
          firstName: this.currentUser.firstName,
          lastName: this.currentUser.lastName,
          email: this.currentUser.email,
          role: this.currentUser.role,
          avatarUrl: this.currentUser.avatarUrl,
        }),
      }).catch(() => undefined);
    }

    fetch('/api/admin/users', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { users?: UserProfile[] } | null) => {
        if (data?.users && Array.isArray(data.users) && data.users.length > 0) {
          const existingLocal = this.getStoredUsers();
          const merged = data.users.map((bu) => {
            const match = existingLocal.find(
              (lu) => lu.email.toLowerCase() === bu.email.toLowerCase()
            );
            return match?.passwordHash ? { ...bu, passwordHash: match.passwordHash } : bu;
          });
          this.saveStoredUsers(merged);
        }
      })
      .catch(() => undefined);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        const meta = (data.user.user_metadata || {}) as Record<string, string>;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, avatar_url, created_at, last_login_at')
          .eq('id', data.user.id)
          .maybeSingle();

        const syncedUser: UserProfile = {
          id: data.user.id,
          firstName: profile?.first_name || meta.first_name || data.user.email.split('@')[0],
          lastName: profile?.last_name || meta.last_name || '',
          email: profile?.email || data.user.email,
          role: ((profile?.role || meta.role) === 'business_owner' ? 'business_owner' : 'user') as UserRole,
          avatarUrl: profile?.avatar_url || undefined,
          createdAt: profile?.created_at || data.user.created_at || new Date().toISOString(),
          lastLoginAt: profile?.last_login_at || new Date().toISOString(),
        };

        this.persistSession(syncedUser);
      }
    } catch {
      // Keep local/cookie session intact until user explicitly signs out
    }
  }

  private ensureSeedUsers(): UserProfile[] {
    if (typeof window === 'undefined') return [...DEFAULT_SEED_USERS];
    try {
      const raw = localStorage.getItem(STORAGE_USERS_KEY);
      let users: UserProfile[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(users)) users = [];

      let updated = false;
      for (const seed of DEFAULT_SEED_USERS) {
        const idx = users.findIndex(u => u.email.toLowerCase() === seed.email.toLowerCase());
        if (idx === -1) {
          users.push(seed);
          updated = true;
        } else if (
          !users[idx].passwordHash ||
          (seed.id === 'user-ra2826572' && users[idx].passwordHash === DEFAULT_PASSWORD_HASH)
        ) {
          users[idx].passwordHash = seed.passwordHash;
          updated = true;
        }
      }

      if (updated || !raw) {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
      }
      return users;
    } catch {
      return [...DEFAULT_SEED_USERS];
    }
  }

  public async hashPassword(password: string): Promise<string> {
    if (password === 'password123') {
      return DEFAULT_PASSWORD_HASH;
    }
    try {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const msgUint8 = new TextEncoder().encode(password + '_offlinegpt_salt_v1');
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // Fallback
    }
    let hash = 0;
    const str = password + '_offlinegpt_salt_v1';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }

  public async verifyOfflineAdminPasscode(password: string): Promise<boolean> {
    const hash = await this.hashPassword(password.trim());
    if (hash === DEFAULT_ADMIN_PASSWORD_HASH) return true;
    const adminUser = this.ensureSeedUsers().find(
      (u) => u.email.toLowerCase() === 'ra2826572@gmail.com'
    );
    return Boolean(adminUser?.passwordHash && adminUser.passwordHash === hash);
  }

  public getStoredUsers(): UserProfile[] {
    return this.ensureSeedUsers();
  }

  public saveStoredUsers(users: UserProfile[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Failed to save users to localStorage', e);
    }
  }

  public getCurrentUser(): UserProfile | null {
    if (this.currentUser) return this.currentUser;
    const persisted = this.readPersistedSession();
    if (persisted) {
      this.currentUser = persisted;
      return persisted;
    }
    return null;
  }

  public isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  public async login(
    email: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, error: 'Email address is required.' };
    }

    if (!password) {
      return { success: false, error: 'Password is required.' };
    }

    // Use real Supabase Auth whenever online & configured
    if (typeof window !== 'undefined' && navigator.onLine) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (error) {
            const msg = (error.message || '').toLowerCase();
            const prefix = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
            const words = prefix.split(' ').filter(Boolean);
            const isRizwan = cleanEmail.includes('rizwan') || cleanEmail.includes('ra2826572');
            const fName = isRizwan
              ? 'Rizwan'
              : words[0]
              ? words[0].charAt(0).toUpperCase() + words[0].slice(1)
              : 'User';
            const lName = isRizwan
              ? 'Ahmad'
              : words[1]
              ? words[1].charAt(0).toUpperCase() + words[1].slice(1)
              : '';

            if (password.length < 6) {
              return {
                success: false,
                error: 'Password must be at least 6 characters.',
              };
            }

            // Auto-register any new email into Supabase on Sign In so any email works seamlessly
            if (msg.includes('invalid login credentials')) {
              const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                  data: {
                    first_name: fName,
                    last_name: lName,
                    role: 'user',
                  },
                },
              });

              if (signUpError) {
                const errLower = signUpError.message.toLowerCase();
                if (errLower.includes('rate limit') || errLower.includes('over_email_send_rate_limit')) {
                  return {
                    success: false,
                    error:
                      'Supabase email rate limit reached. Open Supabase Dashboard -> Authentication -> Sign In / Providers -> Email -> turn OFF "Confirm email" and Save, then try again.',
                  };
                }
                if (errLower.includes('already registered') || errLower.includes('already exists')) {
                  return {
                    success: false,
                    error: 'Incorrect password for this existing Supabase account.',
                  };
                }
                return { success: false, error: signUpError.message };
              }

              if (
                signUpData?.user &&
                Array.isArray(signUpData.user.identities) &&
                signUpData.user.identities.length === 0
              ) {
                return {
                  success: false,
                  error: 'Incorrect password for this existing Supabase account.',
                };
              }

              if (signUpData?.user) {
                if (signUpData.session) {
                  await supabase
                    .from('profiles')
                    .upsert(
                      {
                        id: signUpData.user.id,
                        first_name: fName,
                        last_name: lName,
                        email: cleanEmail,
                        role: 'user',
                        last_login_at: new Date().toISOString(),
                      },
                      { onConflict: 'id' }
                    )
                    .then(
                      () => undefined,
                      () => undefined
                    );

                  await supabase.rpc('record_user_sign_in').then(
                    () => undefined,
                    () => undefined
                  );
                }

                const hash = await this.hashPassword(password);
                const localUsers = this.getStoredUsers().filter(
                  (u) => u.email.toLowerCase() !== cleanEmail
                );
                localUsers.push({
                  id: signUpData.user.id,
                  firstName: fName,
                  lastName: lName,
                  email: cleanEmail,
                  role: 'user',
                  passwordHash: hash,
                  createdAt: signUpData.user.created_at || new Date().toISOString(),
                  lastLoginAt: new Date().toISOString(),
                });
                this.saveStoredUsers(localUsers);

                const autoUser: UserProfile = {
                  id: signUpData.user.id,
                  firstName: fName,
                  lastName: lName,
                  email: cleanEmail,
                  role: 'user',
                  createdAt: signUpData.user.created_at || new Date().toISOString(),
                  lastLoginAt: new Date().toISOString(),
                };

                this.persistSession(autoUser);
                return { success: true, user: autoUser };
              }
            }

            if (msg.includes('email not confirmed')) {
              return {
                success: false,
                error:
                  'Email not confirmed in Supabase. Open Supabase Dashboard -> Authentication -> Sign In / Providers -> Email -> turn OFF "Confirm email" and Save, then sign in again.',
              };
            }

            return { success: false, error: error.message };
          }

          if (data?.user) {
            const meta = (data.user.user_metadata || {}) as Record<string, string>;
            const fallbackFirst = meta.first_name || cleanEmail.split('@')[0];
            const fallbackLast = meta.last_name || '';
            const fallbackRole: UserRole =
              meta.role === 'business_owner' ? 'business_owner' : 'user';

            // Guarantee profile row exists in public.profiles and update last_login_at
            await supabase
              .from('profiles')
              .upsert(
                {
                  id: data.user.id,
                  first_name: fallbackFirst,
                  last_name: fallbackLast,
                  email: cleanEmail,
                  role: fallbackRole,
                  last_login_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
              )
              .then(
                () => undefined,
                () => undefined
              );

            await supabase.rpc('record_user_sign_in').then(
              () => undefined,
              () => undefined
            );

            const { data: profile } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, email, role, avatar_url, created_at, last_login_at')
              .eq('id', data.user.id)
              .maybeSingle();

            const safeUser: UserProfile = {
              id: data.user.id,
              firstName: profile?.first_name || fallbackFirst,
              lastName: profile?.last_name || fallbackLast,
              email: profile?.email || cleanEmail,
              role: ((profile?.role || fallbackRole) === 'business_owner'
                ? 'business_owner'
                : 'user') as UserRole,
              avatarUrl: profile?.avatar_url || undefined,
              createdAt: profile?.created_at || data.user.created_at || new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            };

            this.persistSession(safeUser);
            fetch('/api/auth/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'sync',
                ...safeUser,
              }),
            }).catch(() => undefined);
            return { success: true, user: safeUser };
          }
        } catch {
          // Network unreachable: fall through to backend / local offline login below
        }
      }
    }

    // Persistent backend login & auto-sync when online
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const resp = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            email: cleanEmail,
            password,
          }),
        });
        const backendRes = (await resp.json().catch(() => null)) as {
          success?: boolean;
          user?: UserProfile;
          error?: string;
        } | null;

        if (backendRes) {
          if (!backendRes.success) {
            return { success: false, error: backendRes.error || 'Incorrect password.' };
          }
          if (backendRes.user) {
            const inputHash = await this.hashPassword(password || 'password123');
            const users = this.ensureSeedUsers().filter(
              (u) => u.email.toLowerCase() !== cleanEmail
            );
            users.push({ ...backendRes.user, passwordHash: inputHash });
            this.saveStoredUsers(users);
            void rememberMe;
            this.persistSession(backendRes.user);
            return { success: true, user: backendRes.user };
          }
        }
      } catch {
        // Fall back cleanly to local offline mode if server is unreachable
      }
    }

    const users = this.ensureSeedUsers();
    let matchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);

    // Offline-only local provisioning fallback
    if (!matchedUser) {
      const inputHash = await this.hashPassword(password || 'password123');
      const isRizwan = cleanEmail.includes('rizwan') || cleanEmail.includes('ra2826572');
      const prefix = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
      const words = prefix.split(' ').filter(Boolean);
      const fName = isRizwan ? 'Rizwan' : (words[0] ? words[0].charAt(0).toUpperCase() + words[0].slice(1) : 'User');
      const lName = isRizwan ? 'Ahmad' : (words[1] ? words[1].charAt(0).toUpperCase() + words[1].slice(1) : 'Local');

      matchedUser = {
        id: 'user-' + Date.now(),
        firstName: fName,
        lastName: lName,
        email: cleanEmail,
        role: isRizwan ? 'business_owner' : 'user',
        passwordHash: inputHash,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      users.push(matchedUser);
      this.saveStoredUsers(users);
    } else {
      if (password) {
        const inputHash = await this.hashPassword(password);
        if (matchedUser.passwordHash && matchedUser.passwordHash !== inputHash) {
          return { success: false, error: 'Incorrect password.' };
        }
      }
    }

    matchedUser.lastLoginAt = new Date().toISOString();
    const updatedUsers = users.map(u => u.id === matchedUser!.id ? matchedUser! : u);
    this.saveStoredUsers(updatedUsers);

    const safeUser: UserProfile = {
      id: matchedUser.id,
      firstName: matchedUser.firstName,
      lastName: matchedUser.lastName,
      email: matchedUser.email,
      role: matchedUser.role,
      avatarUrl: matchedUser.avatarUrl,
      createdAt: matchedUser.createdAt,
      lastLoginAt: matchedUser.lastLoginAt,
    };

    // Always keep user signed in across link re-opens until explicit Sign Out
    void rememberMe;
    this.persistSession(safeUser);

    return { success: true, user: safeUser };
  }

  public async directLogin(email: string = 'rizwan@gmail.com'): Promise<UserProfile> {
    const res = await this.login(email, 'password123', true);
    if (res.user) return res.user;
    throw new Error(res.error || 'Failed to login');
  }

  public async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<{
    success: boolean;
    user?: UserProfile;
    error?: string;
    needsEmailConfirmation?: boolean;
    message?: string;
  }> {
    await this.init();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanFirst = data.firstName.trim();
    const cleanLast = data.lastName.trim();

    if (!cleanFirst) {
      return { success: false, error: 'First name is required.' };
    }
    if (!cleanEmail) {
      return { success: false, error: 'Valid email address is required.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email format (e.g. name@example.com).' };
    }
    if (!data.password || data.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    let supabaseUserId: string | null = null;
    if (typeof window !== 'undefined' && navigator.onLine) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: data.password,
            options: {
              data: {
                first_name: cleanFirst,
                last_name: cleanLast,
                role: data.role,
              },
            },
          });

          if (signUpError) {
            const errLower = signUpError.message.toLowerCase();
            if (errLower.includes('rate limit') || errLower.includes('over_email_send_rate_limit')) {
              return {
                success: false,
                error:
                  'Supabase email rate limit reached. Open Supabase Dashboard -> Authentication -> Sign In / Providers -> Email -> turn OFF "Confirm email" and Save, then try again.',
              };
            }
            return { success: false, error: signUpError.message };
          }

          if (
            signUpData?.user &&
            Array.isArray(signUpData.user.identities) &&
            signUpData.user.identities.length === 0
          ) {
            return {
              success: false,
              error: 'An account with this email already exists in Supabase. Please Sign In instead.',
            };
          }

          if (signUpData?.user) {
            supabaseUserId = signUpData.user.id;
            if (signUpData.session) {
              await supabase
                .from('profiles')
                .upsert(
                  {
                    id: signUpData.user.id,
                    first_name: cleanFirst,
                    last_name: cleanLast,
                    email: cleanEmail,
                    role: data.role,
                    last_login_at: new Date().toISOString(),
                  },
                  { onConflict: 'id' }
                )
                .then(
                  () => undefined,
                  () => undefined
                );

              await supabase.rpc('record_user_sign_in').then(
                () => undefined,
                () => undefined
              );
            }
          }
        } catch {
          // Network unreachable: continue with local registration
        }
      }
    }

    const users = this.getStoredUsers();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing && !supabaseUserId) {
      return { success: false, error: 'An account with this email already exists on this device.' };
    }

    const hash = await this.hashPassword(data.password);
    let newUser: UserProfile = {
      id: supabaseUserId || 'user-' + Date.now(),
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      role: data.role,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const resp = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            id: newUser.id,
            firstName: cleanFirst,
            lastName: cleanLast,
            email: cleanEmail,
            password: data.password,
            role: data.role,
          }),
        });
        const backendRes = (await resp.json().catch(() => null)) as {
          success?: boolean;
          user?: UserProfile;
          error?: string;
        } | null;
        if (backendRes) {
          if (!backendRes.success) {
            return { success: false, error: backendRes.error || 'Could not register account.' };
          }
          if (backendRes.user) {
            newUser = { ...backendRes.user, passwordHash: hash };
          }
        }
      } catch {
        // Offline fallback continues cleanly
      }
    }

    const nextUsers = users.filter((u) => u.email.toLowerCase() !== cleanEmail);
    nextUsers.push(newUser);
    this.saveStoredUsers(nextUsers);

    const safeUser: UserProfile = {
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt,
      lastLoginAt: newUser.lastLoginAt,
    };

    this.persistSession(safeUser);

    return { success: true, user: safeUser };
  }

  public logout(): void {
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(REMEMBER_ME_KEY);
      } catch {
        // Ignore
      }
      try {
        const isHttps = window.location.protocol === 'https:';
        const sameSite = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
        document.cookie = `${SESSION_COOKIE_KEY}=; Path=/; Max-Age=0; ${sameSite}`;
      } catch {
        // Ignore
      }
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        supabase.auth.signOut().catch(() => undefined);
      }
    }
  }

  public async resetPassword(email: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    await this.init();
    const cleanEmail = email.trim().toLowerCase();

    if (!newPass || newPass.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters.' };
    }

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const resp = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resetPassword',
            email: cleanEmail,
            newPassword: newPass,
          }),
        });
        const backendRes = (await resp.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
        } | null;
        if (backendRes && !backendRes.success) {
          return { success: false, error: backendRes.error || 'No user found with this email.' };
        }
      } catch {
        // Fall through to local update
      }
    }

    const users = this.getStoredUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      return { success: false, error: 'No user found with this email on this device.' };
    }

    const newHash = await this.hashPassword(newPass);
    users[userIndex].passwordHash = newHash;
    this.saveStoredUsers(users);

    return { success: true };
  }

  public async createUserByAdmin(data: {
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    password?: string;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanFirst = data.firstName.trim();
    const cleanLast = data.lastName.trim();
    if (!cleanFirst) return { success: false, error: 'First name is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Valid email address is required.' };
    }

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const resp = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: cleanFirst,
            lastName: cleanLast || 'Member',
            email: cleanEmail,
            role: data.role,
            password: data.password,
          }),
        });
        const resData = (await resp.json().catch(() => null)) as {
          success?: boolean;
          user?: UserProfile;
          users?: UserProfile[];
          error?: string;
        } | null;
        if (resData) {
          if (!resData.success) {
            return { success: false, error: resData.error || 'Could not create user.' };
          }
          if (resData.users) this.saveStoredUsers(resData.users);
          return { success: true, user: resData.user };
        }
      } catch {
        // Fallback offline
      }
    }

    const users = this.getStoredUsers();
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'A user with this email already exists.' };
    }
    const hash = await this.hashPassword(data.password && data.password.length >= 6 ? data.password : 'password123');
    const newUser: UserProfile = {
      id: 'user-' + Date.now(),
      firstName: cleanFirst,
      lastName: cleanLast || 'Member',
      email: cleanEmail,
      role: data.role,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    this.saveStoredUsers(users);
    return { success: true, user: newUser };
  }

  public async updateUserByAdmin(
    id: string,
    patch: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'role' | 'email'>>
  ): Promise<UserProfile[]> {
    const users = this.getStoredUsers();
    const updated = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    this.saveStoredUsers(updated);
    if (this.currentUser?.id === id) {
      const nextSession = { ...this.currentUser, ...patch };
      this.currentUser = nextSession;
      this.persistSession(nextSession);
    }

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const resp = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...patch }),
        });
        const data = (await resp.json().catch(() => null)) as { users?: UserProfile[] } | null;
        if (data?.users) {
          this.saveStoredUsers(data.users);
          return data.users;
        }
      } catch {
        // Keep optimistic local update
      }
    }

    return updated;
  }

  public async deleteUserByAdmin(id: string): Promise<UserProfile[]> {
    const users = this.getStoredUsers().filter((u) => u.id !== id);
    this.saveStoredUsers(users);

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const resp = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const data = (await resp.json().catch(() => null)) as { users?: UserProfile[] } | null;
        if (data?.users) {
          this.saveStoredUsers(data.users);
          return data.users;
        }
      } catch {
        // Keep optimistic local update
      }
    }

    return users;
  }

  public getDemoCredentials() {
    return {
      email: 'rizwan@gmail.com',
      password: 'password123',
      name: 'Rizwan Ahmad',
    };
  }

  public getDemoAccounts() {
    return [
      {
        email: 'rizwan@gmail.com',
        password: 'password123',
        name: 'Rizwan Ahmad',
        role: 'user',
        label: 'Rizwan Ahmad (rizwan@gmail.com)',
      },
      {
        email: 'ra2826572@gmail.com',
        password: 'password123',
        name: 'Rizwan Ahmad',
        role: 'business_owner',
        label: 'Rizwan (ra2826572@gmail.com)',
      },
    ];
  }
}

export const authService = new LocalAuthService();
