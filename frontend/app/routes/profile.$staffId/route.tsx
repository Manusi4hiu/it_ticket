import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Mail,
  AtSign,
  Phone,
  Ticket as TicketIcon,
  CheckCircle2,
  Clock,
  Inbox,
  Hourglass,
  AlertTriangle,
  ChevronRight,
  Calendar,
  Monitor,
  Layers,
  Wifi,
  Server,
  Tag,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Shield,
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { getTickets, getAgents, type Ticket } from "~/services/ticket.service";
import { usersApi } from "~/services/api.service";
import { requireAuth } from "~/services/session.service";
import type { Route } from "./+types/route";
import styles from "./style.module.css";

export interface ProfileStaff {
  id: string | number;
  name: string;
  username: string;
  email: string;
  phone?: string | null;
  role?: string;
  department?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  updatedAt?: string | null;
}

export type ProfileLoaderData = {
  session: any;
  staffId: string;
  staff: ProfileStaff | null;
  isAgent: boolean;
  tickets: Ticket[];
  performance: any | null;
  agents: any[];
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const staffId = params.staffId;

  // User can only view their own profile unless they are Admin or Management
  const isAuthorized =
    String(session.userId) === String(staffId) ||
    session.userRole === "Administrator" ||
    session.userRole === "Management";
  if (!isAuthorized) {
    throw new Response("Forbidden", { status: 403 });
  }

  // Fetch data in parallel:
  // 1. Standard helpdesk tickets
  // 2. Dev-scoped tickets (if any) so all tickets user ever worked on are fetched
  // 3. Agents list
  // 4. User profile master data
  // 5. Backend performance analytics
  const [ticketResponse, devTicketResponse, agents, userResponse, perfResponse] = await Promise.all([
    getTickets({ per_page: 200 }),
    getTickets({ category: "Development", per_page: 200 }).catch(() => ({ tickets: [], total: 0 })),
    getAgents(),
    usersApi.getById(staffId as string),
    usersApi.getPerformance(staffId as string).catch(() => ({ success: false, data: undefined })),
  ]);

  // Combine and deduplicate tickets by id
  const ticketMap = new Map<number, Ticket>();
  (ticketResponse.tickets || []).forEach((t) => ticketMap.set(t.id, t));
  (devTicketResponse.tickets || []).forEach((t) => ticketMap.set(t.id, t));
  const combinedTickets = Array.from(ticketMap.values());

  // Find staff info from userResponse or agents
  let staff: ProfileStaff | null = null;
  if (userResponse.success && userResponse.data?.user) {
    const u = userResponse.data.user;
    staff = {
      id: u.id,
      name: u.full_name,
      username: u.username,
      email: u.email || "",
      phone: u.phone,
      role: u.role,
      department: u.department,
      avatarUrl: u.avatar_url,
      isActive: (u as any).is_active ?? true,
      updatedAt: (u as any).updated_at,
    };
  } else {
    const a = agents.find((ag) => String(ag.id) === String(staffId));
    if (a) {
      staff = {
        id: a.id,
        name: a.name,
        username: a.username,
        email: a.email,
        phone: a.phone,
        role: "IT Support Staff",
        isActive: true,
      };
    }
  }

  const isAgent =
    agents.some((a) => String(a.id) === String(staffId)) ||
    staff?.role === "Staff" ||
    staff?.role === "Administrator";

  return {
    session,
    staffId: staffId || "",
    staff,
    isAgent,
    tickets: combinedTickets,
    performance: perfResponse.success && perfResponse.data ? perfResponse.data.performance : null,
    agents,
  };
}

// ─────────────────────────────────────────────
// Donut Chart Component (Crisp SVG)
// ─────────────────────────────────────────────
export interface DonutSlice {
  label: string;
  count: number;
  color: string;
}

