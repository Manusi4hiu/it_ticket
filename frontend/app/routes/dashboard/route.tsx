import { useState, useEffect, useMemo } from "react";
import { useNavigate, Form, redirect } from "react-router";
import type { Route } from "./+types/route";
import {
  Headphones,
  Inbox,
  Clock,
  CheckCircle,
  AlertTriangle,
  LogOut,
  BarChart3,
  BookOpen,
  User,
  Users,
  Shield,
  Tag,
  UserCheck,
  Settings,
  CircleDot,
} from "lucide-react";
import { NotificationBell } from "~/components/notification-bell";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { getTickets, getAgents, assignTicket, updateTicketPriority, type Ticket, type Agent } from "~/services/ticket.service";
import { requireAuth, logout } from "~/services/session.service";
import { setAuthToken } from "~/services/api.service";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Parallel fetch
  const [tickets, agents] = await Promise.all([
    getTickets(),
    getAgents()
  ]);

  return {
    session,
    tickets,
    agents,
  };
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

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { session, tickets: initialTickets, agents } = loaderData;
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(initialTickets);

  useEffect(() => {
    if (session?.authToken) {
      setAuthToken(session.authToken);
    }
  }, [session]);

  const isAdministrator = session.userRole === 'Administrator';

  const metrics = useMemo(() => ({
    new: tickets.filter((t) => t.status === 'new').length,
    inProgress: tickets.filter((t) => t.status === 'in-progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    critical: tickets.filter((t) => t.priority === 'critical' && t.status !== 'resolved' && t.status !== 'closed').length,
  }), [tickets]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
      case 'triaged':
      case 'assigned':
        return <Inbox className={styles.slaIcon} />;
      case 'in-progress':
        return <Clock className={styles.slaIcon} />;
      case 'resolved':
      case 'closed':
        return <CheckCircle className={styles.slaIcon} />;
      default:
        return <Inbox className={styles.slaIcon} />;
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'critical':
        return styles.priorityCritical;
      case 'high':
        return styles.priorityHigh;
      case 'medium':
        return styles.priorityMedium;
      case 'low':
        return styles.priorityLow;
      default:
        return '';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'new':
      case 'triaged':
      case 'assigned':
        return styles.statusNew;
      case 'in-progress':
        return styles.statusInprogress;
      case 'resolved':
      case 'closed':
        return styles.statusResolved;
      default:
        return '';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('-', ' ').replace(/^\w/, c => c.toUpperCase());
  };

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
          <nav className={styles.navBar}>
            <div className={styles.navGroup}>
              <button className={styles.navLink} onClick={() => navigate(`/profile/${session.userId}`)}>
                <User className={styles.navIcon} />
                <span className={styles.navLabel}>Profile</span>
              </button>
              <button className={styles.navLink} onClick={() => navigate("/staff-performance")}>
                <Users className={styles.navIcon} />
                <span className={styles.navLabel}>Performance</span>
              </button>
              {(isAdministrator || session.userRole === 'Management') && (
                <button className={styles.navLink} onClick={() => navigate("/analytics")}>
                  <BarChart3 className={styles.navIcon} />
                  <span className={styles.navLabel}>Analytics</span>
                </button>
              )}
              {isAdministrator && (
                <button className={styles.navLink} onClick={() => navigate("/settings/role-management")}>
                  <Settings className={styles.navIcon} />
                  <span className={styles.navLabel}>Settings</span>
                </button>
              )}
            </div>

            <div className={styles.navDivider}></div>

            <div className={styles.navActionGroup}>
              <NotificationBell userId={session.userId} />
              <Form method="post">
                <input type="hidden" name="intent" value="logout" />
                <button className={styles.logoutBtn} type="submit">
                  <LogOut className={styles.navIcon} />
                  <span className={styles.navLabel}>Logout</span>
                </button>
              </Form>
            </div>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {/* Welcome Section */}
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeContent}>
            <h2 className={styles.welcomeTitle}>
              Welcome, <span className={styles.userName}>{session.userName}</span>
            </h2>
          </div>
          <div className={styles.dateTime}>
            <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Metrics */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>New Tickets</span>
              <Inbox className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricNew}`}>{metrics.new}</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>In Progress</span>
              <Clock className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricInProgress}`}>{metrics.inProgress}</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Resolved</span>
              <CheckCircle className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricResolved}`}>{metrics.resolved}</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Critical</span>
              <AlertTriangle className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricBreached}`}>{metrics.critical}</div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Support Tickets</h2>
          </div>

          {tickets.length === 0 ? (
            <div className={styles.emptyState}>
              <Inbox className={styles.emptyStateIcon} />
              <p className={styles.emptyStateText}>No tickets available</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Submitter</th>
                    <th>Assigned To</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className={styles.tableRow}>
                      <td onClick={() => navigate(`/ticket/${ticket.id}`)}>
                        <span className={styles.ticketId}>{ticket.id}</span>
                      </td>
                      <td onClick={() => navigate(`/ticket/${ticket.id}`)}>
                        <span className={styles.ticketTitle}>{ticket.title}</span>
                      </td>
                      <td>
                        <Badge variant="outline" style={{ gap: "var(--space-1)" }}>
                          <Tag style={{ width: "12px", height: "12px" }} />
                          {ticket.category || 'General'}
                        </Badge>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(ticket.status)}`}>
                          {getStatusIcon(ticket.status)}
                          {formatStatus(ticket.status)}
                        </span>
                      </td>
                      <td>
                        {isAdministrator ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={ticket.priority.toLowerCase()}
                              onValueChange={async (val) => {
                                const updated = await updateTicketPriority(ticket.id, val);
                                if (updated) {
                                  setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
                                }
                              }}
                            >
                              <SelectTrigger className={`${styles.prioritySelect} ${getPriorityClass(ticket.priority.toLowerCase())}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <span className={`${styles.priorityBadge} ${getPriorityClass(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        )}
                      </td>
                      <td>{ticket.submitterName}</td>
                      <td>
                        {isAdministrator ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={ticket.assignedToId || "unassigned"}
                              onValueChange={async (val) => {
                                const agentId = val === "unassigned" ? null : val;
                                const updated = await assignTicket(ticket.id, agentId);
                                if (updated) {
                                  setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
                                }
                              }}
                            >
                              <SelectTrigger className={styles.assignSelect}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {agents.map(a => (
                                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className={styles.assigneeCell}>
                            {ticket.assignedTo ? (
                              <span className={styles.assignedName}>
                                <UserCheck style={{ width: "14px", height: "14px" }} />
                                {ticket.assignedTo}
                              </span>
                            ) : (
                              <div className={styles.takeAction}>
                                <span className={styles.unassignedText}>Unassigned</span>
                                {(session.userRole === 'Staff' || session.userRole === 'Administrator') && (
                                  <Button
                                    size="sm"
                                    className={styles.miniTakeButton}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const updated = await assignTicket(ticket.id, session.userId);
                                      if (updated) {
                                        setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
                                      }
                                    }}
                                  >
                                    Take
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        {new Date(ticket.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
