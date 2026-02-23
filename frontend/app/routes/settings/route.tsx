import { Outlet, NavLink, Link, useLoaderData } from "react-router";
import {
    Settings,
    Users,
    Tag,
    Flag,
    Clock,
    ArrowLeft,
    Building2,
    ClipboardList
} from "lucide-react";
import type { Route } from "./+types/route";
import { requireRole } from "~/services/session.service";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
    // Ensure only admin can access settings
    await requireRole(request, ["Administrator"]);
    return {};
}

export default function SettingsLayout() {
    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Link to="/dashboard" className={styles.backLink}>
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        Back to Dashboard
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <Settings className={styles.sidebarIcon} />
                        <h2 className={styles.sidebarTitle}>Settings</h2>
                    </div>
                </div>

                <nav className={styles.nav}>
                    <NavLink
                        to="/settings/role-management"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Users size={18} />
                        Role Management
                    </NavLink>

                    <NavLink
                        to="/settings/categories"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Tag size={18} />
                        Ticket Categories
                    </NavLink>

                    <NavLink
                        to="/settings/departments"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Building2 size={18} />
                        Departments
                    </NavLink>

                    <NavLink
                        to="/settings/priorities"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Flag size={18} />
                        Priorities & SLA
                    </NavLink>

                    <NavLink
                        to="/settings/logs"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <ClipboardList size={18} />
                        System Logs
                    </NavLink>

                    {/* 
          <NavLink 
            to="/settings/sla-policies" 
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
          >
            <Clock size={18} />
            SLA Policies
          </NavLink>
          */}
                </nav>
            </aside>

            <main className={styles.content}>
                <Outlet />
            </main>
        </div>
    );
}