function DonutChart({
  slices,
  total,
}: {
  slices: DonutSlice[];
  total: number;
}) {
  const size = 150;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className={styles.donutWrapper}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.donutSvg}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />
        </svg>
        <div className={styles.donutCenterText}>
          <span className={styles.donutTotalNumber}>0</span>
          <span className={styles.donutTotalLabel}>Total</span>
        </div>
      </div>
    );
  }

  const activeSlices = slices.filter((s) => s.count > 0);
  const gap = activeSlices.length > 1 ? 4 : 0;
  let accumulatedLen = 0;

  return (
    <div className={styles.donutWrapper}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.donutSvg}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Dynamic Slices */}
        {activeSlices.map((slice) => {
          const sliceLen = (slice.count / total) * circumference;
          const dashLen = Math.max(0, sliceLen - gap);
          const offset = -accumulatedLen;
          accumulatedLen += sliceLen;

          return (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <div className={styles.donutCenterText}>
        <span className={styles.donutTotalNumber}>{total}</span>
        <span className={styles.donutTotalLabel}>Total</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Format Helpers
// ─────────────────────────────────────────────
function formatTicketDate(dateInput: Date | string | undefined): string {
  if (!dateInput) return "N/A";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";

  const actualMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = actualMonths[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${month} ${day}, ${year} ${hours}:${minutes}`;
}

function formatPriority(priority: string | undefined): { label: string; dotColor: string } {
  const p = (priority || "").toLowerCase();
  switch (p) {
    case "critical":
      return { label: "Critical", dotColor: "#ef4444" };
    case "high":
      return { label: "High", dotColor: "#f87171" };
    case "medium":
      return { label: "Medium", dotColor: "#f59e0b" };
    case "low":
      return { label: "Low", dotColor: "#10b981" };
    default:
      return { label: priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : "Low", dotColor: "#94a3b8" };
  }
}

function getCategoryIcon(category: string | undefined) {
  const c = (category || "").toLowerCase();
  if (c.includes("hard") || c.includes("device") || c.includes("pc") || c.includes("laptop") || c.includes("printer")) {
    return <Monitor className={styles.metaSmallIcon} />;
  }
  if (c.includes("soft") || c.includes("app") || c.includes("license") || c.includes("jira")) {
    return <Layers className={styles.metaSmallIcon} />;
  }
  if (c.includes("net") || c.includes("wifi") || c.includes("vpn") || c.includes("internet") || c.includes("lan")) {
    return <Wifi className={styles.metaSmallIcon} />;
  }
  if (c.includes("sys") || c.includes("server") || c.includes("infra") || c.includes("database")) {
    return <Server className={styles.metaSmallIcon} />;
  }
  return <Tag className={styles.metaSmallIcon} />;
}

function getRoleQuote(role: string | undefined) {
  const r = (role || "").toLowerCase();
  if (r.includes("admin")) {
    return { line1: "Overseeing systems,", line2: "empowering productivity." };
  }
  if (r.includes("manage")) {
    return { line1: "Guiding excellence,", line2: "delivering results." };
  }
  return { line1: "Keep solving,", line2: "keep improving." };
}

// ─────────────────────────────────────────────
// Profile Page Component
// ─────────────────────────────────────────────
export default function StaffProfile({ loaderData }: Route.ComponentProps) {
  const { session, staffId, staff, isAgent, tickets, performance } = loaderData as ProfileLoaderData;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"all" | "in-progress" | "assigned" | "pending" | "resolved" | "breached">("all");

  if (!staff) {
    return (
      <div className={styles.notFound}>
        <Shield className={styles.notFoundIcon} />
        <h1 className={styles.notFoundTitle}>Profile Not Found</h1>
        <p>Unable to locate staff profile information.</p>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  // Synchronize tickets this staff member has worked on
  const staffTickets = useMemo(() => {
    const staffIdStr = String(staff.id || staffId);
    const staffNameLower = (staff.name || "").toLowerCase().trim();
    const staffUserLower = (staff.username || "").toLowerCase().trim();
    const staffEmailLower = (staff.email || "").toLowerCase().trim();

    // Tickets assigned to or worked on by this staff member:
    // For agents/staff: ONLY include tickets where they are ASSIGNED or COLLABORATOR!
    // Never include tickets merely because the user submitted them or wrote a triage note.
    const assigned = isAgent
      ? tickets.filter((t: Ticket) => {
          const isAssigned =
            (t.assignedToId != null && String(t.assignedToId) === staffIdStr) ||
            (t.assignedTo &&
              (t.assignedTo.toLowerCase().trim() === staffNameLower ||
                t.assignedTo.toLowerCase().trim() === staffUserLower ||
                (staffEmailLower && t.assignedTo.toLowerCase().trim() === staffEmailLower)));

          const isCollab =
            (t.collaboratorIds && t.collaboratorIds.some((cid) => String(cid) === staffIdStr)) ||
            (t.collaborators &&
              t.collaborators.some((c) => {
                const cl = c.toLowerCase().trim();
                return cl === staffNameLower || cl === staffUserLower;
              }));

          return isAssigned || isCollab;
        })
      : tickets.filter((t: Ticket) => {
          // For non-staff (requesters), show tickets they submitted
          return (
            (staffEmailLower && t.submitterEmail && t.submitterEmail.toLowerCase().trim() === staffEmailLower) ||
            (staffNameLower && t.submitterName && t.submitterName.toLowerCase().trim() === staffNameLower)
          );
        });

    const resolved = assigned.filter((t: Ticket) => {
      const s = (t.status || "").toLowerCase().trim();
      return s === "resolved" || s === "closed" || s === "completed" || s === "done";
    });

    const inProgress = assigned.filter((t: Ticket) => {
      const s = (t.status || "").toLowerCase().trim();
      return (
        s.includes("progress") ||
        s.includes("work") ||
        s.includes("dev") ||
        s === "investigating"
      );
    });

    // Newly assigned / open queue
    const newlyAssigned = assigned.filter((t: Ticket) => {
      const s = (t.status || "").toLowerCase().trim();
      return s === "assigned" || s === "new" || s === "open" || s === "triaged";
    });

    // Strictly pending (on hold / waiting)
    const pending = assigned.filter((t: Ticket) => {
      const s = (t.status || "").toLowerCase().trim();
      return s.includes("pending") || s.includes("hold") || s.includes("wait");
    });

    const breached = assigned.filter((t: Ticket) => t.slaStatus === "breached");

    // Calculate real resolution times
    const resTimes = resolved
      .filter((t: Ticket) => t.resolvedAt && t.createdAt)
      .map((t: Ticket) => {
        const diff = new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime();
        return diff / (1000 * 60 * 60); // Hours
      })
      .filter((h) => !isNaN(h) && h >= 0);

    const avgResTime =
      resTimes.length > 0
        ? resTimes.reduce((a, b) => a + b, 0) / resTimes.length
        : performance?.avgResolutionTime != null && performance.avgResolutionTime > 0
        ? performance.avgResolutionTime
        : 0;

    const resRate = assigned.length > 0 ? (resolved.length / assigned.length) * 100 : 0;
    const slaComp =
      assigned.length > 0
        ? ((assigned.length - breached.length) / assigned.length) * 100
        : performance?.slaCompliance != null
        ? performance.slaCompliance
        : 100;

    return {
      assigned,
      resolved,
      inProgress,
      newlyAssigned,
      pending,
      breached,
      avgResolutionTime: avgResTime,
      resolutionRate: resRate,
      slaCompliance: slaComp,
    };
  }, [tickets, staff, staffId, performance]);

  const {
    assigned: assignedTickets,
    resolved: resolvedTickets,
    inProgress: inProgressTickets,
    newlyAssigned: newlyAssignedTickets,
    pending: pendingTickets,
    breached: breachedTickets,
    avgResolutionTime,
    resolutionRate,
    slaCompliance,
  } = staffTickets;

  const totalAssigned = assignedTickets.length;
  const totalResolved = resolvedTickets.length;
  const totalInProgress = inProgressTickets.length;
  const totalNewlyAssigned = newlyAssignedTickets.length;
  const totalPending = pendingTickets.length;
  const totalBreached = breachedTickets.length;

  // Real dynamic workload distribution slices (Resolved, In Progress, Assigned, Pending)
  const donutSlices = useMemo(() => {
    const list = [
      { label: "Resolved", count: totalResolved, color: "#10b981" },
      { label: "In Progress", count: totalInProgress, color: "#0ea5e9" },
      { label: "Assigned", count: totalNewlyAssigned, color: "#818cf8" },
      { label: "Pending", count: totalPending, color: "#f59e0b" },
    ];
    return list.filter((s) => s.count > 0 || totalAssigned === 0);
  }, [totalResolved, totalInProgress, totalNewlyAssigned, totalPending, totalAssigned]);

  // Real month-over-month trend calculations
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const currentMonthTickets = assignedTickets.filter((t: Ticket) => {
    if (!t.createdAt) return false;
    const d = new Date(t.createdAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const prevMonthTickets = assignedTickets.filter((t: Ticket) => {
    if (!t.createdAt) return false;
    const d = new Date(t.createdAt);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  });

  const getTrendData = (currentList: Ticket[], prevList: Ticket[]) => {
    const curr = currentList.length;
    const prev = prevList.length;

    if (prev === 0 && curr === 0) {
      return { text: "0% vs last month", dir: "neutral" as const };
    }
    if (prev === 0) {
      return { text: `+${curr} this month`, dir: "up" as const };
    }
    const diff = curr - prev;
    const pct = Math.round((Math.abs(diff) / prev) * 100);
    if (diff > 0) {
      return { text: `${pct}% vs last month`, dir: "up" as const };
    }
    if (diff < 0) {
      return { text: `${pct}% vs last month`, dir: "down" as const };
    }
    return { text: "0% vs last month", dir: "neutral" as const };
  };

  const assignedTrend = getTrendData(currentMonthTickets, prevMonthTickets);
  const resolvedTrend = getTrendData(
    currentMonthTickets.filter((t) => ["resolved", "closed", "completed", "done"].includes((t.status || "").toLowerCase())),
    prevMonthTickets.filter((t) => ["resolved", "closed", "completed", "done"].includes((t.status || "").toLowerCase()))
  );
  const inProgressTrend = getTrendData(
    currentMonthTickets.filter((t) => (t.status || "").toLowerCase().includes("progress")),
    prevMonthTickets.filter((t) => (t.status || "").toLowerCase().includes("progress"))
  );
  const assignedNewTrend = getTrendData(
    currentMonthTickets.filter((t) => ["assigned", "new", "open", "triaged"].includes((t.status || "").toLowerCase().trim())),
    prevMonthTickets.filter((t) => ["assigned", "new", "open", "triaged"].includes((t.status || "").toLowerCase().trim()))
  );
  const breachedTrend = getTrendData(
    currentMonthTickets.filter((t) => t.slaStatus === "breached"),
    prevMonthTickets.filter((t) => t.slaStatus === "breached")
  );

  const renderTrendBadge = (trend: { text: string; dir: "up" | "down" | "neutral" }, defaultColorClass: string) => {
    if (trend.dir === "up") {
      return (
        <div className={`${styles.statTrend} ${styles.trendGreen}`}>
          <TrendingUp style={{ width: 12, height: 12 }} />
          <span>{trend.text}</span>
        </div>
      );
    }
    if (trend.dir === "down") {
      return (
        <div className={`${styles.statTrend} ${styles.trendRed}`}>
          <TrendingDown style={{ width: 12, height: 12 }} />
          <span>{trend.text}</span>
        </div>
      );
    }
    return (
      <div className={`${styles.statTrend} ${defaultColorClass}`}>
        <ArrowRight style={{ width: 12, height: 12 }} />
        <span>{trend.text}</span>
      </div>
    );
  };

  // Tickets displayed for active tab
  const displayedTickets = useMemo(() => {
    switch (activeTab) {
      case "in-progress":
        return inProgressTickets;
      case "assigned":
        return newlyAssignedTickets;
      case "pending":
        return pendingTickets;
      case "resolved":
        return resolvedTickets;
      case "breached":
        return breachedTickets;
      case "all":
      default:
        return assignedTickets;
    }
  }, [activeTab, assignedTickets, inProgressTickets, newlyAssignedTickets, pendingTickets, resolvedTickets, breachedTickets]);

  const renderStatusBadge = (ticket: Ticket) => {
    const isBreached = ticket.slaStatus === "breached";
    const statusLower = (ticket.status || "").toLowerCase().trim();

    if (activeTab === "breached" || (isBreached && activeTab === "all")) {
      return (
        <span className={`${styles.ticketStatusPill} ${styles.ticketStatusPillRed}`}>
          ● SLA Breached
        </span>
      );
    }

    if (statusLower === "resolved" || statusLower === "closed" || statusLower === "completed" || statusLower === "done") {
      return (
        <span className={`${styles.ticketStatusPill} ${styles.ticketStatusPillGreen}`}>
          ● Resolved
        </span>
      );
    }

    if (statusLower.includes("progress") || statusLower.includes("work") || statusLower.includes("dev") || statusLower === "investigating") {
      return (
        <span className={`${styles.ticketStatusPill} ${styles.ticketStatusPillBlue}`}>
          ● In Progress
        </span>
      );
    }

    if (statusLower === "assigned" || statusLower === "new" || statusLower === "open" || statusLower === "triaged") {
      return (
        <span className={`${styles.ticketStatusPill} ${styles.ticketStatusPillIndigo}`}>
          ● Assigned
        </span>
      );
    }

    if (statusLower.includes("pending") || statusLower.includes("hold") || statusLower.includes("wait")) {
      return (
        <span className={`${styles.ticketStatusPill} ${styles.ticketStatusPillAmber}`}>
          ● Pending
        </span>
      );
    }

    return (
      <span className={`${styles.ticketStatusPill} ${styles.ticketStatusPillAmber}`}>
        ● {ticket.status || "Pending"}
      </span>
    );
  };

  const renderTicketCard = (ticket: Ticket) => {
    const priorityInfo = formatPriority(ticket.priority);
    const ticketCode = ticket.ticketCode || `IT-${String(ticket.id).padStart(4, "0")}`;

    return (
      <div
        key={ticket.id}
        className={styles.ticketCard}
        onClick={() => navigate(`/ticket/${ticket.ticketCode || ticket.id}`)}
      >
        <div className={styles.ticketCardTop}>
          <div className={styles.ticketIdGroup}>
            <TicketIcon className={styles.ticketIdIcon} />
            <span className={styles.ticketIdText}>{ticketCode}</span>
          </div>
          {renderStatusBadge(ticket)}
          <ChevronRight className={styles.ticketChevron} />
        </div>

        <div className={styles.ticketCardBody}>
          <h4 className={styles.ticketCardTitle}>{ticket.title}</h4>
          <p className={styles.ticketCardDesc}>{ticket.description || "No description provided."}</p>
        </div>

        <div className={styles.ticketCardFooter}>
          <div className={styles.footerDateItem}>
            <Calendar className={styles.metaSmallIcon} />
            <span className={styles.dateText}>{formatTicketDate(ticket.createdAt)}</span>
          </div>
          <div className={styles.footerPriorityItem}>
            <span className={styles.priorityDot} style={{ background: priorityInfo.dotColor }} />
            <span className={styles.priorityText}>{priorityInfo.label}</span>
          </div>
          <div className={styles.footerCategoryItem}>
            {getCategoryIcon(ticket.category)}
            <span className={styles.categoryText} title={ticket.category || "General"}>
              {ticket.category || "General"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const quote = getRoleQuote(staff.role);

  return (
    <div className={styles.pageWrapper}>
      {/* ─────────────────────────────────────────────
          1. Hero Banner Profile Header (Synced with Master Data)
          ───────────────────────────────────────────── */}
      <div className={styles.heroCard}>
        <div className={styles.heroLeft}>
          {staff.avatarUrl ? (
            <img
              src={staff.avatarUrl}
              alt={staff.name}
              className={styles.avatarCircle}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className={styles.avatarCircle}>
              {staff.name ? staff.name.charAt(0).toUpperCase() : staff.username ? staff.username.charAt(0).toUpperCase() : "U"}
            </div>
          )}

          <div className={styles.heroDetails}>
            <div className={styles.nameRow}>
              <h1 className={styles.profileName}>{staff.name || staff.username || "Staff User"}</h1>
              <span className={styles.roleBadge}>
                {staff.role === "Staff" ? "IT Support Staff" : staff.role || "IT Support Staff"}
              </span>
            </div>

            <div className={styles.contactRow}>
              <div className={styles.contactItem}>
                <Mail className={styles.contactIcon} />
                <span>{staff.email || (staff.username ? `${staff.username.toLowerCase()}@itano.co.id` : "No email")}</span>
              </div>
              <div className={styles.contactItem}>
                <AtSign className={styles.contactIcon} />
                <span>@{staff.username || "user"}</span>
              </div>
              <div className={styles.contactItem}>
                <Phone className={styles.contactIcon} />
                <span>{staff.phone || "No phone registered"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.quoteBox}>
          <p className={styles.quoteText}>
            &ldquo;{quote.line1}
            <br />
            {quote.line2}&rdquo;
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          2. Top Metrics (5 Stat Cards Synced with Real Tickets)
          ───────────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        {/* Total Assigned / Worked On */}
        <div
          className={styles.statCard}
          onClick={() => setActiveTab("all")}
          style={{ cursor: "pointer" }}
        >
          <div className={`${styles.statIconBox} ${styles.statIconBoxBlue}`}>
            <TicketIcon className={styles.statIcon} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>{isAgent ? "Total Assigned" : "Total Submitted"}</span>
            <div className={styles.statValue}>{totalAssigned}</div>
            {renderTrendBadge(assignedTrend, styles.trendBlue)}
          </div>
        </div>

        {/* Resolved */}
        <div
          className={styles.statCard}
          onClick={() => setActiveTab("resolved")}
          style={{ cursor: "pointer" }}
        >
          <div className={`${styles.statIconBox} ${styles.statIconBoxGreen}`}>
            <CheckCircle2 className={styles.statIcon} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Resolved</span>
            <div className={styles.statValue}>{totalResolved}</div>
            {renderTrendBadge(resolvedTrend, styles.trendGreen)}
          </div>
        </div>

        {/* In Progress */}
        <div
          className={styles.statCard}
          onClick={() => setActiveTab("in-progress")}
          style={{ cursor: "pointer" }}
        >
          <div className={`${styles.statIconBox} ${styles.statIconBoxCyan}`}>
            <Clock className={styles.statIcon} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>In Progress</span>
            <div className={styles.statValue}>{totalInProgress}</div>
            {renderTrendBadge(inProgressTrend, styles.trendCyan)}
          </div>
        </div>

        {/* Assigned (New / Waiting) */}
        <div
          className={styles.statCard}
          onClick={() => setActiveTab("assigned")}
          style={{ cursor: "pointer" }}
        >
          <div className={`${styles.statIconBox} ${styles.statIconBoxAmber}`}>
            <Inbox className={styles.statIcon} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Assigned</span>
            <div className={styles.statValue}>{totalNewlyAssigned}</div>
            {renderTrendBadge(assignedNewTrend, styles.trendAmber)}
          </div>
        </div>

        {/* SLA Breached */}
        <div
          className={styles.statCard}
          onClick={() => setActiveTab("breached")}
          style={{ cursor: "pointer" }}
        >
          <div className={`${styles.statIconBox} ${styles.statIconBoxRed}`}>
            <AlertTriangle className={styles.statIcon} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>SLA Breached</span>
            <div className={styles.statValue}>{totalBreached}</div>
            {renderTrendBadge(breachedTrend, styles.trendRed)}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          3. Middle Section (Performance & Workload Synced)
          ───────────────────────────────────────────── */}
      <div className={styles.middleGrid}>
        {/* Performance Overview */}
        <div className={styles.middleCard}>
          <h3 className={styles.cardHeaderTitle}>Performance Overview</h3>
          <div className={styles.progressList}>
            {/* Resolution Rate */}
            <div className={styles.progressItem}>
              <div className={styles.progressLabelRow}>
                <span className={styles.progressName}>Resolution Rate</span>
                <span className={styles.progressNumber}>{Math.round(resolutionRate)}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFillCyan}
                  style={{ width: `${Math.min(100, Math.max(0, resolutionRate))}%` }}
                />
              </div>
            </div>

            {/* SLA Compliance */}
            <div className={styles.progressItem}>
              <div className={styles.progressLabelRow}>
                <span className={styles.progressName}>SLA Compliance</span>
                <span className={styles.progressNumber}>{Math.round(slaCompliance)}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFillGreen}
                  style={{ width: `${Math.min(100, Math.max(0, slaCompliance))}%` }}
                />
              </div>
            </div>

            {/* Avg Resolution Time */}
            <div className={styles.avgTimeSection}>
              <span className={styles.avgTimeLabel}>Avg. Resolution Time</span>
              <div className={styles.avgTimeValue}>
                <Clock className={styles.avgTimeIcon} />
                <span>{avgResolutionTime > 0 ? `${avgResolutionTime.toFixed(1)} hours` : "0.0 hours"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workload Distribution */}
        <div className={styles.middleCard}>
          <h3 className={styles.cardHeaderTitle}>Workload Distribution</h3>
          <div className={styles.workloadContent}>
            <DonutChart slices={donutSlices} total={totalAssigned} />

            <div className={styles.workloadLegend}>
              {donutSlices.map((slice) => {
                const pct = totalAssigned > 0 ? Math.round((slice.count / totalAssigned) * 100) : 0;
                return (
                  <div key={slice.label} className={styles.legendRow}>
                    <div className={styles.legendLeft}>
                      <span className={styles.legendDot} style={{ background: slice.color }} />
                      <span>{slice.label}</span>
                    </div>
                    <span className={styles.legendCount}>
                      {slice.count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          4. Bottom Tickets Section
          ───────────────────────────────────────────── */}
      <div className={styles.ticketsSection}>
        <div className={styles.tabsBar}>
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === "all" ? styles.tabPillActive : ""}`}
            onClick={() => setActiveTab("all")}
          >
            {isAgent ? "All Assigned" : "All Submitted"} ({totalAssigned})
          </button>
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === "in-progress" ? styles.tabPillActive : ""}`}
            onClick={() => setActiveTab("in-progress")}
          >
            In Progress ({totalInProgress})
          </button>
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === "assigned" ? styles.tabPillActive : ""}`}
            onClick={() => setActiveTab("assigned")}
          >
            Assigned ({totalNewlyAssigned})
          </button>
          {totalPending > 0 && (
            <button
              type="button"
              className={`${styles.tabPill} ${activeTab === "pending" ? styles.tabPillActive : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              Pending ({totalPending})
            </button>
          )}
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === "resolved" ? styles.tabPillActive : ""}`}
            onClick={() => setActiveTab("resolved")}
          >
            Resolved ({totalResolved})
          </button>
          <button
            type="button"
            className={`${styles.tabPill} ${activeTab === "breached" ? styles.tabPillActive : ""}`}
            onClick={() => setActiveTab("breached")}
          >
            SLA Breached ({totalBreached})
          </button>
        </div>

        <div className={styles.ticketsGrid}>
          {displayedTickets.length === 0 ? (
            <div className={styles.emptyStateCard}>
              <TicketIcon className={styles.emptyIcon} />
              <p className={styles.emptyText}>Tidak ada tiket pada kategori ini</p>
            </div>
          ) : (
            displayedTickets.map(renderTicketCard)
          )}
        </div>
      </div>
    </div>
  );
}
