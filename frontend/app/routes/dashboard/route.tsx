/**
 * route.tsx — Dashboard Page
 *
 * IT Aero Nusantara Support Console - Modern Responsive Dashboard
 * Menampilkan:
 * - Stats personal (active, completed, SLA breached, avg resolution)
 * - Tabel tiket (desktop) & card list (mobile/APK) dengan infinite scroll
 * - Filter Tab: My Active Tickets / My Pending Tickets / My Completed Tickets
 *
 * Logika baris & card tiket ada di: components/TicketRow.tsx
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, redirect } from "react-router";
import type { Route } from "./+types/route";
import {
  Inbox,
  Clock,
  CheckCircle,
  AlertTriangle,
  CircleDot,
  Plus,
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import {
  getTickets,
  getAgents,
  deleteTicket,
  type Ticket,
} from "~/services/ticket.service";
import { settingsApi } from "~/services/settings.service";
import { requireAuth, logout } from "~/services/session.service";
import { setAuthToken } from "~/services/api.service";
import { getTicketStats } from "~/services/ticket.service";
import { isResolvedStatus, inferFilterGroup } from "~/utils/ticket-ui";
import { TicketRow, MobileTicketCard } from "./components/TicketRow";
import styles from "./style.module.css";

// ─────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Fetch data personal secara paralel
  const [activeResponse, pendingResponse, completedResponse, agents, statusResponse, prioritiesResponse, stats] =
    await Promise.all([
      getTickets({ assignedTo: session.userId, is_resolved: false, is_pending: false, page: 1, per_page: 5 }),
      getTickets({ assignedTo: session.userId, is_resolved: false, is_pending: true, page: 1, per_page: 5 }),
      getTickets({ assignedTo: session.userId, is_resolved: true, page: 1, per_page: 5 }),
      getAgents(),
      settingsApi.getStatuses(),
      settingsApi.getPriorities(),
      getTicketStats(true), // Personal stats
    ]);

  return Response.json({
    session,
    activeTickets: activeResponse.tickets,
    activeTotal: activeResponse.total,
    pendingTickets: pendingResponse.tickets,
    pendingTotal: pendingResponse.total,
    completedTickets: completedResponse.tickets,
    completedTotal: completedResponse.total,
    agents,
    statuses: (statusResponse.data?.data || []).filter((s: any) => s.showOnItHelpdesk !== false),
    priorities: (prioritiesResponse.data?.data || []).filter((p: any) => p.isActive !== false),
    stats,
  });
}

// ─────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  if (request.method === "POST") {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "logout") {
      return redirect("/login", { headers: await logout(request) });
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const {
    session,
    activeTickets: initialActive,
    activeTotal,
    pendingTickets: initialPending,
    pendingTotal,
    completedTickets: initialCompleted,
    completedTotal,
    agents,
    statuses,
    priorities,
    stats,
  } = loaderData;

  const navigate = useNavigate();
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // ── Tab State ──
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "completed">("active");

  // ── Ticket Lists ──
  const [activeTickets, setActiveTickets] = useState(initialActive);
  const [activePage, setActivePage] = useState(1);
  const [hasMoreActive, setHasMoreActive] = useState(
    initialActive.length < activeTotal
  );

  const [pendingTickets, setPendingTickets] = useState(initialPending);
  const [pendingPage, setPendingPage] = useState(1);
  const [hasMorePending, setHasMorePending] = useState(
    initialPending.length < pendingTotal
  );

  const [completedTickets, setCompletedTickets] = useState(initialCompleted);
  const [completedPage, setCompletedPage] = useState(1);
  const [hasMoreCompleted, setHasMoreCompleted] = useState(
    initialCompleted.length < completedTotal
  );

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Delete Confirmation Dialog State ──
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Sync JWT token dari SSR session ke in-memory (untuk client-side API call)
  useEffect(() => {
    if (session?.authToken) setAuthToken(session.authToken);
  }, [session]);

  const currentUserIsOnBreak = useMemo(() => {
    if (!session || !session.userId) return false;
    const me = agents.find((a: any) => String(a.id) === String(session.userId));
    return me?.isOnBreak === true || me?.presenceStatus === "break";
  }, [session, agents]);

  // Derived state
  const tickets =
    activeTab === "active" ? activeTickets : activeTab === "pending" ? pendingTickets : completedTickets;
  const hasMore =
    activeTab === "active" ? hasMoreActive : activeTab === "pending" ? hasMorePending : hasMoreCompleted;
  const isAdministrator = session.userRole === "Administrator";

  // ─────────────────────────────────────────────
  // Infinite Scroll Observer
  // ─────────────────────────────────────────────

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreTickets();
        }
      },
      { root: null, threshold: 0.1 }
    );

    const sentinel = document.getElementById("scroll-sentinel");
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, activeTab, activeTickets.length, pendingTickets.length, completedTickets.length]);

  /**
   * Muat halaman berikutnya dari ticket list aktif.
   * Append ke list yang sudah ada (infinite scroll pattern).
   */
  const loadMoreTickets = async () => {
    setIsLoadingMore(true);
    const tab = activeTab;
    const nextPage =
      tab === "active" ? activePage + 1 : tab === "pending" ? pendingPage + 1 : completedPage + 1;

    const response = await getTickets({
      assignedTo: session.userId,
      is_resolved: tab === "completed",
      ...(tab !== "completed" ? { is_pending: tab === "pending" } : {}),
      page: nextPage,
      per_page: 5,
    });

    if (response.tickets.length > 0) {
      if (tab === "active") {
        setActiveTickets((prev) => [...prev, ...response.tickets]);
        setActivePage(nextPage);
        setHasMoreActive(
          activeTickets.length + response.tickets.length < activeTotal
        );
      } else if (tab === "pending") {
        setPendingTickets((prev) => [...prev, ...response.tickets]);
        setPendingPage(nextPage);
        setHasMorePending(
          pendingTickets.length + response.tickets.length < pendingTotal
        );
      } else {
        setCompletedTickets((prev) => [...prev, ...response.tickets]);
        setCompletedPage(nextPage);
        setHasMoreCompleted(
          completedTickets.length + response.tickets.length < completedTotal
        );
      }
    } else {
      if (tab === "active") setHasMoreActive(false);
      else if (tab === "pending") setHasMorePending(false);
      else setHasMoreCompleted(false);
    }

    setIsLoadingMore(false);
  };

  // ─────────────────────────────────────────────
  // Ticket State Updaters
  // ─────────────────────────────────────────────

  const updateTicketsState = (updated: Ticket) => {
    const upsert = (prev: Ticket[]) =>
      prev.find((t) => t.id === updated.id)
        ? prev.map((t) => (t.id === updated.id ? updated : t))
        : [updated, ...prev];
    const remove = (prev: Ticket[]) => prev.filter((t) => t.id !== updated.id);

    // Ticket tidak lagi assigned ke user ini — hapus dari semua list
    if (updated.assignedToId !== parseInt(session.userId)) {
      setActiveTickets(remove);
      setPendingTickets(remove);
      setCompletedTickets(remove);
      return;
    }

    const resolved = isResolvedStatus(updated.status);
    const master = statuses.find(
      (s: any) => String(s.name).toLowerCase() === String(updated.status).toLowerCase()
    );
    const pending =
      !resolved &&
      (master?.filterGroup || inferFilterGroup(updated.status, master?.isDefault)) === "pending";

    setActiveTickets(resolved || pending ? remove : upsert);
    setPendingTickets(pending ? upsert : remove);
    setCompletedTickets(resolved ? upsert : remove);
  };

  // ─────────────────────────────────────────────
  // Delete Handler
  // ─────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    const success = await deleteTicket(String(deleteTargetId));
    if (success) {
      setActiveTickets((prev) => prev.filter((t) => t.id !== deleteTargetId));
      setPendingTickets((prev) => prev.filter((t) => t.id !== deleteTargetId));
      setCompletedTickets((prev) =>
        prev.filter((t) => t.id !== deleteTargetId)
      );
    }
    setDeleteTargetId(null);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.workspaceMain}>
        {/* Workspace Header */}
        <header className={styles.workspaceHeader}>
          <div className={styles.welcomeGroup}>
            <p className={styles.welcomeSubtitle}>IT Support Console</p>
            <h1 className={styles.welcomeTitle}>
              <span className={styles.welcomeName}>Welcome, {session.userName}</span>
            </h1>
          </div>
          <div className={styles.dateBadge}>
            <span className={styles.pulseDot}>
              <span className={styles.pulseRing}></span>
              <span className={styles.pulseCore}></span>
            </span>
            <span>
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </header>

        {/* Key Performance Metrics Summary */}
        <section aria-label="Ticket Statistics" className={styles.metricsGrid}>
          {/* Metric 1: My Active Tickets */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>MY ACTIVE TICKETS</span>
              <div className={`${styles.metricIconWrap} ${styles.iconActive}`}>
                <Inbox size={14} />
              </div>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valActive}`}>
                {stats?.assigned || 0}
              </div>
              <span className={styles.metricSubtextPill}>In progress</span>
            </div>
          </div>

          {/* Metric 2: My Completed */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>MY COMPLETED</span>
              <div className={`${styles.metricIconWrap} ${styles.iconCompleted}`}>
                <CheckCircle size={14} />
              </div>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valCompleted}`}>
                {stats?.resolved || 0}
              </div>
              <span className={styles.metricSubtextPill}>Resolved</span>
            </div>
          </div>

          {/* Metric 3: My SLA Breached */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>MY SLA BREACHED</span>
              <div className={`${styles.metricIconWrap} ${styles.iconBreached}`}>
                <AlertTriangle size={14} />
              </div>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valBreached}`}>
                {stats?.sla?.breached || 0}
              </div>
              <span className={styles.metricSubtextPill}>Target 0%</span>
            </div>
          </div>

          {/* Metric 4: Avg. Resolution */}
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>AVG. RESOLUTION</span>
              <div className={`${styles.metricIconWrap} ${styles.iconAvg}`}>
                <Clock size={14} />
              </div>
            </div>
            <div className={styles.metricBody}>
              <div className={`${styles.metricValue} ${styles.valAvg}`}>
                {stats?.avgResolutionTime || 0}h
              </div>
              <span className={styles.metricSubtextPill}>Rolling avg</span>
            </div>
          </div>
        </section>

        {/* Data Workspace Panel (Tickets Section) */}
        <section className={styles.workspacePanel}>
          {/* Panel Toolbar */}
          <div className={styles.panelToolbar}>
            {/* Mobile Top Row: Title + Action Button */}
            <div className={styles.panelToolbarTop}>
              <h2 className={styles.panelTitle}>Ticket Queue</h2>
              {session.userRole !== "Management" && (
                <button
                  type="button"
                  onClick={() => navigate("/submit-ticket")}
                  className={styles.createTicketBtn}
                >
                  <Plus size={14} />
                  <span>Manual Ticket</span>
                </button>
              )}
            </div>

            {/* Segmented Control Tabs Navigation */}
            <nav aria-label="Ticket Filter Tabs" className={styles.tabsNav}>
              <button
                type="button"
                className={`${styles.tabButton} ${
                  activeTab === "active" ? styles.tabActive : ""
                }`}
                onClick={() => setActiveTab("active")}
              >
                <span>
                  <span className={styles.tabTextVerbose}>My </span>Active
                  <span className={styles.tabTextVerbose}> Tickets</span>
                </span>
                <span
                  className={`${styles.tabBadge} ${
                    activeTab === "active"
                      ? styles.tabBadgeActive
                      : styles.tabBadgeInactive
                  }`}
                >
                  {activeTotal}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${
                  activeTab === "pending" ? styles.tabActive : ""
                }`}
                onClick={() => setActiveTab("pending")}
              >
                <span>
                  <span className={styles.tabTextVerbose}>My </span>Pending
                  <span className={styles.tabTextVerbose}> Tickets</span>
                </span>
                <span
                  className={`${styles.tabBadge} ${
                    activeTab === "pending"
                      ? styles.tabBadgeActive
                      : styles.tabBadgeInactive
                  }`}
                >
                  {pendingTotal}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${
                  activeTab === "completed" ? styles.tabActive : ""
                }`}
                onClick={() => setActiveTab("completed")}
              >
                <span>
                  <span className={styles.tabTextVerbose}>My </span>Completed
                  <span className={styles.tabTextVerbose}> Tickets</span>
                </span>
                <span
                  className={`${styles.tabBadge} ${
                    activeTab === "completed"
                      ? styles.tabBadgeActive
                      : styles.tabBadgeInactive
                  }`}
                >
                  {completedTotal}
                </span>
              </button>
            </nav>

            {/* Desktop Action Button */}
            {session.userRole !== "Management" && (
              <div className={styles.desktopActionContainer}>
                <button
                  type="button"
                  onClick={() => navigate("/submit-ticket")}
                  className={styles.createTicketBtn}
                >
                  <Plus size={14} />
                  <span>Manual Ticket</span>
                </button>
              </div>
            )}
          </div>

          {/* Empty State */}
          {tickets.length === 0 ? (
            <div className={styles.emptyState}>
              <Inbox className={styles.emptyStateIcon} />
              <p className={styles.emptyStateText}>
                {activeTab === "active"
                  ? "You don't have any active tickets assigned"
                  : activeTab === "pending"
                  ? "You don't have any pending tickets"
                  : "You haven't completed any tickets yet"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View (> 768px) */}
              <div className={styles.desktopTableContainer} ref={tableWrapperRef}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Ticket #</th>
                      <th className={styles.th}>Title</th>
                      <th className={styles.th}>Category</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Priority</th>
                      <th className={styles.th}>Submitter</th>
                      <th className={styles.th}>Assigned To</th>
                      <th className={styles.th}>Created</th>
                      {isAdministrator && <th className={styles.th}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <TicketRow
                        key={ticket.id}
                        ticket={ticket}
                        agents={agents}
                        statuses={statuses}
                        priorities={priorities}
                        isAdministrator={isAdministrator}
                        session={session}
                        currentUserIsOnBreak={currentUserIsOnBreak}
                        onTicketUpdate={updateTicketsState}
                        onTicketDelete={(id) => setDeleteTargetId(id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Refined Mobile Card List (<= 768px) */}
              <div className={styles.mobileCardList}>
                {tickets.map((ticket) => (
                  <MobileTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    agents={agents}
                    statuses={statuses}
                    priorities={priorities}
                    isAdministrator={isAdministrator}
                    session={session}
                    currentUserIsOnBreak={currentUserIsOnBreak}
                    onTicketUpdate={updateTicketsState}
                    onTicketDelete={(id) => setDeleteTargetId(id)}
                  />
                ))}
              </div>

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
            </>
          )}
        </section>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Ticket</DialogTitle>
            <DialogDescription>
              Apakah kamu yakin ingin menghapus ticket ini? Aksi ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
