import { useState, useEffect } from "react";
import { Outlet, useNavigate, Form, redirect, NavLink, useLocation } from "react-router";
import {
  User,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Inbox,
  Kanban,
  Terminal,
  Clock
} from "lucide-react";
import { NotificationBell } from "~/components/notification-bell";
import { getUserSession, logout } from "~/services/session.service";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";
import { useIdleTimeout } from "~/hooks/use-idle-timeout";

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
  const location = useLocation();
  const isAdministrator = session?.userRole === 'Administrator';

  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("app_mode_dev");
    if (saved === "true") {
      setIsDevMode(true);
    }
  }, []);

  const handleToggleMode = (dev: boolean) => {
    setIsDevMode(dev);
    localStorage.setItem("app_mode_dev", String(dev));
    if (dev) {
      navigate("/dev-dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  useIdleTimeout(10, !!session);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft} onClick={() => navigate(isDevMode ? "/dev-dashboard" : "/dashboard")} style={{ cursor: "pointer" }}>
            <div className={styles.logoContainer}>
              <img src="/logo/logo itani.png" alt="Logo" className={styles.headerIcon} />
            </div>
            <h1 className={styles.headerTitle}>
              {isDevMode ? "IT Aero Dev" : "IT Aero Support"}
            </h1>
          </div>

          {session && (
            <nav className={styles.navBar}>
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${!isDevMode ? styles.toggleBtnActive : ''}`}
                  onClick={() => handleToggleMode(false)}
                >
                  Helpdesk
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${isDevMode ? styles.toggleBtnActive : ''}`}
                  onClick={() => handleToggleMode(true)}
                >
                  Dev Team
                </button>
              </div>

              <div className={styles.navGroup}>
                {!isDevMode ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <NavLink
                      to="/dev-dashboard"
                      className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    >
                      <Kanban className={styles.navIcon} />
                      <span className={styles.navLabel}>Dev Board</span>
                    </NavLink>
                    <NavLink
                      to="/staff-performance"
                      className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    >
                      <Users className={styles.navIcon} />
                      <span className={styles.navLabel}>Performance</span>
                    </NavLink>
                    {isAdministrator && (
                      <>
                        <NavLink
                          to="/settings/logs"
                          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                        >
                          <Terminal className={styles.navIcon} />
                          <span className={styles.navLabel}>System Logs</span>
                        </NavLink>
                        <NavLink
                          to="/settings/sla-policies"
                          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                        >
                          <Clock className={styles.navIcon} />
                          <span className={styles.navLabel}>SLA Policies</span>
                        </NavLink>
                        <NavLink
                          to="/settings/role-management"
                          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                        >
                          <Settings className={styles.navIcon} />
                          <span className={styles.navLabel}>Settings</span>
                        </NavLink>
                      </>
                    )}
                  </>
                )}
              </div>


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
