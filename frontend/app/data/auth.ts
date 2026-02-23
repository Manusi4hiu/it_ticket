// Simple authentication data and utilities
export type UserRole = 'Administrator' | 'Management' | 'Staff';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // In production, this should be hashed
  role: UserRole;
}

// Mock users matching our agents
export const users: User[] = [
  { id: "1", name: "John Smith", email: "john.smith@company.com", password: "john123", role: "Administrator" },
  { id: "2", name: "Jane Doe", email: "jane.doe@company.com", password: "jane123", role: "Management" },
  { id: "3", name: "Mike Wilson", email: "mike.wilson@company.com", password: "mike123", role: "Staff" },
  { id: "4", name: "Sarah Connor", email: "sarah.connor@company.com", password: "sarah123", role: "Staff" },
];

// Session storage key
const SESSION_KEY = "it_staff_session";

export interface Session {
  userId: string;
  userName: string;
  email: string;
  role: UserRole;
  loginTime: string;
}

// Get current session
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const sessionData = localStorage.getItem(SESSION_KEY);
  if (!sessionData) return null;
  try {
    return JSON.parse(sessionData);
  } catch {
    return null;
  }
}

// Create session
export function createSession(user: User): void {
  const session: Session = {
    userId: user.id,
    userName: user.name,
    email: user.email,
    role: user.role,
    loginTime: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// Clear session
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// Authenticate user
export function authenticate(email: string, password: string): User | null {
  const user = users.find((u) => u.email === email && u.password === password);
  return user || null;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

// Get current user ID
export function getCurrentUserId(): string | null {
  const session = getSession();
  return session?.userId || null;
}

// Get current user
export function getCurrentUser(): { id: string; name: string; email: string; role: UserRole } | null {
  const session = getSession();
  if (!session) return null;
  return {
    id: session.userId,
    name: session.userName,
    email: session.email,
    role: session.role,
  };
}

// Get current user role
export function getCurrentUserRole(): UserRole | null {
  const session = getSession();
  return session?.role || null;
}
