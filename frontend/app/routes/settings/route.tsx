import { Outlet, NavLink, Link, useLoaderData } from "react-router";
import {
    Settings,
    Users,
    Tag,
    Flag,
    ArrowLeft,
    Building2,
    ClipboardList,
    Coffee
} from "lucide-react";
import type { Route } from "./+types/route";
import { requireRole } from "~/services/session.service";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
    // Ensure only admin can access settings
    await requireRole(request, ["Administrator"]);
    return Response.json({});
}

export default function SettingsLayout() {
    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.sidebarBrand}>
                        <Settings className={styles.sidebarIcon} />
                        <h2 className={styles.sidebarTitle}>Settings</h2>
                    </div>
                    <Link to="/dashboard" className={styles.backLink}>
                        <ArrowLeft className={styles.backIcon} />
                        <span>Dashboard</span>
                    </Link>
                </div>

                <nav className={styles.nav}>
                    <NavLink
                        to="/settings/role-management"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Users size={16} className={styles.navIcon} />
                        <span>Role Management</span>
                    </NavLink>

                    <NavLink
                        to="/settings/categories"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Tag size={16} className={styles.navIcon} />
                        <span>Categories</span>
                    </NavLink>

                    <NavLink
                        to="/settings/departments"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Building2 size={16} className={styles.navIcon} />
                        <span>Departments</span>
                    </NavLink>

                    <NavLink
                        to="/settings/priorities"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Flag size={16} className={styles.navIcon} />
                        <span>Priorities & SLA</span>
                    </NavLink>

                    <NavLink
                        to="/settings/statuses"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <ClipboardList size={16} className={styles.navIcon} />
                        <span>Statuses</span>
                    </NavLink>

                    <NavLink
                        to="/settings/break"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    >
                        <Coffee size={16} className={styles.navIcon} />
                        <span>Break Limits</span>
                    </NavLink>
                </nav>
            </aside>

            <main className={styles.content}>
                <Outlet />
            </main>
        </div>
    );
}
