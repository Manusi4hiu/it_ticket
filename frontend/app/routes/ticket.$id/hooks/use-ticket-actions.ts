/**
 * use-ticket-actions.ts
 *
 * Custom hook yang mengenkapsulasi semua state dan handler
 * untuk operasi ticket detail (update, resolve, collaborator, staff modal).
 *
 * Memisahkan logika dari presentasi sehingga komponen-komponen
 * di ticket.$id hanya fokus pada rendering.
 */

import { useState } from "react";
import { useToast } from "~/hooks/use-toast";
import { useNavigate } from "react-router";
import {
  updateTicket,
  updateTicketStatus,
  addTicketNote,
  assignTicket,
  getTickets,
  type Ticket,
} from "~/services/ticket.service";
import { usersApi } from "~/services/api.service";
import { compressImage } from "~/utils/image-compression";
import { toDatetimeLocalString } from "~/utils/date";
import type { Agent } from "~/services/ticket.service";
import type { Status } from "~/services/settings.service";
import type { StaffInfo, CurrentUser } from "../types";

// ─────────────────────────────────────────────
// Hook Input
// ─────────────────────────────────────────────

interface UseTicketActionsOptions {
  initialTicket: Ticket;
  agents: Agent[];
  currentUser: CurrentUser | null;
  statuses: Status[];
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * Hook utama untuk semua aksi pada halaman ticket detail.
 *
 * @param options.initialTicket - Data ticket awal dari loader
 * @param options.agents - Daftar agent dari loader
 * @param options.currentUser - User yang sedang login (null jika public)
 */
export function useTicketActions({
  initialTicket,
  agents,
  currentUser,
  statuses,
}: UseTicketActionsOptions) {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Ticket State ──
  const [ticket, setTicket] = useState<Ticket>(initialTicket);
  const [status, setStatus] = useState<string>(initialTicket?.status || "New");
  const [priority, setPriority] = useState(initialTicket?.priority || "medium");
  const [category, setCategory] = useState(initialTicket?.category || "Uncategorized");
  const [assignedTo, setAssignedTo] = useState(initialTicket?.assignedTo || "");
  const [collaborators, setCollaborators] = useState<string[]>(
    initialTicket?.collaborators || []
  );
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(
    (initialTicket?.collaboratorIds || []).map(String)
  );

  // ── Note State ──
  const [newNote, setNewNote] = useState("");
  const [noteImage, setNoteImage] = useState<File | null>(null);

  // ── Resolve Dialog State ──
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionError, setResolutionError] = useState("");
  const [resolveDate, setResolveDate] = useState<string>("");
  const [resolutionImage, setResolutionImage] = useState<File | null>(null);

  // ── Reason Dialog State ──
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [statusReason, setStatusReason] = useState("");

  // ── SLA Edit State ──
  const [isEditingResolvedAt, setIsEditingResolvedAt] = useState(false);
  const [editResolvedAtValue, setEditResolvedAtValue] = useState<string>("");

  // ── Staff Modal State ──
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffInfo | null>(null);
  const [loadingStaffTickets, setLoadingStaffTickets] = useState(false);
  const [staffTickets, setStaffTickets] = useState<Ticket[]>([]);

  // ─────────────────────────────────────────────
  // Handlers — Collaborator
  // ─────────────────────────────────────────────

  /**
   * Tambah collaborator ke ticket.
   * Tidak mengizinkan agent yang sudah menjadi assignee.
   *
   * @param collaboratorId - ID agent yang akan ditambah
   */
  const handleAddCollaborator = async (collaboratorId: string) => {
    // Agent.id adalah number, bandingkan dengan string form
    const agent = agents.find((a) => String(a.id) === collaboratorId);
    if (!agent) return;
    if (collaboratorIds.includes(collaboratorId) || agent.name === assignedTo) return;

    const newIds = [...collaboratorIds, collaboratorId];
    const newNames = [...collaborators, agent.name];
    setCollaboratorIds(newIds);
    setCollaborators(newNames);

    try {
      const updated = await updateTicket(String(ticket.id), { collaboratorIds: newIds.map(Number) });
      if (updated) {
        setTicket(updated);
        setCollaborators(updated.collaborators || []);
        setCollaboratorIds((updated.collaboratorIds || []).map(String));
      }
    } catch {
      toast({ title: "Error", description: "Gagal menambah collaborator.", variant: "destructive" });
    }
  };

