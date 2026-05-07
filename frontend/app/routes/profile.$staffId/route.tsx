import { useNavigate } from "react-router";
import { useMemo } from "react";
import { ArrowLeft, User, Mail, Briefcase, Target, Clock, CheckCircle, AlertCircle, Bell, Shield, Phone } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Card } from "~/components/ui/card/card";
import { Badge } from "~/components/ui/badge/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs/tabs";
import { getTickets, getAgents, type Ticket } from "~/services/ticket.service";
import { requireAuth } from "~/services/session.service";
import type { Route } from "./+types/route";
import styles from "./style.module.css";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const staffId = params.staffId;

  // User can only view their own profile unless they are Admin or Management
  const isAuthorized = session.userId === staffId || session.userRole === 'Administrator' || session.userRole === 'Management';
  if (!isAuthorized) {
    throw new Response('Forbidden', { status: 403 });
  }

  // Fetch data from API
  const [ticketResponse, agents] = await Promise.all([
    getTickets(),
    getAgents()
  ]);

  // Find staff info
  const staff = agents.find((a) => a.id === staffId);

  return {
    session,
    staffId,
    staff,
    tickets: ticketResponse.tickets,
    agents,
  };
}

export default function StaffProfile({ loaderData }: Route.ComponentProps) {
  const { session, staffId, staff, tickets, agents } = loaderData;
  const navigate = useNavigate();

  if (!staff) {
    return (
      <div className={styles.notFound}>
        <Shield className={styles.notFoundIcon} />
        <h1>Profile not found</h1>
        <p>Unable to load your profile information.</p>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  // Get all tickets assigned to this staff - Memoized
  const staffTickets = useMemo(() => {
    const assigned = tickets.filter((t) => t.assignedTo === staff.name);
    const resolved = assigned.filter((t) => t.status === "resolved" || t.status === "closed");
    const inProgress = assigned.filter((t) => t.status === "in-progress");
    const pending = assigned.filter((t) => t.status === "assigned");

    // Calculate resolution time
    const resTimes = resolved
      .filter((t) => t.resolvedAt && t.createdAt)
      .map((t) => {
        const diff = new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime();
        return diff / (1000 * 60 * 60); // Convert to hours
      });

    const avgResTime = resTimes.length > 0 ? resTimes.reduce((a, b) => a + b, 0) / resTimes.length : 0;
    const resRate = assigned.length > 0 ? (resolved.length / assigned.length) * 100 : 0;
    const slaComp = assigned.length > 0
      ? (assigned.filter((t) => t.slaStatus !== "breached").length / assigned.length) * 100
      : 0;

    return {
      assigned,
      resolved,
      inProgress,
      pending,
      avgResolutionTime: avgResTime,
      resolutionRate: resRate,
      slaCompliance: slaComp
    };
  }, [tickets, staff.name]);

  const {
    assigned: assignedTickets,
    resolved: resolvedTickets,
    inProgress: inProgressTickets,
    pending: pendingTickets,
    avgResolutionTime,
    resolutionRate,
    slaCompliance
  } = staffTickets;

  const totalAssigned = assignedTickets.length;
  const totalResolved = resolvedTickets.length;
  const totalInProgress = inProgressTickets.length;
  const totalPending = pendingTickets.length;

  const renderTicketCard = (ticket: Ticket) => (
    <Card key={ticket.id} className={styles.ticketCard} onClick={() => navigate(`/ticket/${ticket.id}`)}>
      <div className={styles.ticketHeader}>
        <div className={styles.ticketTitleSection}>
          <h4 className={styles.ticketTitle}>{ticket.title}</h4>
          <span className={styles.ticketId}>{ticket.id}</span>
        </div>
        <Badge
          variant={
            ticket.priority === "critical"
              ? "destructive"
              : ticket.priority === "high"
                ? "default"
                : ticket.priority === "medium"
                  ? "secondary"
                  : "outline"
          }
        >
          {ticket.priority}
        </Badge>
      </div>
      <p className={styles.ticketDescription}>{ticket.description}</p>
      <div className={styles.ticketFooter}>
        <div className={styles.ticketMeta}>
          <span className={styles.ticketMetaItem}>
            <User style={{ width: "14px", height: "14px" }} />
            {ticket.submitterName}
          </span>
          <span className={styles.ticketMetaItem}>
            <Clock style={{ width: "14px", height: "14px" }} />
            {new Date(ticket.createdAt).toLocaleDateString()}
          </span>
        </div>
        <Badge
          variant={
            ticket.slaStatus === "good" ? "outline" : ticket.slaStatus === "warning" ? "secondary" : "destructive"
          }
        >
          {ticket.slaStatus === "good" ? "On Track" : ticket.slaStatus === "warning" ? "Warning" : "Breached"}
        </Badge>
      </div>
    </Card>
  );

  return (
    <>
        {/* Profile Header */}
        <Card className={styles.profileCard}>
          <div className={styles.profileHeader}>
            <div className={styles.avatarSection}>
              <div className={styles.avatar}>{staff.name.charAt(0)}</div>
              <div className={styles.profileInfo}>
                <h1 className={styles.profileName}>{staff.name}</h1>
                <div className={styles.profileMeta}>
                  <span className={styles.profileMetaItem}>
                    <Mail style={{ width: "16px", height: "16px" }} />
                    {staff.email}
                  </span>
                  <span className={styles.profileMetaItem}>
                    <User style={{ width: "16px", height: "16px" }} />
                    @{staff.username}
                  </span>
                  {staff.phone && (
                    <span className={styles.profileMetaItem}>
                      <Phone style={{ width: "16px", height: "16px" }} />
                      {staff.phone}
                    </span>
                  )}
                  <span className={styles.profileMetaItem}>
                    <Briefcase style={{ width: "16px", height: "16px" }} />
                    IT Support Staff
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.notificationSection}>
              <Button variant="outline">
                <Bell style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                Notifications
              </Button>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "var(--color-accent-3)" }}>
                <Target style={{ color: "var(--color-accent-9)" }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{totalAssigned}</div>
                <div className={styles.statLabel}>Total Assigned</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "var(--color-success-3)" }}>
                <CheckCircle style={{ color: "var(--color-success-9)" }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{totalResolved}</div>
                <div className={styles.statLabel}>Resolved</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "var(--indigo-3)" }}>
                <Clock style={{ color: "var(--indigo-9)" }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{totalInProgress}</div>
                <div className={styles.statLabel}>In Progress</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "var(--color-neutral-3)" }}>
                <AlertCircle style={{ color: "var(--color-neutral-9)" }} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{totalPending}</div>
                <div className={styles.statLabel}>Pending</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className={styles.performanceSection}>
            <h3 className={styles.sectionTitle}>Performance Metrics</h3>
            <div className={styles.metricsGrid}>
              <div className={styles.metricItem}>
                <div className={styles.metricLabel}>
                  <span>Resolution Rate</span>
                  <span className={styles.metricValue}>{resolutionRate.toFixed(1)}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${resolutionRate}%` }}></div>
                </div>
              </div>

              <div className={styles.metricItem}>
                <div className={styles.metricLabel}>
                  <span>SLA Compliance</span>
                  <span className={styles.metricValue}>{slaCompliance.toFixed(1)}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${slaCompliance}%`,
                      background: slaCompliance >= 80 ? "var(--color-success-9)" : "var(--color-error-9)",
                    }}
                  ></div>
                </div>
              </div>

              <div className={styles.metricItem}>
                <div className={styles.metricLabel}>
                  <span>Avg. Resolution Time</span>
                  <span className={styles.metricValue}>{avgResolutionTime.toFixed(1)} hours</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tickets Tabs */}
        <Card className={styles.ticketsSection}>
          <Tabs defaultValue="assigned">
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="assigned">
                Assigned ({totalAssigned})
              </TabsTrigger>
              <TabsTrigger value="in-progress">
                In Progress ({totalInProgress})
              </TabsTrigger>
              <TabsTrigger value="resolved">
                Resolved ({totalResolved})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assigned" className={styles.tabContent}>
              {assignedTickets.length === 0 ? (
                <div className={styles.emptyState}>
                  <Target className={styles.emptyIcon} />
                  <p>No assigned tickets</p>
                </div>
              ) : (
                <div className={styles.ticketsGrid}>
                  {assignedTickets.map(renderTicketCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="in-progress" className={styles.tabContent}>
              {inProgressTickets.length === 0 ? (
                <div className={styles.emptyState}>
                  <Clock className={styles.emptyIcon} />
                  <p>No tickets in progress</p>
                </div>
              ) : (
                <div className={styles.ticketsGrid}>
                  {inProgressTickets.map(renderTicketCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="resolved" className={styles.tabContent}>
              {resolvedTickets.length === 0 ? (
                <div className={styles.emptyState}>
                  <CheckCircle className={styles.emptyIcon} />
                  <p>No resolved tickets</p>
                </div>
              ) : (
                <div className={styles.ticketsGrid}>
                  {resolvedTickets.map(renderTicketCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
    </>
  );
}
