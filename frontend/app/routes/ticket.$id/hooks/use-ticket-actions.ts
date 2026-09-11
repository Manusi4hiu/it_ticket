/**
 * use-ticket-actions.ts
 *
 * Custom hook yang mengenkapsulasi semua state dan handler
 * untuk operasi ticket detail (update, resolve, collaborator, staff modal).
 *
 * Memisahkan logika dari presentasi sehingga komponen-komponen
 * di ticket.$id hanya fokus pada rendering.
 */

import { useRef, useState } from "react";
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
  const [resolveCategory, setResolveCategory] = useState("");
  const [resolveCategoryError, setResolveCategoryError] = useState("");

  // ── Reason Dialog State ──
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [statusReason, setStatusReason] = useState("");

  // ── Transfer (Oper) Dialog State ──
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ agentId: number; agentName: string } | null>(null);
  const [transferReason, setTransferReason] = useState("");

  // ── Admin Override Reason Dialog State ──
  // Admin mengubah assignee/status/kategori/priority tiket yang SUDAH DIAMBIL
  // oleh staff lain -> alasan WAJIB, dikirim sebagai notifikasi ke staff terkait.
  const [showAdminReasonDialog, setShowAdminReasonDialog] = useState(false);
  const [adminOverride, setAdminOverride] = useState<{
    field: 'assignedToId' | 'status' | 'category' | 'priority';
    value: any;
    label: string;
  } | null>(null);
  const [adminReason, setAdminReason] = useState("");
  const isAdmin = currentUser?.role === "Administrator";

  // ── Category Reason Dialog State (staff pemilik) ──
  // Staff pemilik mengubah kategori tiketnya sendiri (yang sudah diambil)
  // -> alasan wajib, tercatat ke Ticket History (tanpa notif admin).
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryOverride, setCategoryOverride] = useState<{ value: string; label: string } | null>(null);
  const [categoryReason, setCategoryReason] = useState("");

  // ── Priority Reason Dialog State (staff pemilik) ──
  // Staff pemilik mengubah prioritas tiketnya sendiri (yang sudah diambil)
  // -> alasan wajib, tercatat ke Ticket History (tanpa notif admin).
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [priorityOverride, setPriorityOverride] = useState<{ value: string; label: string } | null>(null);
  const [priorityReason, setPriorityReason] = useState("");

  // ── SLA Edit State ──
  const [isEditingResolvedAt, setIsEditingResolvedAt] = useState(false);
  const [editResolvedAtValue, setEditResolvedAtValue] = useState<string>("");

  // ── Staff Modal State ──
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffInfo | null>(null);
  const [loadingStaffTickets, setLoadingStaffTickets] = useState(false);
  const [staffTickets, setStaffTickets] = useState<Ticket[]>([]);

  // ── Dialog submit race guard ──
  // Submit sukses menutup dialog (setShowX(false)) → onOpenChange(false) jalan
  // dengan closure `ticket` basi dan me-revert dropdown ke nilai lama,
  // menimpa nilai baru yang baru saja disimpan. Tandai submit sukses agar
  // revert dilewati.
  const dialogSavedRef = useRef(false);

  // ─────────────────────────────────────────────
  // Handlers — Collaborator
  // ─────────────────────────────────────────────

  const handleAddCollaborator = async (collaboratorId: string) => {
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

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    const agent = agents.find((a) => String(a.id) === collaboratorId);
    if (!agent) return;

    const newIds = collaboratorIds.filter((id) => id !== collaboratorId);
    const newNames = collaborators.filter((name) => name !== agent.name);
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
        setStatus(updated.status);
        setCategory(updated.category);
        setPriority(updated.priority);
        setAssignedTo(updated.assignedTo || "");
        toast({ title: "Saved", description: `${displayName} updated.`, variant: "success" });
      } else {
        toast({ title: "Error", description: `Failed to update ${displayName}.`, variant: "destructive" });
        if (field === 'priority') setPriority(ticket.priority);
        if (field === 'category') setCategory(ticket.category);
        if (field === 'assignedToId') setAssignedTo(ticket.assignedTo || "");
      }
    } catch {
      toast({ title: "Error", description: `Failed to update ${displayName}.`, variant: "destructive" });
      if (field === 'priority') setPriority(ticket.priority);
      if (field === 'category') setCategory(ticket.category);
      if (field === 'assignedToId') setAssignedTo(ticket.assignedTo || "");
    }
  };

  const handlePriorityChange = (val: string) => {
    if (!val) return;
    // No-op: prioritas sama — tidak ada dialog
    if (val.toLowerCase() === String(ticket.priority).toLowerCase()) {
      setPriority(ticket.priority);
      return;
    }
    // Cek apakah ini perubahan prioritas pertama kali (gratis tanpa dialog):
    const priorityChangeCount = (ticket.notes || []).filter(
      (n) => n.content?.toLowerCase().includes("prioritas diganti dari")
    ).length;
    const isFirstChange = priorityChangeCount === 0;

    if (!isFirstChange) {
      const isStaffHoldingTicket = ticket.assignedToId && currentUser && String(currentUser.id) !== String(ticket.assignedToId);
      if (isAdmin && isStaffHoldingTicket) {
        setAdminOverride({ field: 'priority', value: val, label: `Prioritas: ${ticket.priority} → ${val}` });
        setAdminReason("");
        setShowAdminReasonDialog(true);
        return;
      }
      // Staff pemilik atau Admin pada tiket sendiri / unassigned: dialog reason prioritas
      setPriorityOverride({ value: val, label: `Prioritas: ${ticket.priority} → ${val}` });
      setPriorityReason("");
      setShowPriorityDialog(true);
      return;
    }
    setPriority(val);
    handleUpdateField('priority', val, 'Priority');
  };

  const handleCategoryChange = (val: string) => {
    if (!val || !val.trim()) return;
    // No-op: kategori sama — tidak ada dialog
    if (val === ticket.category) {
      setCategory(ticket.category);
      return;
    }
    // Cek apakah ini perubahan kategori pertama kali (gratis tanpa dialog):
    // Gratis jika dari 'Uncategorized' atau belum pernah ada catatan perubahan kategori di notes
    const categoryChangeCount = (ticket.notes || []).filter(
      (n) => n.content?.toLowerCase().includes("kategori diganti dari")
    ).length;
    const isFirstChange = String(ticket.category).trim().toLowerCase() === "uncategorized" || categoryChangeCount === 0;

    if (!isFirstChange) {
      const isStaffHoldingTicket = ticket.assignedToId && currentUser && String(currentUser.id) !== String(ticket.assignedToId);
      if (isAdmin && isStaffHoldingTicket) {
        setAdminOverride({ field: 'category', value: val, label: `Kategori: ${ticket.category} → ${val}` });
        setAdminReason("");
        setShowAdminReasonDialog(true);
        return;
      }
      // Staff pemilik atau Admin pada tiket sendiri / unassigned: dialog reason kategori
      setCategoryOverride({ value: val, label: `Kategori: ${ticket.category} → ${val}` });
      setCategoryReason("");
      setShowCategoryDialog(true);
      return;
    }
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
        // OPER (transfer): tiket SUDAH dipegang sebelumnya dan dipindah ke staff lain
        // Perubahan pertama (dari unassigned -> staff): GRATIS tanpa alasan.
        // Perubahan ke-2+ (transfer antar staff): WAJIB alasan dialog.
        const currentHolderId = ticket.assignedToId;
        const isTransfer = Boolean(currentHolderId) && String(currentHolderId) !== String(selectedAgent.id);
        if (isTransfer) {
          if (isAdmin) {
            setAdminOverride({ field: 'assignedToId', value: selectedAgent.id, label: `Assignee: ${ticket.assignedTo} → ${selectedAgent.name}` });
            setAdminReason("");
            setShowAdminReasonDialog(true);
            return;
          }
          setTransferTarget({ agentId: selectedAgent.id, agentName: selectedAgent.name });
          setShowTransferDialog(true);
          return; // jangan langsung assign — tunggu reason diisi
        }
        setAssignedTo(selectedAgent.name);
        handleUpdateField('assignedToId', selectedAgent.id, 'Assignee');
      }
    }
  };

  const handleTransferDialogChange = (open: boolean) => {
    setShowTransferDialog(open);
    if (!open) {
      setTransferReason("");
      setTransferTarget(null);
      if (!dialogSavedRef.current) setAssignedTo(ticket.assignedTo || "");
      dialogSavedRef.current = false;
    }
  };

  // ── Admin Override Reason handlers ──
  const handleAdminReasonDialogChange = (open: boolean) => {
    setShowAdminReasonDialog(open);
    if (!open) {
      setAdminOverride(null);
      setAdminReason("");
      // revert tampilan ke nilai asli tiket — lewati jika baru saja sukses submit
      if (!dialogSavedRef.current) {
        setCategory(ticket.category);
        setStatus(ticket.status);
        setPriority(ticket.priority);
        setAssignedTo(ticket.assignedTo || "");
      }
      dialogSavedRef.current = false;
    }
  };

  // ── Category Reason handlers (staff pemilik) ──
  const handleCategoryDialogChange = (open: boolean) => {
    setShowCategoryDialog(open);
    if (!open) {
      setCategoryOverride(null);
      setCategoryReason("");
      // revert dropdown — lewati jika baru saja sukses submit (anti race)
      if (!dialogSavedRef.current) setCategory(ticket.category);
      dialogSavedRef.current = false;
    }
  };

  // ── Priority Reason handlers (staff pemilik) ──
  const handlePriorityDialogChange = (open: boolean) => {
    setShowPriorityDialog(open);
    if (!open) {
      setPriorityOverride(null);
      setPriorityReason("");
      // revert dropdown — lewati jika baru saja sukses submit (anti race)
      if (!dialogSavedRef.current) setPriority(ticket.priority);
      dialogSavedRef.current = false;
    }
  };

  const handleSubmitCategoryReason = async () => {
    if (!categoryOverride) return;
    if (!categoryReason.trim()) {
      toast({ title: "Alasan Wajib", description: "Alasan perubahan kategori wajib diisi — akan tercatat di Ticket History.", variant: "destructive" });
      return;
    }
    try {
      const updated = await updateTicket(String(ticket.id), {
        category: categoryOverride.value,
        reason: categoryReason.trim(),
      });
      if (updated) {
        setTicket(updated);
        setCategory(updated.category);
        dialogSavedRef.current = true;
        setShowCategoryDialog(false);
        setCategoryOverride(null);
        setCategoryReason("");
        toast({ title: "Kategori Diubah", description: "Perubahan tercatat di Ticket History.", variant: "success" });
      } else {
        toast({ title: "Error", description: "Gagal mengubah kategori.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengubah kategori.", variant: "destructive" });
      handleCategoryDialogChange(false);
    }
  };

  const handleSubmitPriorityReason = async () => {
    if (!priorityOverride) return;
    if (!priorityReason.trim()) {
      toast({ title: "Alasan Wajib", description: "Alasan perubahan prioritas wajib diisi — akan tercatat di Ticket History.", variant: "destructive" });
      return;
    }
    try {
      const updated = await updateTicket(String(ticket.id), {
        priority: priorityOverride.value,
        reason: priorityReason.trim(),
      });
      if (updated) {
        setTicket(updated);
        setPriority(updated.priority);
        dialogSavedRef.current = true;
        setShowPriorityDialog(false);
        setPriorityOverride(null);
        setPriorityReason("");
        toast({ title: "Prioritas Diubah", description: "Perubahan tercatat di Ticket History.", variant: "success" });
      } else {
        toast({ title: "Error", description: "Gagal mengubah prioritas.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengubah prioritas.", variant: "destructive" });
      handlePriorityDialogChange(false);
    }
  };

  const handleSubmitAdminReason = async () => {
    if (!adminOverride) return;
    if (!adminReason.trim()) {
      toast({ title: "Alasan Wajib", description: "Alasan dari Admin wajib diisi — akan dikirim sebagai notifikasi ke staff terkait.", variant: "destructive" });
      return;
    }
    try {
      let updated: Ticket | null = null;

      if (adminOverride.field === 'assignedToId') {
        // Perubahan assignee: pakai endpoint oper (/assign) — status tiket TIDAK
        // ikut diutak-atik (tiket Assigned tetap Assigned). Alasan dikirim ke
        // pemilik lama + assignee baru lewat jalur oper admin.
        updated = await assignTicket(String(ticket.id), String(adminOverride.value), adminReason.trim());
      } else {
        updated = await updateTicket(String(ticket.id), {
          [adminOverride.field]: adminOverride.value,
          reason: adminReason.trim(),
        });
      }

      if (updated) {
        setTicket(updated);
        setStatus(updated.status);
        setCategory(updated.category);
        setPriority(updated.priority);
        setAssignedTo(updated.assignedTo || "");
        dialogSavedRef.current = true;
        setShowAdminReasonDialog(false);
        setAdminOverride(null);
        setAdminReason("");
        toast({ title: "Saved", description: `${adminOverride.label} — alasan dikirim ke staff terkait.`, variant: "success" });
      } else {
        toast({ title: "Error", description: "Gagal mengubah tiket.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengubah tiket.", variant: "destructive" });
      handleAdminReasonDialogChange(false);
    }
  };

  const handleSubmitTransferReason = async () => {
    if (!transferTarget) return;
    if (!transferReason.trim()) {
      toast({ title: "Reason Required", description: "Alasan oper wajib diisi — jelaskan mengapa tiket ini dioper.", variant: "destructive" });
      return;
    }
    try {
      const updated = await assignTicket(String(ticket.id), String(transferTarget.agentId), transferReason.trim());
      if (updated) {
        setTicket(updated);
        setAssignedTo(updated.assignedTo || "");
        dialogSavedRef.current = true;
        setShowTransferDialog(false);
        setTransferReason("");
        setTransferTarget(null);
        toast({ title: "Ticket Transferred", description: `Tiket berhasil dioper ke ${transferTarget.agentName}.`, variant: "success" });
      } else {
        toast({ title: "Error", description: "Gagal mengoper tiket.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengoper tiket.", variant: "destructive" });
    }
  };

  const handleStatusChange = (newStatus: string) => {
    // Guard: Radix Select kadang emit onValueChange dgn value kosong saat
    // re-render/reset — jangan dianggap perubahan status (mencegah dialog reason liar).
    if (!newStatus || !newStatus.trim()) return;
    if (newStatus === ticket.status) {
      // Tidak ada perubahan nyata — sinkronkan tampilan saja.
      setStatus(ticket.status);
      return;
    }
    setStatus(newStatus);

    const isResolvingWithoutSummary =
      (newStatus.toLowerCase() === "resolved" || newStatus.toLowerCase() === "closed") &&
      !ticket?.resolutionSummary;

    if (isResolvingWithoutSummary) {
      setResolveCategory("");
      setShowResolveDialog(true);
      return;
    }

    // Admin mengubah status tiket milik staff -> wajib alasan (notif ke pemilik).
    // Dialog reason status HANYA jika status benar-benar berubah ke status lain.
    const isStaffHoldingTicket = ticket.assignedToId && currentUser && String(currentUser.id) !== String(ticket.assignedToId);
    if (isAdmin && isStaffHoldingTicket && newStatus !== ticket.status) {
      setAdminOverride({ field: 'status', value: newStatus, label: `Status: ${ticket.status} → ${newStatus}` });
      setAdminReason("");
      setShowAdminReasonDialog(true);
      return;
    }

    // Status reason dialog: sinkron dengan master data status.requiresReason
    const targetStatus = statuses.find(
      (s) => s.name.trim().toLowerCase() === newStatus.trim().toLowerCase()
    );
    if (targetStatus?.requiresReason) {
      setStatusReason("");
      setShowReasonDialog(true);
      return;
    }

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
        dialogSavedRef.current = true;
        setShowReasonDialog(false);
        setStatusReason("");
      }
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      setStatus(ticket.status);
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
      // revert dropdown — lewati jika baru saja sukses submit (anti race)
      if (!dialogSavedRef.current) setStatus(ticket.status);
      dialogSavedRef.current = false;
      setStatusReason("");
    }
  };

  // ─────────────────────────────────────────────
  // Handlers — Resolve Dialog
  // ─────────────────────────────────────────────

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
      setStatus(ticket.status);
      return;
    }

    setResolutionError("");
    setResolutionSummary("");
    setResolutionImage(null);
    setResolveCategory("");
    setResolveCategoryError("");
    setResolveDate(toDatetimeLocalString(new Date()));
    setShowResolveDialog(true);
  };

  const handleSubmitResolution = async () => {
    if (resolveDate) {
      const dateObj = new Date(resolveDate);
      if (dateObj > new Date()) {
        setResolutionError("Waktu penyelesaian tidak boleh di masa depan (maksimal sekarang).");
        return;
      }
    }
    if (!resolutionSummary.trim()) {
      setResolutionError("Resolution summary is required");
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
        // Update category if changed
        let final = updated;
        if (resolveCategory && resolveCategory !== updated.category) {
          const catUpdated = await updateTicket(String(ticket.id), { category: resolveCategory });
          if (catUpdated) final = catUpdated;
        }

        setTicket(final);
        setStatus(final.status);
        setCategory(final.category);
        setShowResolveDialog(false);
        setResolutionSummary("");
        setResolutionImage(null);
        setResolveCategory("");

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
      // Silent fail
    } finally {
      setLoadingStaffTickets(false);
    }
  };

  // ─────────────────────────────────────────────
  // Handlers — Note Image with Compression
  // ─────────────────────────────────────────────

  const handleNoteImageChange = async (file: File | null) => {
    if (!file) {
      setNoteImage(null);
      return;
    }

    try {
      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.75 });
      setNoteImage(compressed);
    } catch (err) {
      console.error("Compression error:", err);
      setNoteImage(file);
    }
  };

  const handleClearNoteImage = () => {
    setNoteImage(null);
  };

  const handleResolutionImageChange = async (file: File | null) => {
    if (!file) {
      setResolutionImage(null);
      return;
    }

    setResolutionError("");
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.75 });
      setResolutionImage(compressed);
    } catch (err) {
      console.error("Compression error:", err);
      setResolutionImage(file);
    }
  };

  const handleClearResolutionImage = () => {
    setResolutionImage(null);
  };

  /**
   * Tambah internal note secara terpisah tanpa update status ticket
   */
  const handleAddNote = async () => {
    if (!newNote.trim() && !noteImage) {
      toast({ title: "Wait a moment", description: "Please add a note or image.", variant: "destructive" });
      return;
    }

    try {
      const note = await addTicketNote(
        String(ticket.id),
        newNote || "Note with image documentation",
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

  const handleOpenEditResolvedAt = () => {
    const d = ticket.resolvedAt
      ? new Date(ticket.resolvedAt)
      : new Date(ticket.updatedAt);
    setEditResolvedAtValue(toDatetimeLocalString(d));
    setIsEditingResolvedAt(true);
  };

  const handleSaveResolvedAt = async () => {
    if (!editResolvedAtValue) return;
    const dateObj = new Date(editResolvedAtValue);
    if (isNaN(dateObj.getTime())) return;
    if (dateObj > new Date()) {
      toast({
        title: "Error",
        description: "Waktu penyelesaian tidak boleh di masa depan (maksimal sekarang).",
        variant: "destructive",
      });
      return;
    }

    try {
      const updated = await updateTicket(String(ticket.id), { resolvedAt: dateObj });
      if (updated) setTicket(updated);
      setIsEditingResolvedAt(false);
    } catch {
      // Silent
    }
  };

  const handleAssignToSelf = async () => {
    if (!currentUser) return;
    try {
      const updated = await assignTicket(String(ticket.id), currentUser.id);
      if (updated) {
        setTicket(updated);
        setAssignedTo(updated.assignedTo || "");
        setStatus(updated.status);
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
    handleNoteImageChange,
    handleClearNoteImage,
    resolutionSummary, setResolutionSummary,
    showResolveDialog, setShowResolveDialog,
    resolutionError,
    resolveDate, setResolveDate,
    resolutionImage, setResolutionImage,
    handleResolutionImageChange,
    handleClearResolutionImage,
    isEditingResolvedAt, setIsEditingResolvedAt,
    editResolvedAtValue, setEditResolvedAtValue,
    isStaffModalOpen, setIsStaffModalOpen,
    selectedStaff,
    loadingStaffTickets,
    staffTickets,
    showReasonDialog,
    handleReasonDialogChange,
    statusReason, setStatusReason,

    // Transfer (Oper) Dialog State
    showTransferDialog,
    handleTransferDialogChange,
    transferTarget,
    transferReason, setTransferReason,
    handleSubmitTransferReason,

    // Admin Override Reason Dialog State
    showAdminReasonDialog,
    handleAdminReasonDialogChange,
    adminOverride,
    adminReason, setAdminReason,
    handleSubmitAdminReason,

    // Category Reason Dialog State (staff pemilik)
    showCategoryDialog,
    handleCategoryDialogChange,
    categoryOverride,
    categoryReason, setCategoryReason,
    handleSubmitCategoryReason,

    // Priority Reason Dialog State (staff pemilik)
    showPriorityDialog,
    handlePriorityDialogChange,
    priorityOverride,
    priorityReason, setPriorityReason,
    handleSubmitPriorityReason,

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
    handleAddNote,
    handleOpenEditResolvedAt,
    handleSaveResolvedAt,
    handleAssignToSelf,
    navigate,
  };
}