  /**
   * Hapus collaborator dari ticket.
   *
   * @param collaboratorName - Nama collaborator yang akan dihapus
   */
  const handleRemoveCollaborator = async (collaboratorName: string) => {
    const agent = agents.find((a) => a.name === collaboratorName);
    if (!agent) return;

    const newIds = collaboratorIds.filter((id) => id !== String(agent.id));
    const newNames = collaborators.filter((c) => c !== collaboratorName);
    setCollaboratorIds(newIds);
    setCollaborators(newNames);

    try {
      const updated = await updateTicket(String(ticket.id), { collaboratorIds: newIds.map(Number) });
      if (updated) {
        setTicket(updated);
        setCollaborators(updated.collaborators || []);
        setCollaboratorIds((updated.collaboratorIds || []).map(String));
      }
    } catch {
      toast({ title: "Error", description: "Gagal menghapus collaborator.", variant: "destructive" });
    }
  };

  // ─────────────────────────────────────────────
  // Handlers — Auto-Save Updates
  // ─────────────────────────────────────────────

  const handleUpdateField = async (field: string, value: any, displayName: string) => {
    try {
      const updated = await updateTicket(String(ticket.id), { [field]: value });
      if (updated) {
        setTicket(updated);
        toast({ title: "Saved", description: `${displayName} updated.`, variant: "success" });
      }
    } catch {
      toast({ title: "Error", description: `Failed to update ${displayName}.`, variant: "destructive" });
      // Revert local state on error
      if (field === 'priority') setPriority(ticket.priority);
      if (field === 'category') setCategory(ticket.category);
      if (field === 'assignedToId') setAssignedTo(ticket.assignedTo || "");
    }
  };

  const handlePriorityChange = (val: string) => {
    setPriority(val); // Optimistic UI
    handleUpdateField('priority', val, 'Priority');
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    handleUpdateField('category', val, 'Category');
  };

