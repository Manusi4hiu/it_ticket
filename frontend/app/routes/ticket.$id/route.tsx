/**
 * route.tsx — Ticket Detail Page
 *
 * Entry point untuk route /ticket/:id.
 * File ini hanya berisi:
 * - loader: fetch semua data yang dibutuhkan secara paralel
 * - TicketDetail: thin wrapper yang compose komponen-komponen kecil
 *
 * Logika bisnis ada di: hooks/use-ticket-actions.ts
 * Komponen: components/TicketInfoCard, SlaCard, TicketActionsPanel,
 *           ActivityTimeline, ResolveDialog, StaffProfileModal, PublicSidebar
 */

import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "~/components/ui/button/button";
import {
  getTicketById,
  getAgents,
  type Ticket,
} from "~/services/ticket.service";
import {
  settingsApi,
  type Priority,
  type Category,
  type Status,
} from "~/services/settings.service";
import { getUserSession } from "~/services/session.service";
import type { Route } from "./+types/route";
import styles from "./style.module.css";

// Komponen
import { TicketInfoCard } from "./components/TicketInfoCard";
import { ActivityTimeline } from "./components/ActivityTimeline";
import { SlaCard } from "./components/SlaCard";
import { TicketActionsPanel } from "./components/TicketActionsPanel";
import { ResolveDialog } from "./components/ResolveDialog";
import { ReasonDialog } from "./components/ReasonDialog";
import { StaffProfileModal } from "./components/StaffProfileModal";
import { PublicSidebar } from "./components/PublicSidebar";
import { useTicketActions } from "./hooks/use-ticket-actions";
import type { TicketViewMode } from "./types";

