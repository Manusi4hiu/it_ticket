import { authApi, setAuthToken, clearAuthToken, getAuthToken } from './api.service';
import type { UserRole } from '~/data/auth';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string | number;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  try {
    console.log('[Auth Service] Calling authApi.login for:', credentials.username);

    const response = await authApi.login(credentials.username, credentials.password);

    console.log('[Auth Service] authApi.login response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error,
    });

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Username atau password salah. Silakan coba lagi.',
      };
    }

    const { token, user } = response.data;

    if (!token || !user) {
      console.error('[Auth Service] Response data missing token or user:', {
        hasToken: !!token,
        hasUser: !!user,
      });
      return {
        success: false,
        error: 'Server response tidak valid. Silakan coba lagi.',
      };
    }

    // Only store the token on the client side; on the server, session handles it
    if (typeof window !== 'undefined') {
      setAuthToken(token);
    }

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        role: user.role as UserRole,
        department: user.department,
        phone: user.phone,
        avatar_url: user.avatar_url,
      },
    };
  } catch (error) {
    console.error('[Auth Service] Login error:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan. Silakan coba lagi.',
    };
  }
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAuthToken();
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await authApi.me();

    if (!response.success || !response.data) {
      clearAuthToken();
      return null;
    }

    const user = response.data.user;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role: user.role as UserRole,
      department: user.department,
      phone: user.phone,
      avatar_url: user.avatar_url,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    clearAuthToken();
    return null;
  }
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  try {
    const response = await authApi.me();

    if (!response.success || !response.data) {
      return null;
    }

    const user = response.data.user;
    if (user.id !== userId) {
      // For now, we only support getting the current user
      // In future, could call users API
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role: user.role as UserRole,
      department: user.department,
      phone: user.phone,
      avatar_url: user.avatar_url,
    };
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}
