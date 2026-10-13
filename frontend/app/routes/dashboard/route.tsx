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
import { TicketPagination } from "~/components/ui/ticket-pagination/ticket-pagination";
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
      getTickets({ assignedTo: session.userId, is_resolved: false, is_pending: false, page: 1, per_page: 15 }),
      getTickets({ assignedTo: session.userId, is_resolved: false, is_pending: true, page: 1, per_page: 15 }),
      getTickets({ assignedTo: session.userId, is_resolved: true, page: 1, per_page: 15 }),
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
    activeTotal: initialActiveTotal,
    pendingTickets: initialPending,
    pendingTotal: initialPendingTotal,
    completedTickets: initialCompleted,
    completedTotal: initialCompletedTotal,
    agents,
    statuses,
    priorities,
    stats,
  } = loaderData;

  const navigate = useNavigate();
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // Jumlah tiket per halaman — disamakan dengan page Tickets.
  // Semua 15 baris dirender penuh sekaligus; hemat query tetap lewat
  // pagination (1 query per halaman, bukan per scroll).
  const PER_PAGE = 15;

  // ── Tab State ──
  const [activeTab, setActiveTab] = useState<"active" | "pending" | "completed">("active");

  // ── Ticket Lists (HALAMAN aktif, bukan akumulasi infinite scroll) ──
  // Anotasi generik eksplisit: typegen route kadang meng-infer loaderData
  // sebagai `never`; anotasi ini menjaga state tetap ber-tipe benar.
  const [activeTickets, setActiveTickets] = useState<Ticket[]>(initialActive);
  const [activePage, setActivePage] = useState<number>(1);
  const [activeTotal, setActiveTotal] = useState<number>(initialActiveTotal);

  const [pendingTickets, setPendingTickets] = useState<Ticket[]>(initialPending);
  const [pendingPage, setPendingPage] = useState<number>(1);
  const [pendingTotal, setPendingTotal] = useState<number>(initialPendingTotal);

  const [completedTickets, setCompletedTickets] = useState<Ticket[]>(initialCompleted);
  const [completedPage, setCompletedPage] = useState<number>(1);
  const [completedTotal, setCompletedTotal] = useState<number>(initialCompletedTotal);

  const [isLoadingPage, setIsLoadingPage] = useState(false);

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
  const totalForTab =
    activeTab === "active" ? activeTotal : activeTab === "pending" ? pendingTotal : completedTotal;
  const currentPage =
    activeTab === "active" ? activePage : activeTab === "pending" ? pendingPage : completedPage;
  const totalPages = Math.max(1, Math.ceil(totalForTab / PER_PAGE));
  const isAdministrator = session.userRole === "Administrator";

  // Persentase tiket SLA-breached terhadap total tiket user pada stats.
  // (Menggantikan teks statis "Target 0%" — breach tak bisa diperbaiki,
  // jadi kartu menampilkan kondisi riil, bukan target.)
  const slaBreachRate =
    stats && stats.total > 0
      ? Math.round((stats.sla.breached / stats.total) * 1000) / 10
      : 0;

  // Area scroll diatur ke tepat 5 baris terlihat. Tinggi baris tiket
  // bervariasi mengikuti isi data, jadi jangan hardcode — ukur dari
  // baris nyata. Panel dibuat fit-content (tidak diregangkan) sehingga
  // bar pagination duduk tepat di bawah tabel tanpa gap besar.
  // Fallback CSS 346px dipakai sebelum pengukuran pertama.
  useEffect(() => {
    const el = tableWrapperRef.current;
    if (!el) return;
    const row = el.querySelector("tbody tr");
    const thead = el.querySelector("thead");
    if (!row || !thead) return;
    const rowH = row.getBoundingClientRect().height;
    if (rowH > 0) {
      el.style.minHeight = "";
      el.style.maxHeight = `${Math.round(
        thead.getBoundingClientRect().height + rowH * 5
      )}px`;
    }
  }, [tickets, activeTab, currentPage]);

  // ─────────────────────────────────────────────
  // Pagination — SATU query server per klik halaman
  // (menggantikan infinite scroll yang query tiap scroll)
  // ─────────────────────────────────────────────

  const goToPage = async (page: number) => {
    if (isLoadingPage || page < 1 || page > totalPages || page === currentPage) return;

    const tab = activeTab;
    setIsLoadingPage(true);
    try {
      const response = await getTickets({
        assignedTo: session.userId,
        is_resolved: tab === "completed",
        ...(tab !== "completed" ? { is_pending: tab === "pending" } : {}),
        page,
        per_page: PER_PAGE,
      });

      if (tab === "active") {
        setActiveTickets(response.tickets);
        setActiveTotal(response.total);
        setActivePage(page);
      } else if (tab === "pending") {
        setPendingTickets(response.tickets);
        setPendingTotal(response.total);
        setPendingPage(page);
      } else {
        setCompletedTickets(response.tickets);
        setCompletedTotal(response.total);
        setCompletedPage(page);
      }

      // Kembali ke atas tabel/card list saat ganti halaman
      tableWrapperRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsLoadingPage(false);
    }
  };

  // Jika halaman aktif kehabisan baris (tiket terakhir dihapus / pindah status),
  // mundur satu halaman alih-alih menampilkan empty state yang menyesatkan.
  useEffect(() => {
    if (!isLoadingPage && tickets.length === 0 && totalForTab > 0 && currentPage > 1) {
      goToPage(currentPage - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets.length, totalForTab, currentPage, isLoadingPage]);

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
      if (activeTickets.some((t) => t.id === updated.id))
        setActiveTotal((v) => Math.max(0, v - 1));
      if (pendingTickets.some((t) => t.id === updated.id))
        setPendingTotal((v) => Math.max(0, v - 1));
      if (completedTickets.some((t) => t.id === updated.id))
        setCompletedTotal((v) => Math.max(0, v - 1));
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

    // Pindah antar grup — sesuaikan total per tab agar paginasi tetap akurat.
    const wasActive = activeTickets.some((t) => t.id === updated.id);
    const wasPending = pendingTickets.some((t) => t.id === updated.id);
    const wasCompleted = completedTickets.some((t) => t.id === updated.id);
    const goesActive = !resolved && !pending;
    const goesPending = pending;
    const goesCompleted = resolved;

    if (wasActive && !goesActive) setActiveTotal((v) => Math.max(0, v - 1));
    if (!wasActive && goesActive) setActiveTotal((v) => v + 1);
    if (wasPending && !goesPending) setPendingTotal((v) => Math.max(0, v - 1));
    if (!wasPending && goesPending) setPendingTotal((v) => v + 1);
    if (wasCompleted && !goesCompleted) setCompletedTotal((v) => Math.max(0, v - 1));
    if (!wasCompleted && goesCompleted) setCompletedTotal((v) => v + 1);

    setActiveTickets(goesActive ? upsert : remove);
    setPendingTickets(goesPending ? upsert : remove);
    setCompletedTickets(goesCompleted ? upsert : remove);
  };

  // ─────────────────────────────────────────────
  // Delete Handler
  // ─────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    const success = await deleteTicket(String(deleteTargetId));
    if (success) {
      if (activeTickets.some((t) => t.id === deleteTargetId))
        setActiveTotal((v) => Math.max(0, v - 1));
      if (pendingTickets.some((t) => t.id === deleteTargetId))
        setPendingTotal((v) => Math.max(0, v - 1));
      if (completedTickets.some((t) => t.id === deleteTargetId))
        setCompletedTotal((v) => Math.max(0, v - 1));
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
              <span className={styles.metricSubtextPill}>{slaBreachRate}%</span>
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
              <div
                className={`${styles.desktopTableContainer} ${
                  isLoadingPage ? styles.tableLoading : ""
                }`}
                ref={tableWrapperRef}
              >
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
              <div
                className={`${styles.mobileCardList} ${
                  isLoadingPage ? styles.tableLoading : ""
                }`}
              >
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

              {/* Pagination — komponen bersama (sama dengan page Tickets) */}
              <TicketPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalForTab}
                pageSize={PER_PAGE}
                onPageChange={goToPage}
                isLoading={isLoadingPage}
              />
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