  const handleAssignedToChange = (val: string) => {
    if (val === "unassigned" || !val) {
      setAssignedTo("");
      handleUpdateField('assignedToId', null, 'Assignee');
    } else {
      const selectedAgent = agents.find((a) => a.name === val);
      if (selectedAgent) {
        setAssignedTo(selectedAgent.name);
        handleUpdateField('assignedToId', selectedAgent.id, 'Assignee');
      }
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    
    const isResolvingWithoutSummary =
      (newStatus.toLowerCase() === "resolved" || newStatus.toLowerCase() === "closed") &&
      !ticket?.resolutionSummary;

    if (isResolvingWithoutSummary) {
      setShowResolveDialog(true);
      return;
    }
    
    // Check if the new status requires a reason
    const targetStatus = statuses.find(s => s.name === newStatus);
    if (targetStatus?.requiresReason) {
      setShowReasonDialog(true);
      return;
    }

    // Direct save
    handleUpdateStatusDirect(newStatus);
  };

  const handleUpdateStatusDirect = async (newStatus: string, reason?: string) => {
    try {
      const updated = await updateTicket(String(ticket.id), {
        status: newStatus,
        reason: reason || undefined,
      });

      if (updated) {
        setTicket(updated);
        setStatus(updated.status);
        toast({ title: "Saved", description: "Status updated.", variant: "success" });
        setShowReasonDialog(false);
        setStatusReason("");
      }
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      setStatus(ticket.status); // Revert
    }
  };

  const handleSubmitReason = () => {
    if (!statusReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason.", variant: "destructive" });
      return;
    }
    handleUpdateStatusDirect(status, statusReason);
  };

  const handleReasonDialogChange = (open: boolean) => {
    setShowReasonDialog(open);
    if (!open) {
      setStatus(ticket.status);
      setStatusReason("");
    }
  };

  // ─────────────────────────────────────────────
  // Handlers — Resolve Dialog
  // ─────────────────────────────────────────────

  /**
   * Buka dialog resolve dengan validasi:
   * - Hanya assignee yang boleh resolve
   * - Ticket harus sudah di-assign
   */
  const handleOpenResolveDialog = () => {
    if (ticket?.assignedTo && ticket.assignedTo !== currentUser?.name) {
      toast({
        title: "Wait a moment",
        description: "Only the assigned staff can resolve this ticket.",
        variant: "destructive",
      });
      return;
    }
    if (!ticket?.assignedTo) {
      toast({
        title: "Assignment Required",
        description: "Please assign this ticket to yourself before resolving it.",
        variant: "destructive",
      });
      setStatus(ticket.status); // revert
      return;
    }

    setResolutionError("");
    setResolutionSummary("");
    setResolutionImage(null);
    setResolveDate(toDatetimeLocalString(new Date()));
    setShowResolveDialog(true);
  };

  /**
   * Submit form resolve ticket dengan validasi resolution summary.
   * Minimum 20 karakter.
   */
  const handleSubmitResolution = async () => {
    if (!resolutionSummary.trim()) {
      setResolutionError("Resolution summary is required");
      return;
    }
    if (resolutionSummary.trim().length < 20) {
      setResolutionError("Please provide a more detailed resolution (minimum 20 characters)");
      return;
    }

    try {
      let resolvedAtISO: string | undefined;
      if (resolveDate) {
        const dateObj = new Date(resolveDate);
        if (!isNaN(dateObj.getTime())) resolvedAtISO = dateObj.toISOString();
      }

      const updated = await updateTicketStatus(
        String(ticket.id),
        "resolved",
        resolutionSummary,
        resolvedAtISO,
        resolutionImage || undefined
      );

      if (updated) {
        setTicket(updated);
        setStatus(updated.status);
        setShowResolveDialog(false);
        setResolutionSummary("");
        setResolutionImage(null);

        toast({
          title: "Ticket Resolved! 🎉",
          description: `Ticket ${ticket.id} berhasil ditutup.`,
          variant: "success",
        });
      } else {
        toast({ title: "Error", description: "Gagal resolve ticket.", variant: "destructive" });
        setStatus(ticket.status);
      }
    } catch {
      toast({ title: "Error", description: "Terjadi kesalahan tak terduga.", variant: "destructive" });
      setStatus(ticket.status);
    }
  };

  // ─────────────────────────────────────────────
  // Handlers — Staff Modal
  // ─────────────────────────────────────────────

  /**
   * Buka modal profile staff dan muat daftar ticket yang dikerjakan.
   * Jika staff tidak ada di agents list, fetch dari API secara spesifik.
   *
   * @param staffId - ID staff (string)
   */
  const handleStaffClick = async (staffId: string) => {
    const agent = agents.find((a) => String(a.id) === staffId);
    let staffInfo: StaffInfo | undefined = agent
      ? { id: String(agent.id), name: agent.name, email: agent.email, phone: agent.phone, username: agent.username }
      : undefined;

    if (!staffInfo) {
      try {
        const response = await usersApi.getById(staffId);
        if (response.success && response.data) {
          const user = (response.data as { user: { id: string; full_name: string; email: string; phone?: string; username: string } }).user;
          staffInfo = {
            id: String(user.id),
            name: user.full_name,
            email: user.email,
            phone: user.phone,
            username: user.username,
          };
        }
      } catch {
        // Staff tidak ditemukan — silent fail
      }
    }

    if (!staffInfo) return;

    setSelectedStaff(staffInfo);
    setIsStaffModalOpen(true);
    setLoadingStaffTickets(true);

    try {
      const { tickets } = await getTickets({ assignedTo: staffId });
      setStaffTickets(tickets);
    } catch {
      // Gagal muat tickets staff — modal tetap terbuka tapi kosong
    } finally {
      setLoadingStaffTickets(false);
    }
  };

  // ─────────────────────────────────────────────
  // Handlers — Note Image
  // ─────────────────────────────────────────────

  /**
   * Handle upload gambar untuk note — compress sebelum set state.
   *
   * @param file - File gambar dari input
   */
  const handleNoteImageChange = async (file: File) => {
    const compressed = await compressImage(file);
    setNoteImage(compressed);
  };

  const handleResolutionImageChange = async (file: File | null) => {
    if (!file) { setResolutionImage(null); return; }
    const compressed = await compressImage(file);
    setResolutionImage(compressed);
  };

  /**
   * Tambah internal note secara terpisah tanpa update status ticket
   */
  const handleAddNote = async () => {
    if (!newNote && !noteImage) {
      toast({ title: "Wait a moment", description: "Please add a note or image.", variant: "destructive" });
      return;
    }

    try {
      const note = await addTicketNote(
        String(ticket.id),
        newNote || "Note with image",
        true,
        noteImage || undefined
      );

      if (note) {
        setNewNote("");
        setNoteImage(null);
        setTicket(prev => ({
          ...prev,
          notes: [...prev.notes, note]
        }));
        
        toast({
          title: "Note Added",
          description: "Internal note berhasil ditambahkan.",
          variant: "success",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Gagal menambah internal note.",
        variant: "destructive",
      });
    }
  };

  // ─────────────────────────────────────────────
  // Handlers — Edit Resolved At
  // ─────────────────────────────────────────────

  /**
   * Buka form edit waktu resolved dan pre-fill dengan nilai saat ini.
   */
  const handleOpenEditResolvedAt = () => {
    const d = ticket.resolvedAt
      ? new Date(ticket.resolvedAt)
      : new Date(ticket.updatedAt);
    setEditResolvedAtValue(toDatetimeLocalString(d));
    setIsEditingResolvedAt(true);
  };

  /**
   * Simpan perubahan waktu resolved ke API.
   */
  const handleSaveResolvedAt = async () => {
    if (!editResolvedAtValue) return;
    const dateObj = new Date(editResolvedAtValue);
    if (isNaN(dateObj.getTime())) return;

    try {
      const updated = await updateTicket(String(ticket.id), { resolvedAt: dateObj });
      if (updated) setTicket(updated);
      setIsEditingResolvedAt(false);
    } catch {
      // Silent — pengguna bisa coba lagi
    }
  };

  // ─────────────────────────────────────────────
  // Assign to Self (dashboard shortcut dipakai juga di sini)
  // ─────────────────────────────────────────────

  /**
   * Assign ticket ke user yang sedang login.
   */
  const handleAssignToSelf = async () => {
    if (!currentUser) return;
    try {
      const updated = await assignTicket(String(ticket.id), currentUser.id);
      if (updated) {
        setTicket(updated);
        setAssignedTo(updated.assignedTo || "");
      }
    } catch {
      toast({ title: "Error", description: "Gagal assign ticket.", variant: "destructive" });
    }
  };

  return {
    // State
    ticket,
    status, setStatus,
    priority, setPriority,
    category, setCategory,
    assignedTo, setAssignedTo,
    collaborators,
    collaboratorIds,
    newNote, setNewNote,
    noteImage, setNoteImage,
    resolutionSummary, setResolutionSummary,
    showResolveDialog, setShowResolveDialog,
    resolutionError,
    resolveDate, setResolveDate,
    resolutionImage, setResolutionImage,
    handleResolutionImageChange,
    isEditingResolvedAt, setIsEditingResolvedAt,
    editResolvedAtValue, setEditResolvedAtValue,
    isStaffModalOpen, setIsStaffModalOpen,
    selectedStaff,
    loadingStaffTickets,
    staffTickets,
    showReasonDialog,
    handleReasonDialogChange,
    statusReason, setStatusReason,

    // Handlers
    handleStatusChange,
    handlePriorityChange,
    handleCategoryChange,
    handleAssignedToChange,
    handleAddCollaborator,
    handleRemoveCollaborator,
    handleSubmitReason,
    handleOpenResolveDialog,
    handleSubmitResolution,
    handleStaffClick,
    handleNoteImageChange,
    handleAddNote,
    handleOpenEditResolvedAt,
    handleSaveResolvedAt,
    handleAssignToSelf,
    navigate,
  };
}
