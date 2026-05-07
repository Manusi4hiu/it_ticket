import { Outlet, useNavigate, Form, redirect, NavLink, useLocation } from "react-router";
import {
  User,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Inbox
} from "lucide-react";
import { NotificationBell } from "~/components/notification-bell";
import { getUserSession, logout } from "~/services/session.service";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getUserSession(request);
  return { session };
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method === 'POST') {
    const formData = await request.formData();
    const intent = formData.get('intent');

    if (intent === 'logout') {
      return redirect('/login', {
        headers: await logout(request),
      });
    }
  }

  return null;
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { session } = loaderData;
  const navigate = useNavigate();
  const isAdministrator = session?.userRole === 'Administrator';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft} onClick={() => navigate("/dashboard")} style={{ cursor: "pointer" }}>
            <div className={styles.logoContainer}>
              <img src="/logo/logo itani.png" alt="Logo" className={styles.headerIcon} />
              <div className={styles.logoCircle}></div>
            </div>
            <h1 className={styles.headerTitle}>IT Aero Support</h1>
          </div>

          {session && (
            <nav className={styles.navBar}>
              <div className={styles.navGroup}>
                <NavLink
                  to="/tickets"
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                >
                  <Inbox className={styles.navIcon} />
                  <span className={styles.navLabel}>Tickets</span>
                </NavLink>
                <NavLink
                  to={`/profile/${session.userId}`}
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                >
                  <User className={styles.navIcon} />
                  <span className={styles.navLabel}>Profile</span>
                </NavLink>
                <NavLink
                  to="/staff-performance"
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                >
                  <Users className={styles.navIcon} />
                  <span className={styles.navLabel}>Performance</span>
                </NavLink>
                {(isAdministrator || session.userRole === 'Management') && (
                  <NavLink
                    to="/analytics"
                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                  >
                    <BarChart3 className={styles.navIcon} />
                    <span className={styles.navLabel}>Analytics</span>
                  </NavLink>
                )}
                {isAdministrator && (
                  <NavLink
                    to="/settings/role-management"
                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                  >
                    <Settings className={styles.navIcon} />
                    <span className={styles.navLabel}>Settings</span>
                  </NavLink>
                )}
              </div>

              <div className={styles.navDivider}></div>

              <div className={styles.navActionGroup}>
                <NotificationBell userId={session.userId} />
                <Form method="post" action="/dashboard">
                  <input type="hidden" name="intent" value="logout" />
                  <button className={styles.logoutBtn} type="submit">
                    <LogOut className={styles.navIcon} />
                    <span className={styles.navLabel}>Logout</span>
                  </button>
                </Form>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
