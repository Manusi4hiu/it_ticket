import { useState, useEffect, useMemo, useRef } from "react";
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
  Circle,
  Plus,
  Trash2,
} from "lucide-react";
import { NotificationBell } from "~/components/notification-bell";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { getTickets, getAgents, assignTicket, updateTicketPriority, deleteTicket, type Ticket, type Agent } from "~/services/ticket.service";
import { settingsApi, type Status } from "~/services/settings.service";
import { requireAuth, logout } from "~/services/session.service";
import { setAuthToken } from "~/services/api.service";
import { getTicketStats } from "~/services/ticket.service";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Parallel fetch for personal data
  const [activeResponse, completedResponse, agents, statusResponse, stats] = await Promise.all([
    getTickets({ assignedTo: session.userId, is_resolved: false, page: 1, per_page: 5 }),
    getTickets({ assignedTo: session.userId, is_resolved: true, page: 1, per_page: 5 }),
    getAgents(),
    settingsApi.getStatuses(),
    getTicketStats(true) // Personal stats
  ]);

  return {
    session,
    activeTickets: activeResponse.tickets,
    activeTotal: activeResponse.total,
    completedTickets: completedResponse.tickets,
    completedTotal: completedResponse.total,
    agents,
    statuses: statusResponse.data?.data || [],
    stats
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
  const { 
    session, 
    activeTickets: initialActive, 
    activeTotal,
    completedTickets: initialCompleted, 
    completedTotal,
    agents, 
    statuses, 
    stats 
  } = loaderData;
  const navigate = useNavigate();
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // State for active tickets
  const [activeTickets, setActiveTickets] = useState(initialActive);
  const [activePage, setActivePage] = useState(1);
  const [hasMoreActive, setHasMoreActive] = useState(initialActive.length < activeTotal);
  
  // State for completed tickets
  const [completedTickets, setCompletedTickets] = useState(initialCompleted);
  const [completedPage, setCompletedPage] = useState(1);
  const [hasMoreCompleted, setHasMoreCompleted] = useState(initialCompleted.length < completedTotal);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (session?.authToken) {
      setAuthToken(session.authToken);
    }
  }, [session]);

  // Current active data based on tab
  const tickets = activeTab === 'active' ? activeTickets : completedTickets;
  const hasMore = activeTab === 'active' ? hasMoreActive : hasMoreCompleted;
  const totalCount = activeTab === 'active' ? activeTotal : completedTotal;

  // Infinite Scroll Logic
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreTickets();
        }
      },
      { 
        root: tableWrapperRef.current,
        threshold: 0.1 
      }
    );

    const sentinel = document.getElementById("scroll-sentinel");
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, activeTab, activeTickets.length, completedTickets.length]);

  const loadMoreTickets = async () => {
    setIsLoadingMore(true);
    const isWorkingOnActive = activeTab === 'active';
    const nextPage = isWorkingOnActive ? activePage + 1 : completedPage + 1;
    
    const response = await getTickets({ 
      assignedTo: session.userId, 
      is_resolved: !isWorkingOnActive, 
      page: nextPage, 
      per_page: 5 
    });
    
    if (response.tickets.length > 0) {
      if (isWorkingOnActive) {
        setActiveTickets((prev) => [...prev, ...response.tickets]);
        setActivePage(nextPage);
        setHasMoreActive(activeTickets.length + response.tickets.length < activeTotal);
      } else {
        setCompletedTickets((prev) => [...prev, ...response.tickets]);
        setCompletedPage(nextPage);
        setHasMoreCompleted(completedTickets.length + response.tickets.length < completedTotal);
      }
    } else {
      if (isWorkingOnActive) setHasMoreActive(false);
      else setHasMoreCompleted(false);
    }
    setIsLoadingMore(false);
  };

  const updateTicketsState = (updated: Ticket) => {
    // If ticket is no longer assigned to me, remove it
    if (updated.assignedToId !== parseInt(session.userId)) {
      setActiveTickets(prev => prev.filter(t => t.id !== updated.id));
      setCompletedTickets(prev => prev.filter(t => t.id !== updated.id));
      return;
    }

    // Check if it should move between tabs
    const resolvedStatuses = ['resolved', 'closed', 'completed'];
    const isResolved = resolvedStatuses.includes(updated.status.toLowerCase());

    if (isResolved) {
      // Remove from active, add to completed if not already there
      setActiveTickets(prev => prev.filter(t => t.id !== updated.id));
      setCompletedTickets(prev => {
        if (prev.find(t => t.id === updated.id)) {
          return prev.map(t => t.id === updated.id ? updated : t);
        }
        return [updated, ...prev];
      });
    } else {
      // Remove from completed, add to active if not already there
      setCompletedTickets(prev => prev.filter(t => t.id !== updated.id));
      setActiveTickets(prev => {
        if (prev.find(t => t.id === updated.id)) {
          return prev.map(t => t.id === updated.id ? updated : t);
        }
        return [updated, ...prev];
      });
    }
  };

  const isAdministrator = session.userRole === 'Administrator';

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'new':
      case 'triaged':
      case 'assigned':
        return <Inbox className={styles.slaIcon} />;
      case 'in progress':
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
    const p = priority.toLowerCase();
    switch (p) {
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
    const s = status.toLowerCase();
    switch (s) {
      case 'new':
      case 'triaged':
      case 'assigned':
        return styles.statusNew;
      case 'in progress':
      case 'in-progress':
        return styles.statusInprogress;
      case 'resolved':
      case 'closed':
        return styles.statusResolved;
      default:
        return '';
    }
  };

  const formatStatus = (statusName: string) => {
    return statusName.charAt(0).toUpperCase() + statusName.slice(1);
  };

  const getStatusColor = (statusName: string) => {
    const status = statuses.find(s => s.name.toLowerCase() === statusName.toLowerCase());
    return status?.color || 'var(--color-neutral-8)';
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this ticket?")) {
      const success = await deleteTicket(id.toString());
      if (success) {
        setActiveTickets(prev => prev.filter(t => t.id !== id));
        setCompletedTickets(prev => prev.filter(t => t.id !== id));
      } else {
        alert("Failed to delete ticket");
      }
    }
  };

  return (
    <div className={styles.dashboardContainer}>
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
              <span className={styles.metricLabel}>My Active Tickets</span>
              <Inbox className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricNew}`}>{stats?.assigned || 0}</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>My Completed</span>
              <CheckCircle className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricResolved}`}>{stats?.resolved || 0}</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>My SLA Breached</span>
              <AlertTriangle className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricBreached}`}>{stats?.sla?.breached || 0}</div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Avg. Resolution</span>
              <Clock className={styles.metricIcon} />
            </div>
            <div className={`${styles.metricValue} ${styles.metricInProgress}`}>{stats?.avgResolutionTime || 0}h</div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <div className={styles.tabsContainer}>
              <button 
                className={`${styles.tab} ${activeTab === 'active' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('active')}
              >
                My Active Tickets
                <span className={styles.tabCount}>{activeTotal}</span>
              </button>
              <button 
                className={`${styles.tab} ${activeTab === 'completed' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                My Completed Tickets
                <span className={styles.tabCount}>{completedTotal}</span>
              </button>
            </div>
            <Button 
              size="sm" 
              onClick={() => navigate("/submit-ticket")}
              className={styles.createTicketBtn}
            >
              <Plus size={16} />
              Manual Ticket
            </Button>
          </div>

          {tickets.length === 0 ? (
            <div className={styles.emptyState}>
              <Inbox className={styles.emptyStateIcon} />
              <p className={styles.emptyStateText}>
                {activeTab === 'active' 
                  ? "You don't have any active tickets assigned" 
                  : "You haven't completed any tickets yet"}
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper} ref={tableWrapperRef}>
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
                    {isAdministrator && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className={styles.tableRow}>
                      <td onClick={() => navigate(`/ticket/${ticket.id}`)}>
                        <span className={styles.ticketId}>{ticket.ticketCode || ticket.id}</span>
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
                        <span 
                          className={styles.statusBadge} 
                          style={{ 
                            backgroundColor: `${getStatusColor(ticket.status)}15`, 
                            color: getStatusColor(ticket.status),
                            borderColor: `${getStatusColor(ticket.status)}30`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '100px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            border: '1px solid'
                          }}
                        >
                          <Circle size={10} fill={getStatusColor(ticket.status)} stroke={getStatusColor(ticket.status)} />
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
                                  updateTicketsState(updated);
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
                                  updateTicketsState(updated);
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
                                        updateTicketsState(updated);
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
                      {isAdministrator && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={styles.miniDeleteButton}
                            onClick={() => handleDelete(ticket.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Infinite Scroll Sentinel */}
              <div id="scroll-sentinel" className={styles.sentinel}>
                {isLoadingMore && (
                  <div className={styles.loadingMore}>
                    <CircleDot className={styles.loadingIcon} />
                    <span>Loading more tickets...</span>
                  </div>
                )}
                {!hasMore && tickets.length > 0 && (
                  <div className={styles.noMore}>
                    <span>No more tickets to load</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