// ─────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getUserSession(request);
  const ticketId_val = params.id!;

  // Blokir akses via numeric ID langsung (e.g. /ticket/105)
  // User harus menggunakan ticket code (e.g. FIN-006)
  if (/^\d+$/.test(ticketId_val)) {
    return {
      session,
      ticket: null as Ticket | null,
      invalidNumericId: true,
      agents: [],
      priorities: [] as Priority[],
      statuses: [] as Status[],
      categories: [] as Category[],
    };
  }

  // Fetch semua data secara paralel
  const [ticket, agents, prioritiesRes, statusesRes, categoriesRes] =
    await Promise.all([
      getTicketById(ticketId_val),
      getAgents(),
      session
        ? settingsApi.getPriorities()
        : Promise.resolve({ success: true, data: { data: [] } }),
      settingsApi.getStatuses(),
      session
        ? settingsApi.getCategories()
        : Promise.resolve({ success: true, data: { data: [] } }),
    ]);

  return {
    session,
    ticket,
    invalidNumericId: false,
    agents,
    priorities: (prioritiesRes.data?.data || []) as Priority[],
    statuses: ((statusesRes.data?.data || []) as Status[]).filter(s => s.showOnItHelpdesk !== false),
    categories: (categoriesRes.data?.data || []) as Category[],
  };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function TicketDetail({ loaderData }: Route.ComponentProps) {
  const {
    session,
    ticket: initialTicket,
    agents,
    priorities,
    statuses,
    categories,
    invalidNumericId,
  } = loaderData;

  const navigate = useNavigate();
  const params = useParams();

  // ── View Mode ──
  const isPublic = !session;
  const isManagement = session?.userRole === "Management";
  const isAdministrator = session?.userRole === "Administrator";

  const viewMode: TicketViewMode = isPublic
    ? "public"
    : isAdministrator
    ? "administrator"
    : isManagement
    ? "management"
    : "staff";

  const currentUser = session
    ? { id: session.userId, name: session.userName, role: session.userRole }
    : null;

  // ── Actions & State ──
  const actions = useTicketActions({
    initialTicket: initialTicket!,
    agents,
    currentUser,
    statuses,
  });

  // ── Error State: Ticket Not Found / Invalid ID ──
  if (!initialTicket || invalidNumericId) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Button
              variant="outline"
              onClick={() => navigate(isPublic ? "/" : "/dashboard")}
              className={styles.backButton}
            >
              <ArrowLeft className={styles.backIcon} />
              {isPublic ? "Back to Home" : "Back to Dashboard"}
            </Button>
          </div>
        </div>
        <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
          {invalidNumericId ? (
            <>
              <h2>Invalid Ticket Access</h2>
              <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
                Accessing tickets via numeric ID (e.g. {params.id}) is not
                allowed. Please use the valid Ticket Code (e.g. FIN-006).
              </p>
            </>
          ) : (
            <>
              <h2>Ticket not found</h2>
              <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
                The ticket ID you requested does not exist or has been removed.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const { ticket } = actions;

  return (
    <div className={styles.container}>
      {/* Back Button */}
      <div className={styles.headerActions}>
        <Button
          variant="outline"
          onClick={() => navigate(isPublic ? "/" : "/dashboard")}
          className={styles.backButton}
        >
          {isPublic ? (
            <Home className={styles.backIcon} />
          ) : (
            <ArrowLeft className={styles.backIcon} />
          )}
          {isPublic ? "Back to Home" : "Back to Dashboard"}
        </Button>
        {isPublic && (
          <div className={styles.publicBadge}>Public Tracking View</div>
        )}
      </div>

      <main className={styles.main}>
        <div className={isPublic ? styles.gridPublic : styles.grid}>
          {/* ── Left Column ── */}
          <div>
            <TicketInfoCard
              ticket={ticket}
              statuses={statuses}
              isPublic={isPublic}
              onStaffClick={actions.handleStaffClick}
            />

            {!isPublic && (
              <ActivityTimeline notes={ticket.notes} />
            )}
          </div>

          {/* ── Right Column ── */}
          {!isPublic ? (
            <div>
              <SlaCard
                ticket={ticket}
                currentUser={currentUser}
                isAdministrator={isAdministrator}
                isManagement={isManagement}
                isEditingResolvedAt={actions.isEditingResolvedAt}
                editResolvedAtValue={actions.editResolvedAtValue}
                onEditResolvedAtChange={actions.setEditResolvedAtValue}
                onOpenEditResolvedAt={actions.handleOpenEditResolvedAt}
                onSaveResolvedAt={actions.handleSaveResolvedAt}
                onCancelEditResolvedAt={() => actions.setIsEditingResolvedAt(false)}
              />

              <TicketActionsPanel
                ticket={ticket}
                agents={agents}
                statuses={statuses}
                priorities={priorities}
                categories={categories}
                currentUser={currentUser}
                isAdministrator={isAdministrator}
                isManagement={isManagement}
                status={actions.status}
                priority={actions.priority}
                category={actions.category}
                assignedTo={actions.assignedTo}
                collaborators={actions.collaborators}
                collaboratorIds={actions.collaboratorIds}
                newNote={actions.newNote}
                noteImage={actions.noteImage}
                onStatusChange={actions.handleStatusChange}
                onPriorityChange={actions.handlePriorityChange}
                onCategoryChange={actions.handleCategoryChange}
                onAssignedToChange={actions.handleAssignedToChange}
                onNoteChange={actions.setNewNote}
                onNoteImageChange={actions.handleNoteImageChange}
                onNoteImageClear={() => actions.setNoteImage(null)}
                onAddNote={actions.handleAddNote}
                onAddCollaborator={actions.handleAddCollaborator}
                onRemoveCollaborator={actions.handleRemoveCollaborator}
                onOpenResolveDialog={actions.handleOpenResolveDialog}
              />
            </div>
          ) : (
            <PublicSidebar status={ticket.status} />
          )}
        </div>

        {/* ── Dialogs ── */}
        <ResolveDialog
          open={actions.showResolveDialog}
          onOpenChange={actions.setShowResolveDialog}
          resolveDate={actions.resolveDate}
          onResolveDateChange={actions.setResolveDate}
          resolutionSummary={actions.resolutionSummary}
          onSummaryChange={actions.setResolutionSummary}
          resolutionError={actions.resolutionError}
          resolutionImage={actions.resolutionImage}
          onResolutionImageChange={actions.handleResolutionImageChange}
          onSubmit={actions.handleSubmitResolution}
        />

        <ReasonDialog
          open={actions.showReasonDialog}
          onOpenChange={actions.handleReasonDialogChange}
          reason={actions.statusReason}
          onReasonChange={actions.setStatusReason}
          onSubmit={actions.handleSubmitReason}
          targetStatus={actions.status}
        />

        <StaffProfileModal
          open={actions.isStaffModalOpen}
          onOpenChange={actions.setIsStaffModalOpen}
          staff={actions.selectedStaff}
          tickets={actions.staffTickets}
          loading={actions.loadingStaffTickets}
        />
      </main>
    </div>
  );
}
