import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/route";
import {
  Inbox,
  UserCheck,
  Clock,
  CheckCircle,
  Tag,
  Flag,
  User,
  Plus,
  Server,
  Cpu,
  Database,
  Search,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Activity,
  Hourglass,
  Settings2
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Card, CardContent } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { Textarea } from "~/components/ui/textarea/textarea";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import {
  getTicketById,
  getTickets,
  getAgents,
  assignTicket,
  createTicket,
  updateTicketStatus,
  addTicketNote,
  deleteTicket,
  updateTicket,
  type Ticket,
  type Agent
} from "~/services/ticket.service";
import { settingsApi } from "~/services/settings.service";
import { ReasonDialog } from "~/routes/ticket.$id/components/ReasonDialog";
import { TransferDialog } from "~/routes/ticket.$id/components/TransferDialog";
import { PriorityChangeDialog } from "~/routes/ticket.$id/components/PriorityChangeDialog";
import { ResolveDialog } from "~/routes/ticket.$id/components/ResolveDialog";
import { requireRole } from "~/services/session.service";
import { isSystemNote } from "~/utils/ticket-history";
import {
  validateFields,
  hasErrors,
  focusFirstError,
  FieldError,
  fieldErrorStyle,
  required,
  minLength,
  maxLength,
} from "~/utils/form-validation";
import styles from "./style.module.css";

// ── Status icons per name (lowercase key) ──
const STATUS_ICONS_MAP: Record<string, React.ReactNode> = {
  new: <Inbox size={18} />,
  assigned: <UserCheck size={18} />,
  "in progress": <Clock size={18} />,
  pending: <Hourglass size={18} />,
  resolved: <CheckCircle size={18} />,
};

export async function loader({ request }: Route.LoaderArgs) {
  // Management boleh akses Dev Board (view-only); Admin & Staff full access
  const session = await requireRole(request, ["Administrator", "Staff", "Management"]);

  const [ticketsRes, agents, statusesRes, categoriesRes] = await Promise.all([
    getTickets({ category: "Development", per_page: 150 }), // Only show Development-scoped tracking tasks
    getAgents(),
    settingsApi.getStatuses(),
    settingsApi.getCategories()
  ]);

  return Response.json({
    session,
    initialTickets: ticketsRes.tickets,
    agents,
    statuses: (statusesRes.data?.data || []).filter((s: any) => s.showOnDevboard)
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    categories: categoriesRes.data?.data || []
  });
}

