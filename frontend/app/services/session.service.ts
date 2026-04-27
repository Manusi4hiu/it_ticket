import { createCookieSessionStorage } from 'react-router';
import type { AuthUser } from './auth.service';
import { setAuthToken } from './api.service';

// Session secret - in production, use environment variable
const sessionSecret = process.env.SESSION_SECRET || 'default-secret-change-in-production';

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function createUserSession(user: AuthUser, redirectTo: string, token?: string) {
  try {
    console.log(`[Session Service] Creating session for user: ${user.username} (ID: ${user.id})`);
    
    const session = await sessionStorage.getSession();
    console.log('[Session Service] New session object obtained');
    
    session.set('userId', user.id);
    session.set('userEmail', user.email);
    session.set('userRole', user.role);
    session.set('userName', user.full_name);
    
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

export async function getUserSession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const userId = session.get('userId');
  const userEmail = session.get('userEmail');
  const userRole = session.get('userRole');
  const userName = session.get('userName');
  const authToken = session.get('authToken');

  if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
    return null;
  }

  // Set auth token for API calls
  if (authToken) {
    setAuthToken(authToken);
  }

  return {
    userId,
    userEmail,
    userRole,
    userName,
    authToken,
  };
}

export async function requireAuth(request: Request) {
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

export async function requireRole(request: Request, allowedRoles: string[]) {
  const session = await requireAuth(request);

  if (!allowedRoles.includes(session.userRole)) {
    throw new Response('Forbidden', {
      status: 403,
    });
  }

  return session;
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  return {
    'Set-Cookie': await sessionStorage.destroySession(session),
  };
}

export { sessionStorage };
