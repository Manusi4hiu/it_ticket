/**
 * route.tsx — System Logs
 *
 * Halaman untuk melihat log aktivitas sistem.
 *
 * @module settings/logs
 */

import { useState } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/route";
import { Card, CardContent } from "~/components/ui/card/card";
import { Input } from "~/components/ui/input/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { ClipboardList, Globe, User, Clock, Search, Filter, X } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import { runWithRole } from "~/services/session.service";
import styles from "../style.module.css";
import type { SystemLog } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    return runWithRole(request, ["Administrator"], async () => {
        const response = await settingsApi.getLogs();
        return { logs: response.data?.data || [] };
    });
}

export default function SystemLogsSettings() {
    const { logs } = useLoaderData() as { logs: SystemLog[] };
    const [searchQuery, setSearchQuery] = useState("");
    const [actionFilter, setActionFilter] = useState("all");

    // Get unique actions for filter
    const actions = ["all", ...new Set(logs.map(log => log.action).filter(Boolean))];

    const normalizedQuery = searchQuery.toLowerCase();
    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            (log.details ?? "").toLowerCase().includes(normalizedQuery) ||
            (log.userName ?? "").toLowerCase().includes(normalizedQuery) ||
            (log.ipAddress ?? "").toLowerCase().includes(normalizedQuery) ||
            (log.action ?? "").toLowerCase().includes(normalizedQuery);

        const matchesAction = actionFilter === "all" || log.action === actionFilter;

        return matchesSearch && matchesAction;
    });

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(date);
        } catch {
            return dateString;
        }
    };

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>System Logs</h1>
                        <p className={styles.pageDescription}>View system activity and ticket submission logs with IP details.</p>
                    </div>
                </div>
            </div>

            <div className={styles.filtersSection}>
                <div className={styles.logsSearchWrap}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.4)', width: 16, height: 16 }} />
                    <Input
                        placeholder="Search logs by action, user, or IP..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            paddingLeft: 38,
                            paddingRight: searchQuery ? 36 : undefined,
                            background: 'rgba(0, 0, 0, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            borderRadius: '12px'
                        }}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer' }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className={styles.logsFilterWrap}>
                    <div className={styles.logsFilterLabel}>
                        <Filter size={14} />
                        Filter:
                    </div>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className={styles.logsFilterTrigger}>
                            <SelectValue placeholder="Action" />
                        </SelectTrigger>
                        <SelectContent style={{ background: '#1e1b4b', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white' }}>
                            {actions.map(action => (
                                <SelectItem key={action} value={action} style={{ textTransform: 'capitalize' }}>
                                    {action === "all" ? "All Actions" : action}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className={styles.mainCard}>
                <CardContent>
                    {logs.length === 0 ? (
                        <div className={styles.logsEmptyState}>
                            <ClipboardList size={48} style={{ opacity: 0.2, display: 'block', margin: '0 auto 16px' }} />
                            No logs found.
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className={styles.desktopTable}>
                                <div className={styles.tableContainer}>
                                    <div className={styles.scrollableArea}>
                                        <table className={styles.dataTable}>
                                            <thead>
                                                <tr>
                                                    <th>Timestamp</th>
                                                    <th>Action</th>
                                                    <th>Details</th>
                                                    <th>User</th>
                                                    <th>IP Address</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredLogs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                                                            No matching logs found.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredLogs.map((log) => (
                                                        <tr key={log.id}>
                                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-neutral-10)', fontSize: '0.85rem' }}>
                                                                    <Clock size={14} />
                                                                    {formatDate(log.timestamp)}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className={styles.badge}>
                                                                    {log.action || "-"}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                    <span style={{ fontWeight: 500 }}>{log.details || "-"}</span>
                                                                    {log.targetId && (
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-9)' }}>
                                                                            Target ID: {log.targetId}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <User size={14} style={{ color: 'var(--color-neutral-9)' }} />
                                                                    {log.userName || "-"}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary-9)' }}>
                                                                    <Globe size={14} />
                                                                    <code style={{ fontSize: '0.9rem' }}>{log.ipAddress || "-"}</code>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Card List View */}
                            <div className={styles.mobileCardList}>
                                {filteredLogs.length === 0 ? (
                                    <div className={styles.logsEmptyState}>
                                        <ClipboardList size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
                                        No matching logs found.
                                    </div>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <div key={log.id} className={styles.settingCard}>
                                            <div className={styles.settingCardHeader} style={{ flexWrap: 'wrap' }}>
                                                <span className={styles.badge}>
                                                    {log.action || "-"}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                    <Clock size={13} />
                                                    <span>{formatDate(log.timestamp)}</span>
                                                </div>
                                            </div>

                                            <div className={styles.settingCardBody}>
                                                <p className={styles.settingCardDesc}>
                                                    {log.details || "-"}
                                                </p>

                                                {log.targetId && (
                                                    <div className={styles.settingCardMetaRow}>
                                                        <span className={styles.settingCardMetaLabel}>Target ID</span>
                                                        <span className={styles.settingCardMetaValue}>{log.targetId}</span>
                                                    </div>
                                                )}

                                                <div className={styles.settingCardMetaRow}>
                                                    <span className={styles.settingCardMetaLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <User size={13} /> User
                                                    </span>
                                                    <span className={styles.settingCardMetaValue}>{log.userName || "-"}</span>
                                                </div>

                                                <div className={styles.settingCardMetaRow}>
                                                    <span className={styles.settingCardMetaLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <Globe size={13} /> IP Address
                                                    </span>
                                                    <code className={styles.code}>{log.ipAddress || "-"}</code>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
