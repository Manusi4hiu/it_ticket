/**
 * route.tsx — Dashboard Page
 *
 * Halaman utama staff setelah login.
 * Menampilkan:
 * - Stats personal (active, completed, SLA breached, avg resolution)
 * - Tabel ticket dengan infinite scroll
 * - Tab: My Active Tickets / My Completed Tickets
 *
 * Logika baris tabel ada di: components/TicketRow.tsx
 * Shared utils: ~/utils/ticket-ui, ~/utils/date
 */

import { useState, useEffect, useRef } from "react";
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
import { isResolvedStatus } from "~/utils/ticket-ui";
import { TicketRow } from "./components/TicketRow";
import styles from "./style.module.css";

// ─────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Fetch data personal secara paralel
  const [activeResponse, completedResponse, agents, statusResponse, stats] =
    await Promise.all([
      getTickets({ assignedTo: session.userId, is_resolved: false, page: 1, per_page: 5 }),
      getTickets({ assignedTo: session.userId, is_resolved: true, page: 1, per_page: 5 }),
      getAgents(),
      settingsApi.getStatuses(),
      getTicketStats(true), // Personal stats
    ]);

  return {
    session,
    activeTickets: activeResponse.tickets,
    activeTotal: activeResponse.total,
    completedTickets: completedResponse.tickets,
    completedTotal: completedResponse.total,
    agents,
    statuses: (statusResponse.data?.data || []).filter((s: any) => s.showOnItHelpdesk !== false),
    stats,
  };
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
    completedTickets: initialCompleted,
    completedTotal,
    agents,
    statuses,
    stats,
  } = loaderData;

  const navigate = useNavigate();
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // ── Tab State ──
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  // ── Ticket Lists ──
  const [activeTickets, setActiveTickets] = useState(initialActive);
  const [activePage, setActivePage] = useState(1);
  const [hasMoreActive, setHasMoreActive] = useState(
    initialActive.length < activeTotal
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

  // Derived state
  const tickets = activeTab === "active" ? activeTickets : completedTickets;
  const hasMore = activeTab === "active" ? hasMoreActive : hasMoreCompleted;
  const totalCount = activeTab === "active" ? activeTotal : completedTotal;
  const isAdministrator = session.userRole === "Administrator";

  // ─────────────────────────────────────────────
  // Infinite Scroll
  // ─────────────────────────────────────────────

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreTickets();
        }
      },
      { root: tableWrapperRef.current, threshold: 0.1 }
    );

    const sentinel = document.getElementById("scroll-sentinel");
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, activeTab, activeTickets.length, completedTickets.length]);

  /**
   * Muat halaman berikutnya dari ticket list aktif.
   * Append ke list yang sudah ada (infinite scroll pattern).
   */
  const loadMoreTickets = async () => {
    setIsLoadingMore(true);
    const isWorkingOnActive = activeTab === "active";
    const nextPage = isWorkingOnActive ? activePage + 1 : completedPage + 1;

    const response = await getTickets({
      assignedTo: session.userId,
      is_resolved: !isWorkingOnActive,
      page: nextPage,
      per_page: 5,
    });

    if (response.tickets.length > 0) {
      if (isWorkingOnActive) {
        setActiveTickets((prev) => [...prev, ...response.tickets]);
        setActivePage(nextPage);
        setHasMoreActive(
          activeTickets.length + response.tickets.length < activeTotal
        );
      } else {
        setCompletedTickets((prev) => [...prev, ...response.tickets]);
        setCompletedPage(nextPage);
        setHasMoreCompleted(
          completedTickets.length + response.tickets.length < completedTotal
        );
      }
    } else {
      if (isWorkingOnActive) setHasMoreActive(false);
      else setHasMoreCompleted(false);
    }

    setIsLoadingMore(false);
  };

  // ─────────────────────────────────────────────
  // Ticket State Updaters
  // ─────────────────────────────────────────────

  /**
   * Update state lokal setelah ticket diubah (assign/priority).
   * Jika ticket berpindah resolved status, pindahkan antar tab.
   * Jika tidak lagi assigned ke user ini, hapus dari list.
   *
   * @param updated - Ticket yang baru saja diupdate
   */
  const updateTicketsState = (updated: Ticket) => {
    // Ticket tidak lagi assigned ke user ini — hapus dari kedua list
    if (updated.assignedToId !== parseInt(session.userId)) {
      setActiveTickets((prev) => prev.filter((t) => t.id !== updated.id));
      setCompletedTickets((prev) => prev.filter((t) => t.id !== updated.id));
      return;
    }

    const resolved = isResolvedStatus(updated.status);

    if (resolved) {
      setActiveTickets((prev) => prev.filter((t) => t.id !== updated.id));
      setCompletedTickets((prev) => {
        if (prev.find((t) => t.id === updated.id)) {
          return prev.map((t) => (t.id === updated.id ? updated : t));
        }
        return [updated, ...prev];
      });
    } else {
      setCompletedTickets((prev) => prev.filter((t) => t.id !== updated.id));
      setActiveTickets((prev) => {
        if (prev.find((t) => t.id === updated.id)) {
          return prev.map((t) => (t.id === updated.id ? updated : t));
        }
        return [updated, ...prev];
      });
    }
  };

  // ─────────────────────────────────────────────
  // Delete Handler
  // ─────────────────────────────────────────────

  /**
   * Hapus ticket setelah konfirmasi via Dialog.
   * Dipanggil dari TicketRow → onTicketDelete → setDeleteTargetId.
   */
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    const success = await deleteTicket(String(deleteTargetId));
    if (success) {
      setActiveTickets((prev) => prev.filter((t) => t.id !== deleteTargetId));
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
      {/* Welcome Section */}
      <div className={styles.welcomeSection}>
        <div className={styles.welcomeContent}>
          <h2 className={styles.welcomeTitle}>
            Welcome,{" "}
            <span className={styles.userName}>{session.userName}</span>
          </h2>
        </div>
        <div className={styles.dateTime}>
          <span>
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.metricsGrid}>
        <MetricCard
          label="My Active Tickets"
          value={stats?.assigned || 0}
          icon={<Inbox className={styles.metricIcon} />}
          valueClass={styles.metricNew}
        />
        <MetricCard
          label="My Completed"
          value={stats?.resolved || 0}
          icon={<CheckCircle className={styles.metricIcon} />}
          valueClass={styles.metricResolved}
        />
        <MetricCard
          label="My SLA Breached"
          value={stats?.sla?.breached || 0}
          icon={<AlertTriangle className={styles.metricIcon} />}
          valueClass={styles.metricBreached}
        />
        <MetricCard
          label="Avg. Resolution"
          value={`${stats?.avgResolutionTime || 0}h`}
          icon={<Clock className={styles.metricIcon} />}
          valueClass={styles.metricInProgress}
        />
      </div>

      {/* Tickets Table */}
      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tab} ${
                activeTab === "active" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("active")}
            >
              My Active Tickets
              <span className={styles.tabCount}>{activeTotal}</span>
            </button>
            <button
              className={`${styles.tab} ${
                activeTab === "completed" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("completed")}
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
              {activeTab === "active"
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
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    agents={agents}
                    statuses={statuses}
                    isAdministrator={isAdministrator}
                    session={session}
                    onTicketUpdate={updateTicketsState}
                    onTicketDelete={(id) => setDeleteTargetId(id)}
                  />
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

      {/* Delete Confirmation Dialog — menggantikan native confirm() */}
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
              Apakah kamu yakin ingin menghapus ticket ini? Aksi ini tidak bisa
              dibatalkan.
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

// ─────────────────────────────────────────────
// Internal Sub-component
// ─────────────────────────────────────────────

/**
 * MetricCard
 *
 * Card statistik kecil di bagian atas dashboard.
 */
function MetricCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueClass: string;
}) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricHeader}>
        <span className={styles.metricLabel}>{label}</span>
        {icon}
      </div>
      <div className={`${styles.metricValue} ${valueClass}`}>{value}</div>
    </div>
  );
}
