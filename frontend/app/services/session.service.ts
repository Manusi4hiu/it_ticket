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
  const session = await sessionStorage.getSession();
  session.set('userId', user.id);
  session.set('userEmail', user.email);
  session.set('userRole', user.role);
  session.set('userName', user.full_name);
  if (token) {
    session.set('authToken', token);
  }

  return {
    'Set-Cookie': await sessionStorage.commitSession(session),
    Location: redirectTo,
  };
}

export async function getUserSession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const userId = session.get('userId');
  const userEmail = session.get('userEmail');
  const userRole = session.get('userRole');
  const userName = session.get('userName');
  const authToken = session.get('authToken');

  if (!userId || typeof userId !== 'string') {
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
    Location: '/login',
  };
}

export { sessionStorage };
