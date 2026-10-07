import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, Form, redirect, NavLink, useLocation } from "react-router";
import {
  User,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Inbox,
  Kanban,
  Calendar
} from "lucide-react";
import { NotificationBell } from "~/components/notification-bell";
import { getUserSession, logout } from "~/services/session.service";
import { setAuthToken, usersApi } from "~/services/api.service";
import type { Route } from "./+types/layout";
import styles from "./layout.module.css";
import { useIdleTimeout } from "~/hooks/use-idle-timeout";
import { SessionWarningModal } from "~/components/session-warning-modal";
import { StaffStatusWidget } from "~/components/staff-status-widget";
import { GlobalBreakModal } from "~/components/global-break-modal";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getUserSession(request);
  return { session };
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method === 'POST') {
    const formData = await request.formData();
    const intent = formData.get('intent');

    if (intent === 'logout') {
      // Unsubscribe push sebelum clear session — device shared gak ke-tagih notif orang lain.
      // Silent fail: gak mau push error nge-block logout.
      if (typeof window !== 'undefined') {
        const { unsubscribePush } = await import('~/services/push.service');
        await unsubscribePush().catch(() => {});
      }
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

  // Role yang boleh melihat Dev Board (Management view-only)
  const canAccessDevBoard = isAdministrator || session?.userRole === 'Staff' || session?.userRole === 'Management';

  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("app_mode_dev");
    // Jangan izinkan mode Dev tersimpan untuk role tanpa akses dev board
    // (localStorage persist antar sesi/user — guard agar Management tidak terjebak)
    if (saved === "true" && canAccessDevBoard) {
      setIsDevMode(true);
    } else {
      if (saved === "true") {
        localStorage.removeItem("app_mode_dev");
      }
      setIsDevMode(false);
    }
  }, [canAccessDevBoard]);

  // ── KRITIS: Sync JWT token dari SSR session ke in-memory client-side (BUG 5 fix)
  // `getUserSession()` hanya berjalan di server. Setelah browser hydration,
  // `authToken` di api.service.ts kembali null. Sync secara sinkron saat render
  // agar child fetch di render pertama sudah dapat token (hindari race 401).
  if (typeof window !== "undefined" && session?.authToken) {
    setAuthToken(session.authToken);
  }
  useEffect(() => {
    if (session?.authToken) {
      setAuthToken(session.authToken);
    }
  }, [session]);

  const handleToggleMode = (dev: boolean) => {
    setIsDevMode(dev);
    localStorage.setItem("app_mode_dev", String(dev));
    if (dev) {
      navigate("/dev-dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  const WARNING_MINUTES = 2; // tampilkan warning 2 menit sebelum logout
  const { showWarning, secondsLeft, extendSession, logoutNow } = useIdleTimeout(
    480,
    !!session,
    WARNING_MINUTES
  );

  // Ref untuk track status break — diperbarui via event 'break-toggled'.
  // Dipakai oleh auto-idle agar tidak overwrite presence saat staff sedang break.
  const isOnBreakRef = useRef(false);

  useEffect(() => {
    if (!session?.userId) return;
    // Cek status break awal dari backend
    usersApi.getById(String(session.userId))
      .then(res => {
        if (res.success && res.data?.user) {
          isOnBreakRef.current =
            res.data.user.isOnBreak || res.data.user.presenceStatus === 'break';
        }
      })
      .catch(() => {});

    const onBreakToggled = () => {
      // Re-check backend setelah toggle break
      usersApi.getById(String(session.userId))
        .then(res => {
          if (res.success && res.data?.user) {
            isOnBreakRef.current =
              res.data.user.isOnBreak || res.data.user.presenceStatus === 'break';
          }
        })
        .catch(() => {});
    };
    window.addEventListener('break-toggled', onBreakToggled);
    return () => window.removeEventListener('break-toggled', onBreakToggled);
  }, [session?.userId]);

  // Auto-Idle detection (5 minutes) — dinonaktifkan saat staff sedang break
  useEffect(() => {
    if (!session?.userId) return;

    let idleTimer: NodeJS.Timeout;
    let isIdle = false;

    const handleActivity = () => {
      // Jangan ubah presence apapun selama staff sedang break
      if (isOnBreakRef.current) {
        clearTimeout(idleTimer);
        return;
      }

      if (isIdle) {
        isIdle = false;
        usersApi.setPresenceStatus(session.userId, 'online').catch(() => {});
      }

      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Double-check break status sebelum set idle
        if (isOnBreakRef.current) return;
        isIdle = true;
        usersApi.setPresenceStatus(session.userId, 'idle').catch(() => {});
      }, 5 * 60 * 1000); // 5 minutes
    };

    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          handleActivity();
          throttleTimer = null;
        }, 2000);
      }
      if (isIdle) handleActivity(); // break out immediately
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, throttledActivity));

    handleActivity();

    return () => {
      events.forEach(e => document.removeEventListener(e, throttledActivity));
      clearTimeout(idleTimer);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [session?.userId]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft} onClick={() => navigate(canAccessDevBoard && isDevMode ? "/dev-dashboard" : "/dashboard")} style={{ cursor: "pointer" }}>
            <div className={styles.logoContainer}>
              <img src="/logo/logo itani.png" alt="Logo" className={styles.headerIcon} />
            </div>
            <h1 className={styles.headerTitle}>
              {isDevMode ? "IT Aero Dev" : "IT Aero Support"}
            </h1>
          </div>

          {session && (
            <nav className={styles.navBar}>
              {/* Dev Team toggle hanya untuk Administrator & Staff (Management view-only helpdesk) */}
              {canAccessDevBoard && (
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
              )}

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
                    <NavLink
                      to="/calendar"
                      className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                    >
                      <Calendar className={styles.navIcon} />
                      <span className={styles.navLabel}>Calendar</span>
                    </NavLink>
                    {isAdministrator && (
                      <>
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

      {showWarning && (
        <SessionWarningModal
          secondsLeft={secondsLeft}
          totalSeconds={WARNING_MINUTES * 60}
          onExtend={extendSession}
          onLogout={logoutNow}
        />
      )}

      {session && <StaffStatusWidget />}
      {session?.userId && <GlobalBreakModal userId={session.userId} />}
    </div>
  );
}
