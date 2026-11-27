import { createCookieSessionStorage } from 'react-router';
import type { AuthUser } from './auth.service';
import { runWithServerToken } from './ssr-auth.server';

const _DEFAULT_SESSION_SECRET = 'default-secret-change-in-production';
let _warnedDefaultSecret = false;

function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === _DEFAULT_SESSION_SECRET) {
    if (process.env.NODE_ENV === 'production' && !_warnedDefaultSecret) {
      _warnedDefaultSecret = true;
      console.error(
        '[SECURITY] SESSION_SECRET is unset or using the insecure default in production. ' +
        'Set a strong random SESSION_SECRET environment variable.'
      );
    }
    return _DEFAULT_SESSION_SECRET;
  }
  return secret;
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours — aligned with backend JWT_ACCESS_TOKEN_EXPIRES so mobile PWA survives app close
    secrets: [resolveSessionSecret()],
    secure: process.env.NODE_ENV === 'production',
  },
});

export interface UserSession {
  userId: string;
  userEmail: string | null;
  userRole: string;
  userName: string;
  authToken: string | undefined;
  teams: NonNullable<AuthUser["teams"]>;
  lastActiveTeamId: string | number | null;
}

export async function createUserSession(user: AuthUser, redirectTo: string, token?: string) {
  try {
    console.log(`[Session Service] Creating session for user: ${user.username} (ID: ${user.id})`);
    
    const session = await sessionStorage.getSession();
    console.log('[Session Service] New session object obtained');
    
    session.set('userId', user.id);
    session.set('userEmail', user.email);
    session.set('userRole', user.role);
    session.set('userName', user.full_name);
    session.set('teams', user.teams || []);
    session.set('lastActiveTeamId', user.lastActiveTeamId ?? null);
    
    if (token) {
      console.log('[Session Service] Setting authToken in session');
      session.set('authToken', token);
    }

    console.log('[Session Service] Committing session...');
    const cookie = await sessionStorage.commitSession(session);
    console.log('[Session Service] Session committed, cookie generated');

    return {
      'Set-Cookie': cookie,
    };
  } catch (error) {
    console.error('[Session Service] CRITICAL ERROR in createUserSession:', error);
    throw error; // Re-throw to be caught by the action
  }
}

export async function getUserSession(request: Request): Promise<UserSession | null> {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const userId = session.get('userId');
  const userEmail = session.get('userEmail');
  const userRole = session.get('userRole');
  const userName = session.get('userName');
  const authToken = session.get('authToken');
  const teams = session.get('teams');
  const lastActiveTeamId = session.get('lastActiveTeamId');

  if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
    return null;
  }

  return {
    userId: String(userId),
    userEmail: typeof userEmail === 'string' ? userEmail : null,
    userRole: String(userRole || ''),
    userName: String(userName || ''),
    authToken: typeof authToken === 'string' ? authToken : undefined,
    teams: Array.isArray(teams) ? teams : [],
    lastActiveTeamId: lastActiveTeamId ?? null,
  };
}

export async function requireAuth(request: Request): Promise<UserSession> {
  const session = await getUserSession(request);
  if (!session) {
    throw new Response('Unauthorized', {
      status: 401,
      headers: {
        Location: '/unauthorized',
      },
    });
  }
  return session;
}

export async function requireRole(request: Request, allowedRoles: string[]): Promise<UserSession> {
  const session = await requireAuth(request);

  if (!allowedRoles.includes(session.userRole)) {
    // Redirect ke halaman forbidden yang informatif (bukan ErrorBoundary generik)
    // Gunakan `redirect` dari react-router agar benar-benar pindah halaman (302).
    const { redirect } = await import("react-router");
    throw redirect("/forbidden");
  }

  return session;
}

/** Run loader/action with optional session bound to current SSR request context. */
export async function runWithUserSession<T>(
  request: Request,
  fn: (session: UserSession | null) => Promise<T>
): Promise<T> {
  const session = await getUserSession(request);
  return runWithServerToken(session?.authToken ?? null, () => fn(session));
}

/** Require authenticated user and run loader/action isolated to their request JWT. */
export async function runWithAuth<T>(
  request: Request,
  fn: (session: UserSession) => Promise<T>
): Promise<T> {
  const session = await requireAuth(request);
  return runWithServerToken(session.authToken ?? null, () => fn(session));
}

/** Require specific role(s) and run loader/action isolated to that user's request JWT. */
export async function runWithRole<T>(
  request: Request,
  allowedRoles: string[],
  fn: (session: UserSession) => Promise<T>
): Promise<T> {
  const session = await requireRole(request, allowedRoles);
  return runWithServerToken(session.authToken ?? null, () => fn(session));
}

/** Destroy any leftover session cookie without calling backend (used on 401 expiry recovery). */
export async function destroyLocalSessionCookie(request: Request): Promise<string> {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  return sessionStorage.destroySession(session);
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  
  const token = session.get('authToken');
  if (token) {
    const baseUrl = typeof process !== 'undefined' && process.env.API_URL ? process.env.API_URL : 'http://127.0.0.1:5000/api';
    try {
      await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      console.error('Backend logout failed:', e);
    }
  }

  return {
    'Set-Cookie': await sessionStorage.destroySession(session),
  };
}

export { sessionStorage };