export default function DevDashboard() {
  const { session, initialTickets, agents, statuses: loaderStatuses, categories } = useLoaderData() as typeof loader extends (...args: any[]) => Promise<infer T> ? T : any;
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<any[]>(loaderStatuses);

  // Kanban tickets state
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [draggedTicketId, setDraggedTicketId] = useState<number | null>(null);
  const [activeDragColumn, setActiveDragColumn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Authorization helper — Management view-only (bisa lihat, tidak bisa interaksi)
  const isManagement = session?.userRole === "Management";
  const canManage = (session?.userRole === "Administrator" || session?.userRole === "Staff") && !isManagement;

  // Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isNoteInternal, setIsNoteInternal] = useState(true);
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState("");

  // Add Dev Task Modal State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskDesc, setAddTaskDesc] = useState("");
  const [addTaskPriority, setAddTaskPriority] = useState("medium");
  const [addTaskAssigneeId, setAddTaskAssigneeId] = useState("unassigned");
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);
  const [addTaskErrors, setAddTaskErrors] = useState<Record<string, string>>({});

  // Edit Dev Task Modal State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskAssigneeId, setEditTaskAssigneeId] = useState("unassigned");
  const [isTaskUpdating, setIsTaskUpdating] = useState(false);
  const [editTaskErrors, setEditTaskErrors] = useState<Record<string, string>>({});

  // Delete Task Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTaskDeleting, setIsTaskDeleting] = useState(false);

  // Status Change State
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ticketId: number, targetStatus: string} | null>(null);

  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolveDate, setResolveDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionError, setResolutionError] = useState("");
  const [resolutionImage, setResolutionImage] = useState<File | null>(null);
  const [resolveCategory, setResolveCategory] = useState("");
  const [resolveCategoryError, setResolveCategoryError] = useState("");

  // Transfer assignee dialog state (oper task taken → alasan wajib, server 409 tanpa alasan)
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{ toId: string; toName: string } | null>(null);
  const [transferReason, setTransferReason] = useState("");

  // Priority reason dialog state (ubah prioritas task taken → alasan wajib, server 400 tanpa alasan)
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [priorityReason, setPriorityReason] = useState("");

  // ── Otoritas task terpilih: Admin selalu bisa; staff hanya milik sendiri
  // atau belum dipegang siapa pun (sejalan dengan guard server).
  const currentUserId = String(session?.userId ?? "");
  const canEditSelected = !!selectedTicket && !isManagement &&
    (session?.userRole === "Administrator" ||
      !selectedTicket.assignedToId ||
      String(selectedTicket.assignedToId) === currentUserId);

  // Column reorder state (admin only)
  const isAdministrator = String(session?.userRole || "").toLowerCase() === "administrator";
  const [isEditColumnsOpen, setIsEditColumnsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<Array<{ id: string | number; name: string; color: string }>>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const openEditColumns = () => {
    if (!isAdministrator) return;
    setColumnOrder(statuses.map((s: any) => ({ id: s.id, name: s.name, color: s.color || "#6B7280" })));
    setIsEditColumnsOpen(true);
  };

  const moveColumn = (from: number, to: number) => {
    setColumnOrder((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSaveColumnOrder = async () => {
    if (!isAdministrator) {
      alert("Only Administrator can edit column order");
      return;
    }
    setIsSavingOrder(true);
    try {
      const res = await settingsApi.reorderStatuses(columnOrder.map((c) => c.id));
      if (res.success) {
        const fresh = (res.data?.data || []).filter((s: any) => s.showOnDevboard)
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        // statuses comes from loader; update via state replacement
        setStatuses(fresh);
        setIsEditColumnsOpen(false);
      } else {
        alert(res.error || "Failed to save column order");
      }
    } catch (err) {
      console.error("Failed to reorder columns:", err);
      alert("Failed to save column order");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleAddDevTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTaskSubmitting) return;

    // Validasi feedback eksplisit — jangan return diam-diam
    const errors = validateFields({
      addTaskTitle: [addTaskTitle, [required("Task Subject / Title"), minLength("Task Subject / Title", 3), maxLength("Task Subject / Title", 255)]],
      addTaskDesc: [addTaskDesc, [required("Task Description"), minLength("Task Description", 3), maxLength("Task Description", 5000)]],
    });
    setAddTaskErrors(errors);
    if (hasErrors(errors)) {
      focusFirstError(errors);
      return;
    }

    setIsTaskSubmitting(true);
    try {
      // 1. Create the ticket under 'Development' category
      const newTicket = await createTicket({
        title: addTaskTitle,
        description: addTaskDesc,
        category: "Development",
        priority: addTaskPriority,
        submitterName: session.userName,
        submitterEmail: session.userEmail || "dev@company.com",
        submitterPhone: "",
        submitterDepartment: "Development"
      });

      if (newTicket) {
        // 2. If an assignee is selected, assign it
        if (addTaskAssigneeId !== "unassigned") {
          await assignTicket(newTicket.id.toString(), addTaskAssigneeId);
        }

        // 3. Refresh list from server
        const updatedTickets = await getTickets({ category: "Development", per_page: 150 });
        setTickets(updatedTickets.tickets);

        // 4. Close dialog and reset form
        setIsAddDialogOpen(false);
        setAddTaskTitle("");
        setAddTaskDesc("");
        setAddTaskPriority("medium");
        setAddTaskAssigneeId("unassigned");
        setAddTaskErrors({});
      } else {
        setAddTaskErrors({ form: "Gagal membuat task — server menolak permintaan. Periksa kembali isian lalu coba lagi." });
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || "Terjadi kesalahan tak terduga saat membuat task.";
      setAddTaskErrors({ form: msg });
    } finally {
      setIsTaskSubmitting(false);
    }
  };

  // Event handlers for editing and deleting tasks
  const handleDeleteTicket = async () => {
    if (!selectedTicket) return;
    setIsTaskDeleting(true);
    
    try {
      const success = await deleteTicket(selectedTicket.id.toString());
      if (success) {
        setTickets((prev) => prev.filter((t) => t.id !== selectedTicket.id));
        setIsDeleteDialogOpen(false);
        setIsDetailOpen(false);
        setSelectedTicket(null);
      } else {
        alert("Failed to delete task. Please try again.");
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
      alert("Failed to delete task. Please try again.");
    } finally {
      setIsTaskDeleting(false);
    }
  };

  const handleOpenEdit = (ticket: Ticket) => {
    setEditTaskTitle(ticket.title);
    const cleanDesc = ticket.description.replace(/<[^>]*>/g, "");
    setEditTaskDesc(cleanDesc);
    setEditTaskPriority(ticket.priority.toLowerCase());
    setEditTaskAssigneeId(ticket.assignedToId?.toString() || "unassigned");
    setIsEditDialogOpen(true);
    setIsDetailOpen(false);
  };

  const handleEditDevTask = async (e: React.FormEvent, reasonOverride?: string) => {
    e.preventDefault();
    if (!selectedTicket || isTaskUpdating) return;

    // Validasi feedback eksplisit — jangan return diam-diam
    const errors = validateFields({
      editTaskTitle: [editTaskTitle, [required("Task Subject / Title"), minLength("Task Subject / Title", 3), maxLength("Task Subject / Title", 255)]],
      editTaskDesc: [editTaskDesc, [required("Task Description"), minLength("Task Description", 3), maxLength("Task Description", 5000)]],
    });
    setEditTaskErrors(errors);
    if (hasErrors(errors)) {
      focusFirstError(errors);
      return;
    }

    // Prioritas berubah pada task taken → alasan WAJIB (server 400 tanpa alasan).
    // Buka dialog alasan dulu, submit memanggil ulang fungsi ini dgn reason.
    const priorityChanged = !!selectedTicket.takenAt &&
      editTaskPriority.toLowerCase() !== String(selectedTicket.priority).toLowerCase();
    if (priorityChanged && !reasonOverride) {
      setPriorityReason("");
      setShowPriorityDialog(true);
      return;
    }

    // Oper assignee task taken wajib lewat dropdown Assignee di detail
    // (alasan wajib — dialog edit tidak punya field alasan).
    const newAssigneeStr = editTaskAssigneeId === "unassigned" ? null : editTaskAssigneeId;
    const prevAssigneeStr = selectedTicket.assignedToId?.toString() || null;
    if (prevAssigneeStr && newAssigneeStr !== prevAssigneeStr) {
      setEditTaskErrors({ form: newAssigneeStr
        ? "Untuk mengoper task ke staff lain, gunakan dropdown Assignee di detail task (alasan oper wajib diisi)."
        : "Task yang sudah diambil tidak bisa dilepas ke unassigned — hanya bisa dioper ke staff lain via dropdown Assignee di detail task." });
      return;
    }

    setIsTaskUpdating(true);
    try {
      const updated = await updateTicket(selectedTicket.id.toString(), {
        title: editTaskTitle,
        description: editTaskDesc,
        priority: editTaskPriority,
        assignedToId: editTaskAssigneeId === "unassigned" ? null : parseInt(editTaskAssigneeId, 10),
        reason: reasonOverride || undefined,
      });

      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
        setIsEditDialogOpen(false);
        setSelectedTicket(updated);
        setIsDetailOpen(true);
        setEditTaskErrors({});
      } else {
        setEditTaskErrors({ form: "Gagal menyimpan perubahan — server menolak permintaan. Periksa kembali isian lalu coba lagi." });
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || "Terjadi kesalahan tak terduga saat menyimpan task.";
      setEditTaskErrors({ form: msg });
    } finally {
      setIsTaskUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setIsDetailOpen(true);
  };

  const handleSubmitPriorityReason = async () => {
    if (!priorityReason.trim()) return;
    setShowPriorityDialog(false);
    await handleEditDevTask({ preventDefault: () => {} } as React.FormEvent, priorityReason.trim());
    setPriorityReason("");
  };

  // Filter tickets by search query
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.ticketCode && t.ticketCode.toLowerCase().includes(q)) ||
        t.submitterName.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  // Drag and Drop handlers — Management view-only: drag/drop dinonaktifkan.
  // Staff non-pemilik juga tidak bisa drag task milik orang lain (server menolak).
  const handleDragStart = (e: React.DragEvent, ticketId: number) => {
    if (isManagement) { e.preventDefault(); return; }
    const t = tickets.find((x) => x.id === ticketId);
    if (t && t.assignedToId && String(t.assignedToId) !== currentUserId &&
      session?.userRole !== "Administrator") { e.preventDefault(); return; }
    setDraggedTicketId(ticketId);
    e.dataTransfer.setData("text/plain", ticketId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTicketId(null);
    setActiveDragColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    if (isManagement) return; // kolom tidak menerima drop
    e.preventDefault();
    if (activeDragColumn !== columnId) {
      setActiveDragColumn(columnId);
    }
  };

  const handleUpdateStatusDirect = async (ticketId: number, targetStatus: string, reason?: string) => {
    const originalTicket = tickets.find((t) => t.id === ticketId);
    if (!originalTicket) return;

    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: targetStatus } : t))
    );

    try {
      const updated = await updateTicket(ticketId.toString(), {
        status: targetStatus,
        reason: reason || undefined,
      });
      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
      } else {
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? originalTicket : t)));
        alert("Gagal memindah status — server menolak. Kemungkinan: mengubah status task milik staff lain (hanya pemilik/Admin), atau Admin perlu alasan (ubah via halaman detail tiket).");
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? originalTicket : t)));
    }
  };

  const handleResolveDirect = async (ticketId: number, summary: string, date: string, image: File | null) => {
    const originalTicket = tickets.find((t) => t.id === ticketId);
    if (!originalTicket) return;

    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: "Resolved", resolvedAt: new Date(date) } : t))
    );

    try {
      const updated = await updateTicketStatus(ticketId.toString(), "Resolved", summary, new Date(date).toISOString(), image || undefined);
      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
      } else {
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? originalTicket : t)));
      }
    } catch (err) {
      console.error("Failed to resolve:", err);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? originalTicket : t)));
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (isManagement) return; // Management view-only: drop ditolak
    setDraggedTicketId(null);
    setActiveDragColumn(null);
    const ticketIdStr = e.dataTransfer.getData("text/plain") || draggedTicketId?.toString();
    if (!ticketIdStr) return;

    const ticketId = parseInt(ticketIdStr, 10);
    const originalTicket = tickets.find((t) => t.id === ticketId);
    if (!originalTicket) return;

    // Skip if status is unchanged
    if (originalTicket.status.toLowerCase() === targetStatus.toLowerCase()) return;

    const isResolvingWithoutSummary =
      (targetStatus.toLowerCase() === "resolved" || targetStatus.toLowerCase() === "closed") &&
      !originalTicket.resolutionSummary;

    if (isResolvingWithoutSummary) {
      setResolveCategory(originalTicket?.category || "Development");
      setResolveCategoryError("");
      setPendingStatusUpdate({ ticketId, targetStatus });
      setShowResolveDialog(true);
      return;
    }

    const statusConfig = statuses.find((s: any) => s.name.toLowerCase() === targetStatus.toLowerCase());
    // LOCK New: task taken tidak bisa dikembalikan ke New — tolak langsung dgn penjelasan
    if (originalTicket.takenAt && (statusConfig as any)?.isDefault) {
      alert("Task yang sudah pernah diambil tidak bisa dikembalikan ke status New. Gunakan oper (assign ke staff lain dengan alasan) jika ingin berpindah tangan.");
      return;
    }
    if (statusConfig?.requiresReason) {
      setPendingStatusUpdate({ ticketId, targetStatus });
      setShowReasonDialog(true);
      return;
    }

    // Status berubah pada task taken → alasan WAJIB (server 400 tanpa alasan).
    // Resolve punya dialog sendiri (return lebih awal di atas).
    if (originalTicket.takenAt && originalTicket.assignedToId) {
      setPendingStatusUpdate({ ticketId, targetStatus });
      setShowReasonDialog(true);
      return;
    }

    handleUpdateStatusDirect(ticketId, targetStatus);
  };

  const handleSubmitReason = async () => {
    if (!pendingStatusUpdate || !statusReason.trim()) return;
    await handleUpdateStatusDirect(pendingStatusUpdate.ticketId, pendingStatusUpdate.targetStatus, statusReason);
    setShowReasonDialog(false);
    setStatusReason("");
    setPendingStatusUpdate(null);
  };

  const handleSubmitResolution = async () => {
    if (!pendingStatusUpdate) return;
    if (resolveDate) {
      const dateObj = new Date(resolveDate);
      if (dateObj > new Date()) {
        setResolutionError("Waktu penyelesaian tidak boleh di masa depan (maksimal sekarang).");
        return;
      }
    }
    if (resolutionSummary.trim().length < 20) {
      setResolutionError("Summary must be at least 20 characters.");
      return;
    }
    setResolutionError("");
    await handleResolveDirect(pendingStatusUpdate.ticketId, resolutionSummary, resolveDate, resolutionImage);
    setShowResolveDialog(false);
    setResolutionSummary("");
    setResolutionImage(null);
    setPendingStatusUpdate(null);
  };

  const getPriorityColor = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === "critical") return "#EF4444";
    if (p === "high") return "#F59E0B";
    if (p === "medium") return "#3B82F6";
    return "#10B981";
  };

  const getStatusColor = (statusName: string) => {
    const status = statuses.find((s: any) => s.name.toLowerCase() === statusName.toLowerCase());
    return status?.color || "#6B7280";
  };

  const handleOpenDetail = async (ticket: Ticket) => {
    // Fetch fresh detail to get notes (list endpoint excludes them), use stale as fallback
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    setNewNoteContent("");
    try {
      const detailed = await getTicketById(ticket.id.toString());
      if (detailed) {
        setSelectedTicket(detailed);
        // Also sync the tickets state so other cards reflect any changes
        setTickets((prev) => prev.map((t) => (t.id === detailed.id ? detailed : t)));
      }
    } catch {
      // fallback to original ticket data
    }
  };

  const handleAssignChange = async (agentIdStr: string, reason?: string) => {
    if (!selectedTicket) return;
    // Guard: ticket resolved/closed/completed tidak boleh diubah assigneenya
    const s = String(selectedTicket.status || "").toLowerCase();
    if (["resolved", "closed", "completed"].includes(s)) {
      alert(`Ticket dengan status '${selectedTicket.status}' tidak bisa di-take/di-assign. Ubah statusnya terlebih dahulu dari '${selectedTicket.status}' ke status lain.`);
      return;
    }
    const agentId = agentIdStr === "unassigned" ? null : agentIdStr;
    // Oper task taken ke orang lain → alasan WAJIB (server 409 tanpa alasan).
    // Buka dialog alasan dulu, submit memanggil ulang fungsi ini dgn reason.
    const isTransfer = !!selectedTicket.assignedToId && agentId &&
      String(selectedTicket.assignedToId) !== String(agentId);
    if (isTransfer && !reason) {
      const toAgent = agents.find((a: Agent) => String(a.id) === String(agentId));
      setPendingTransfer({ toId: String(agentId), toName: toAgent?.name || "staff lain" });
      setTransferReason("");
      setShowTransferDialog(true);
      return;
    }
    try {
      const updated = await assignTicket(selectedTicket.id.toString(), agentId, reason);
      if (updated) {
        // Update local lists
        setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
        setSelectedTicket(updated);
      } else {
        alert("Gagal mengubah assignee — server menolak. Task taken hanya bisa dioper dengan alasan, dan task taken tidak bisa dilepas ke unassigned.");
      }
    } catch (err) {
      console.error("Failed to assign ticket:", err);
      alert("Gagal mengubah assignee — terjadi kesalahan. Coba lagi.");
    }
  };

  const handleSubmitTransfer = async () => {
    if (!pendingTransfer || !transferReason.trim()) return;
    await handleAssignChange(pendingTransfer.toId, transferReason.trim());
    setShowTransferDialog(false);
    setPendingTransfer(null);
    setTransferReason("");
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || isNoteSubmitting) return;
    // Feedback eksplisit bila note kosong
    if (!newNoteContent.trim()) {
      setNoteError("Catatan tidak boleh kosong / hanya spasi — tulis isi catatan dulu sebelum comment.");
      return;
    }
    setNoteError("");

    setIsNoteSubmitting(true);
    try {
      const newNote = await addTicketNote(selectedTicket.id.toString(), newNoteContent, isNoteInternal);
      if (newNote) {
        setSelectedTicket((prev) => prev ? { ...prev, notes: [...(prev.notes || []), newNote] } : prev);
        setNewNoteContent("");
      }
    } catch (err) {
      setNoteError("Gagal menambahkan catatan — server menolak. Coba lagi.");
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>


      {/* Search and Action Bar */}
      <div className={styles.actionRow}>
        <div className={styles.searchContainer}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search dev backlog (e.g. task name, ID)..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isAdministrator && (
            <Button variant="outline" onClick={openEditColumns} title="Edit column order (admin only)">
              <Settings2 size={15} style={{ marginRight: 6 }} />
              Edit Columns
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setIsAddDialogOpen(true)} className={styles.addDevTaskBtn}>
              <Plus size={16} style={{ marginRight: 6 }} />
              Add Dev Task
            </Button>
          )}
          {isManagement && (
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
              View-only access
            </span>
          )}
        </div>
      </div>

      {/* Kanban Board Layout */}
      <div className={styles.kanbanBoard}>
        {(statuses as any[])
          .filter((s: any) => s.showOnDevboard)
          .sort((a: any, b: any) => a.order - b.order)
          .map((statusDef: any) => {
          const colName = statusDef.name;
          const color = statusDef.color || "#6B7280";
          const iconKey = colName.toLowerCase();
          const columnIcon = STATUS_ICONS_MAP[iconKey] || <Inbox size={18} />;

          // "Resolved" column also includes "closed" tickets
          const columnTickets = filteredTickets.filter((ticket) => {
            const status = ticket.status.toLowerCase();
            if (iconKey === "resolved") {
              return status === "resolved" || status === "closed";
            }
            return status === iconKey;
          });

          const isColumnOver = activeDragColumn === colName;

          return (
            <div
              key={colName}
              className={`${styles.kanbanColumn} ${isColumnOver ? styles.columnDragOver : ""}`}
              onDragOver={(e) => handleDragOver(e, colName)}
              onDrop={(e) => handleDrop(e, colName)}
            >
              <div className={styles.columnHeader} style={{ borderTop: `3px solid ${color}` }}>
                <div className={styles.columnHeaderLeft}>
                  <span className={styles.columnIcon} style={{ color }}>{columnIcon}</span>
                  <h3 className={styles.columnTitle}>{colName}</h3>
                </div>
                <span className={styles.columnCount}>{columnTickets.length}</span>
              </div>

              <div className={styles.cardContainer}>
                {columnTickets.length === 0 ? (
                  <div className={styles.emptyColumn}>
                    <span>{isManagement ? "No tasks here" : "Drop tickets here"}</span>
                  </div>
                ) : (
                  columnTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={`${styles.ticketCard} ${draggedTicketId === ticket.id ? styles.cardIsDragging : ""} ${isManagement ? styles.cardViewOnly : ""}`}
                      draggable={!isManagement}
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleOpenDetail(ticket)}
                    >
                      <div className={styles.cardHeader}>
                        <span className={styles.ticketCode}>{ticket.ticketCode || `#${ticket.id}`}</span>
                        <span
                          className={styles.priorityIndicator}
                          style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                          title={`Priority: ${ticket.priority}`}
                        />
                      </div>
                      <h4 className={styles.cardTitle}>{ticket.title}</h4>
                      <p className={styles.cardDesc}>
                        {ticket.description.replace(/<[^>]*>/g, "").substring(0, 85)}
                        {ticket.description.length > 85 ? "..." : ""}
                      </p>

                      <div className={styles.cardTags}>
                        <Badge variant="outline" className={styles.cardTag}>
                          <Tag size={10} style={{ marginRight: 4 }} />
                          {ticket.category || "Software"}
                        </Badge>
                        <span className={styles.cardDept}>{ticket.submitterDepartment || "IT"}</span>
                      </div>

                      <div className={styles.cardFooter}>
                        <div className={styles.cardUser}>
                          <User size={12} style={{ marginRight: 4, opacity: 0.6 }} />
                          <span>{ticket.submitterName}</span>
                        </div>
                        {ticket.assignedTo && (
                          <div className={styles.assigneeAvatar} title={`Assigned to ${ticket.assignedTo}`}>
                            {ticket.assignedTo.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Developer Ticket Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className={styles.modalWidth}>
          {selectedTicket && (
            <>
              <DialogHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Badge className={styles.detailCodeBadge}>
                    {selectedTicket.ticketCode || `#${selectedTicket.id}`}
                  </Badge>
                  <span
                    className={styles.detailStatusBadge}
                    style={{
                      backgroundColor: `${getStatusColor(selectedTicket.status)}15`,
                      color: getStatusColor(selectedTicket.status),
                      borderColor: `${getStatusColor(selectedTicket.status)}30`
                    }}
                  >
                    {selectedTicket.status.toUpperCase()}
                  </span>
                </div>
                <DialogTitle className={styles.detailTitle}>{selectedTicket.title}</DialogTitle>
              </DialogHeader>

              <div className={styles.detailGrid}>
                {/* Details Column */}
                <div className={styles.detailInfoCol}>
                  <div className={styles.metaBox}>
                    <h5 className={styles.metaTitle}>Ticket Details</h5>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Submitter:</span>
                      <span className={styles.metaVal}>{selectedTicket.submitterName} ({selectedTicket.submitterDepartment})</span>
                    </div>
                    {selectedTicket.submitterEmail && (
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Email:</span>
                        <span className={styles.metaVal}>{selectedTicket.submitterEmail}</span>
                      </div>
                    )}
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Priority:</span>
                      <span className={styles.metaVal} style={{ color: getPriorityColor(selectedTicket.priority), fontWeight: 'bold' }}>
                        {selectedTicket.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Category:</span>
                      <span className={styles.metaVal}>{selectedTicket.category}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Created:</span>
                      <span className={styles.metaVal}>
                        {new Date(selectedTicket.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className={styles.descBox}>
                    <h5 className={styles.metaTitle}>Description</h5>
                    <div
                      className={styles.descContent}
                      dangerouslySetInnerHTML={{ __html: selectedTicket.description }}
                    />
                  </div>

                  <div className={styles.assignBox}>
                    <h5 className={styles.metaTitle}>Assignee</h5>
                    <Select
                      value={selectedTicket.assignedToId?.toString() || "unassigned"}
                      onValueChange={handleAssignChange}
                      disabled={!canEditSelected}
                    >
                      <SelectTrigger style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Tiket yang PERNAH diambil (takenAt) tidak bisa kembali
                            unassigned — opsi disembunyikan permanen */}
                        {!selectedTicket.takenAt && (
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                        )}
                        {agents.map((agent: Agent) => (
                          <SelectItem key={agent.id} value={agent.id.toString()}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!canEditSelected && (
                      <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 6 }}>
                        {isManagement
                          ? "Management role has view-only access"
                          : `Task ini dipegang ${selectedTicket.assignedTo || "staff lain"} — hanya pemilik atau Administrator yang bisa mengubah assignee.`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Developer Notes Column */}
                <div className={styles.detailNotesCol}>
                  <h5 className={styles.metaTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={16} />
                    Internal Developer Comments ({selectedTicket.notes?.filter(n => !isSystemNote(n.content)).length || 0})
                  </h5>

                  <div className={styles.notesList}>
                    {(function() {
                      // Hanya chat/notes developer — system notes (status/oper) tampil di Ticket History detail
                      const staffNotes = (selectedTicket.notes || []).filter(n => !isSystemNote(n.content));
                      if (staffNotes.length === 0) {
                        return (
                          <div className={styles.emptyNotes}>
                            <MessageSquare size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                            <p>No comments added yet</p>
                          </div>
                        );
                      }
                      return staffNotes.map((note) => (
                        <div
                          key={note.id}
                          className={`${styles.noteItem} ${note.isInternal ? styles.internalNote : ''}`}
                        >
                          <div className={styles.noteHeader}>
                            <span className={styles.noteAuthor}>{note.author}</span>
                            <span className={styles.noteTime}>
                              {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={styles.noteBody} dangerouslySetInnerHTML={{ __html: note.content }} />
                          {note.isInternal && (
                            <span className={styles.internalBadge}>Developer Only</span>
                          )}
                        </div>
                      ));
                    })()}
                  </div>

                  {!isManagement ? (
                    <form onSubmit={handleAddNote} className={styles.noteForm}>
                      <Textarea
                        placeholder="Type your comment/notes here..."
                        className={styles.noteTextarea}
                        value={newNoteContent}
                        onChange={(e) => { setNewNoteContent(e.target.value); if (noteError) setNoteError(""); }}
                        required
                        style={noteError ? { borderColor: "#ef4444", boxShadow: "0 0 0 1px rgba(239,68,68,0.4)" } : {}}
                      />
                      <FieldError message={noteError} />
                      <div className={styles.noteFormActions}>
                        <div className={styles.notePrivateCheck}>
                          <input
                            type="checkbox"
                            id="isInternal"
                            checked={isNoteInternal}
                            onChange={(e) => setIsNoteInternal(e.target.checked)}
                            className={styles.checkbox}
                          />
                          <label htmlFor="isInternal" className={styles.checkboxLabel}>
                            Private Note (Dev Only)
                          </label>
                        </div>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isNoteSubmitting}
                          style={{ height: '32px' }}
                        >
                          {isNoteSubmitting ? "Posting..." : "Comment"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Management role has view-only access
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 16 }}>
                {isAdministrator && (
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    style={{ color: 'var(--color-critical-9)', borderColor: 'rgba(239, 68, 68, 0.2)', marginRight: 'auto' }}
                  >
                    Delete Task
                  </Button>
                )}
                {canEditSelected ? (
                  <Button variant="outline" onClick={() => handleOpenEdit(selectedTicket)}>
                    Edit Task
                  </Button>
                ) : (
                  !isManagement && (
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic', alignSelf: 'center' }}>
                      Task ini dipegang {selectedTicket.assignedTo || "staff lain"} — hanya pemilik atau Administrator yang bisa mengedit.
                    </span>
                  )
                )}
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setIsDetailOpen(false);
                    navigate(`/ticket/${selectedTicket.ticketCode || selectedTicket.id}`);
                  }}
                  className={styles.btnLaunchTicket}
                >
                  Full View
                  <ExternalLink size={14} style={{ marginLeft: 6 }} />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create New Dev Task Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className={styles.addTaskModalWidth}>
          <DialogHeader>
            <DialogTitle className={styles.detailTitle}>Create New Dev Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddDevTask} className={styles.addTaskForm}>
            <FieldError message={addTaskErrors.form} />
            <div className={styles.formGroup}>
              <label htmlFor="taskTitle" className={styles.formLabel}>Task Subject / Title *</label>
              <input
                id="taskTitle"
                data-error-field="addTaskTitle"
                type="text"
                required
                placeholder="e.g., Fix authentication logic, Refactor database schema..."
                className={styles.addTaskInput}
                value={addTaskTitle}
                onChange={(e) => {
                  setAddTaskTitle(e.target.value);
                  if (addTaskErrors.addTaskTitle) setAddTaskErrors((p) => ({ ...p, addTaskTitle: "" }));
                }}
                style={fieldErrorStyle(addTaskErrors.addTaskTitle)}
              />
              <FieldError message={addTaskErrors.addTaskTitle} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="taskDesc" className={styles.formLabel}>Task Description *</label>
              <Textarea
                id="taskDesc"
                data-error-field="addTaskDesc"
                required
                placeholder="Please describe the work details..."
                className={styles.addTaskTextarea}
                value={addTaskDesc}
                onChange={(e) => {
                  setAddTaskDesc(e.target.value);
                  if (addTaskErrors.addTaskDesc) setAddTaskErrors((p) => ({ ...p, addTaskDesc: "" }));
                }}
                style={fieldErrorStyle(addTaskErrors.addTaskDesc)}
              />
              <FieldError message={addTaskErrors.addTaskDesc} />
            </div>

            <div className={styles.formGridRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Priority</label>
                <Select value={addTaskPriority} onValueChange={setAddTaskPriority}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
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

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Assignee (Optional)</label>
                <Select value={addTaskAssigneeId} onValueChange={setAddTaskAssigneeId}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((agent: Agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 16 }}>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isTaskSubmitting || !addTaskTitle.trim()} className={styles.btnLaunchTicket}>
                {isTaskSubmitting ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dev Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className={styles.addTaskModalWidth}>
          <DialogHeader>
            <DialogTitle className={styles.detailTitle}>Edit Dev Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditDevTask} className={styles.addTaskForm}>
            <FieldError message={editTaskErrors.form} />
            <div className={styles.formGroup}>
              <label htmlFor="editTaskTitle" className={styles.formLabel}>Task Subject / Title *</label>
              <input
                id="editTaskTitle"
                data-error-field="editTaskTitle"
                type="text"
                required
                placeholder="e.g., Fix authentication logic..."
                className={styles.addTaskInput}
                value={editTaskTitle}
                onChange={(e) => {
                  setEditTaskTitle(e.target.value);
                  if (editTaskErrors.editTaskTitle) setEditTaskErrors((p) => ({ ...p, editTaskTitle: "" }));
                }}
                style={fieldErrorStyle(editTaskErrors.editTaskTitle)}
              />
              <FieldError message={editTaskErrors.editTaskTitle} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="editTaskDesc" className={styles.formLabel}>Task Description *</label>
              <Textarea
                id="editTaskDesc"
                data-error-field="editTaskDesc"
                required
                placeholder="Please describe the work details..."
                className={styles.addTaskTextarea}
                value={editTaskDesc}
                onChange={(e) => {
                  setEditTaskDesc(e.target.value);
                  if (editTaskErrors.editTaskDesc) setEditTaskErrors((p) => ({ ...p, editTaskDesc: "" }));
                }}
                style={fieldErrorStyle(editTaskErrors.editTaskDesc)}
              />
              <FieldError message={editTaskErrors.editTaskDesc} />
            </div>

            <div className={styles.formGridRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Priority</label>
                <Select value={editTaskPriority} onValueChange={setEditTaskPriority}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
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

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Assignee (Optional)</label>
                <Select value={editTaskAssigneeId} onValueChange={setEditTaskAssigneeId}>
                  <SelectTrigger style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((agent: Agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 16 }}>
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={isTaskUpdating} className={styles.btnLaunchTicket}>
                {isTaskUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className={styles.addTaskModalWidth} style={{ maxWidth: 450 }}>
          <DialogHeader>
            <DialogTitle className={styles.detailTitle} style={{ color: 'var(--color-critical-9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} />
                Delete Dev Task
              </div>
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: '16px 0', color: 'var(--color-text-dim)' }}>
            <p style={{ marginBottom: 16 }}>
              Are you sure you want to delete the task <strong>"{selectedTicket?.title}"</strong>?
            </p>
            <p>This action cannot be undone and will permanently remove the task from the dev board.</p>
          </div>
          <DialogFooter style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isTaskDeleting}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteTicket} 
              disabled={isTaskDeleting}
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              {isTaskDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Column Order Dialog (admin only) */}
      {isAdministrator && (
        <Dialog open={isEditColumnsOpen} onOpenChange={setIsEditColumnsOpen}>
        <DialogContent className={styles.addTaskModalWidth}>
          <DialogHeader>
            <DialogTitle className={styles.detailTitle}>Edit Column Order</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-9)", marginTop: 4 }}>
            Gunakan panah untuk mengatur urutan kolom kanban. Urutan tersimpan untuk semua user.
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-9)", marginTop: 4 }}>
            Tarik (drag) baris untuk mengatur urutan kolom kanban — sama seperti memindahkan task. Urutan tersimpan untuk semua user.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
            {columnOrder.map((col, idx) => (
              <div
                key={col.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(idx));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                  if (!isNaN(from) && from !== idx) moveColumn(from, idx);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--surface-2)",
                  border: "var(--hairline)",
                  borderRadius: "var(--radius-card)",
                  cursor: "grab",
                  userSelect: "none"
                }}
              >
                <span style={{ color: "var(--ink-8)", fontSize: "0.9rem" }}>⠿</span>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 700, fontSize: "0.85rem", color: "var(--ink-12)" }}>{col.name}</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.68rem", color: "var(--ink-8)" }}>
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditColumnsOpen(false)} disabled={isSavingOrder}>
              Cancel
            </Button>
            <Button onClick={handleSaveColumnOrder} disabled={isSavingOrder}>
              {isSavingOrder ? "Saving..." : "Save Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      )}

      <ReasonDialog
        open={showReasonDialog}
        onOpenChange={(open) => {
          setShowReasonDialog(open);
          if (!open) {
            setStatusReason("");
            setPendingStatusUpdate(null);
          }
        }}
        reason={statusReason}
        onReasonChange={setStatusReason}
        onSubmit={handleSubmitReason}
        targetStatus={pendingStatusUpdate?.targetStatus || ""}
      />

      <TransferDialog
        open={showTransferDialog}
        onOpenChange={(open) => {
          setShowTransferDialog(open);
          if (!open) { setPendingTransfer(null); setTransferReason(""); }
        }}
        reason={transferReason}
        onReasonChange={setTransferReason}
        onSubmit={handleSubmitTransfer}
        fromName={selectedTicket?.assignedTo || "staff lain"}
        toName={pendingTransfer?.toName || "staff lain"}
        ticketCode={selectedTicket?.ticketCode}
      />

      <PriorityChangeDialog
        open={showPriorityDialog}
        onOpenChange={(open) => {
          setShowPriorityDialog(open);
          if (!open) setPriorityReason("");
        }}
        reason={priorityReason}
        onReasonChange={setPriorityReason}
        onSubmit={handleSubmitPriorityReason}
        changeLabel={`Prioritas: ${selectedTicket?.priority || ""} → ${editTaskPriority}`}
        ticketCode={selectedTicket?.ticketCode}
      />

      <ResolveDialog
        open={showResolveDialog}
        onOpenChange={(open) => {
          setShowResolveDialog(open);
          if (!open) {
            setResolutionSummary("");
            setResolutionImage(null);
            setPendingStatusUpdate(null);
            setResolutionError("");
            setResolveCategory("");
            setResolveCategoryError("");
          }
        }}
        categories={categories}
        resolveCategory={resolveCategory}
        onResolveCategoryChange={setResolveCategory}
        resolveCategoryError={resolveCategoryError}
        resolveDate={resolveDate}
        onResolveDateChange={setResolveDate}
        resolutionSummary={resolutionSummary}
        onSummaryChange={setResolutionSummary}
        resolutionError={resolutionError}
        resolutionImage={resolutionImage}
        onResolutionImageChange={setResolutionImage}
        onSubmit={handleSubmitResolution}
      />
    </div>
  );
}
