import React, { useState, useEffect, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  Search,
  MessageSquare,
  AlertTriangle,
  Calendar,
  Layers,
  ClipboardList,
  Flame,
  CalendarClock,
  ExternalLink
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Card, CardContent } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { Textarea } from "~/components/ui/textarea/textarea";
import { Input } from "~/components/ui/input/input";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import {
  getTickets,
  getTicketById,
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
import { requireAuth } from "~/services/session.service";
import { ReasonDialog } from "~/routes/ticket.$id/components/ReasonDialog";
import { ResolveDialog } from "~/routes/ticket.$id/components/ResolveDialog";
import {
  isWorkingDay,
  validateWorkingHoursDateTime,
  getInitialWorkingDateTime,
} from "~/utils/date";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Fetch tickets, agents, statuses, categories, priorities, holidays (semua master-driven)
  const [ticketsRes, agents, statusesRes, categoriesRes, prioritiesRes, holidaysRes] = await Promise.all([
    getTickets({ per_page: 500 }),
    getAgents(),
    settingsApi.getStatuses(),
    settingsApi.getCategories(),
    settingsApi.getPriorities(),
    settingsApi.getHolidays(),
  ]);

  return Response.json({
    session,
    initialTickets: ticketsRes.tickets,
    agents,
    statuses: (statusesRes.data?.data || []).filter((s: any) => s.showOnItHelpdesk !== false),
    categories: categoriesRes.data?.data || [],
    priorities: (prioritiesRes.data?.data || []).filter((p: any) => p.isActive !== false),
    holidays: holidaysRes.data?.data || [],
  });
}

export default function TicketCalendar() {
  const { session, initialTickets, agents, statuses, categories, priorities, holidays } = useLoaderData() as typeof loader extends (...args: any[]) => Promise<infer T> ? T : any;
  const navigate = useNavigate();

  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters state (strictly for IT Helpdesk - no team workspace dropdown)
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateField, setDateField] = useState<"deadline" | "created">("deadline"); // "deadline" (SLA Target) or "created" (Created Date)

  // Current calendar month view state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Ticket Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isNoteInternal, setIsNoteInternal] = useState(true);
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

  // Reason / Resolve dialog state (sinkron dengan settings requiresReason)
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ ticketId: string; targetStatus: string } | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionError, setResolutionError] = useState("");
  const [resolveDate, setResolveDate] = useState(() => getInitialWorkingDateTime(new Date(), holidays));
  const [resolutionImage, setResolutionImage] = useState<File | null>(null);
  const [resolveCategory, setResolveCategory] = useState("");
  const [resolveCategoryError, setResolveCategoryError] = useState("");

  // Add Dev Task Modal State (Quick task creation)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskDesc, setAddTaskDesc] = useState("");
  const [addTaskPriority, setAddTaskPriority] = useState("medium");
  const [addTaskCategory, setAddTaskCategory] = useState("Development");
  const [addTaskAssigneeId, setAddTaskAssigneeId] = useState("unassigned");
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);

  // Priority quick-add mengikuti master aktif ("medium" bila ada, else opsi aktif pertama)
  const resolvedAddPriority = useMemo(() => {
    const list = (priorities as any[]) || [];
    if (list.some((p: any) => String(p.name).toLowerCase() === addTaskPriority.toLowerCase())) return addTaskPriority;
    return list[0] ? String(list[0].name).toLowerCase() : "medium";
  }, [priorities, addTaskPriority]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build grid of 42 cells (6 rows * 7 columns) for the calendar
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month days to fill 42 cells
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Search text filter
      const matchesSearch = searchQuery.trim() === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.ticketCode && t.ticketCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.submitterName.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;

      // Priority filter
      const matchesPriority = selectedPriority === "all" || t.priority.toLowerCase() === selectedPriority.toLowerCase();

      // Status filter
      const matchesStatus = selectedStatus === "all" || t.status.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
    });
  }, [tickets, searchQuery, selectedCategory, selectedPriority, selectedStatus]);

  // Map tickets to calendar days and sort chronologically by deadline/created time
  const ticketsByDay = useMemo(() => {
    const map: Record<string, Ticket[]> = {};

    filteredTickets.forEach((ticket) => {
      // Di mode deadline: gunakan slaDeadline.
      // Tiket IT tanpa deadline tidak boleh ditampilkan di kalender target deadline.
      // Di mode created: gunakan createdAt.
      const dateToCompare = dateField === "deadline" ? ticket.slaDeadline : ticket.createdAt;
      if (!dateToCompare) return;

      const dateObj = new Date(dateToCompare);
      if (isNaN(dateObj.getTime())) return;

      // Aturan bisnis: Jika melihat SLA Target Deadline, tanggal akhir pekan (Sabtu/Minggu)
      // dan hari libur nasional harus kosong untuk tiket IT (tidak boleh ada deadline IT di hari libur).
      if (dateField === "deadline") {
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return;
        }
        if (!isWorkingDay(dateObj, holidays)) {
          return;
        }
      }

      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;

      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(ticket);
    });

    // Urutkan tiket di tiap tanggal secara kronologis berdasarkan jam deadline
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const timeA = new Date(dateField === "deadline" ? a.slaDeadline! : a.createdAt).getTime();
        const timeB = new Date(dateField === "deadline" ? b.slaDeadline! : b.createdAt).getTime();
        return timeA - timeB;
      });
    });

    return map;
  }, [filteredTickets, dateField, holidays]);

  // Ringkasan beban kerja bulanan untuk visualisasi metrik SLA
  const monthSummary = useMemo(() => {
    const inMonth = filteredTickets.filter((t) => {
      const d = dateField === "deadline" ? t.slaDeadline : t.createdAt;
      if (!d) return false;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return false;
      if (dateField === "deadline") {
        const dayOfWeek = dt.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return false;
        if (!isWorkingDay(dt, holidays)) return false;
      }
      return dt.getFullYear() === year && dt.getMonth() === month;
    });

    const total = inMonth.length;
    const now = Date.now();
    const overdue = inMonth.filter((t) => {
      const isDone = ["resolved", "closed", "completed"].includes((t.status || "").toLowerCase());
      if (isDone) return false;
      return t.slaDeadline && new Date(t.slaDeadline).getTime() < now;
    }).length;

    const dueSoon = inMonth.filter((t) => {
      const isDone = ["resolved", "closed", "completed"].includes((t.status || "").toLowerCase());
      if (isDone || !t.slaDeadline) return false;
      const diff = new Date(t.slaDeadline).getTime() - now;
      return diff > 0 && diff <= 24 * 60 * 60 * 1000;
    }).length;

    const completed = inMonth.filter((t) =>
      ["resolved", "closed", "completed"].includes((t.status || "").toLowerCase())
    ).length;

    // Hitung hari dengan beban penanganan tiket terpadat
    const dayCounts: Record<number, number> = {};
    inMonth.forEach((t) => {
      const d = dateField === "deadline" ? t.slaDeadline : t.createdAt;
      if (!d) return;
      const dayNum = new Date(d).getDate();
      dayCounts[dayNum] = (dayCounts[dayNum] || 0) + 1;
    });

    let peakDayNum: number | null = null;
    let peakCount = 0;
    Object.entries(dayCounts).forEach(([dayStr, c]) => {
      if (c > peakCount) {
        peakCount = c;
        peakDayNum = parseInt(dayStr, 10);
      }
    });

    return {
      total,
      overdue,
      dueSoon,
      completed,
      peakDayNum,
      peakCount,
    };
  }, [filteredTickets, dateField, year, month, holidays]);

  // Helper to check if a day is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Helper to color priorities — warna diambil dari master, fallback ke peta lama
  const getPriorityColor = (priority: string) => {
    const p = (priority || "").toLowerCase();
    const master = (priorities as any[]).find((m: any) => String(m.name).toLowerCase() === p);
    if (master?.color) return master.color;
    if (p === "critical" || p === "urgent") return "#EF4444";
    if (p === "high") return "#F59E0B";
    if (p === "medium") return "#3B82F6";
    return "#10B981";
  };

  // Helper to color statuses
  const getStatusColor = (statusName: string) => {
    const status = statuses.find((s: any) => s.name.toLowerCase() === statusName.toLowerCase());
    return status?.color || "#6B7280";
  };

  // Handle open ticket details
  const handleOpenDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    setNewNoteContent("");
    try {
      const detailed = await getTicketById(ticket.id.toString());
      if (detailed) {
        setSelectedTicket(detailed);
        setTickets((prev) => prev.map((t) => (t.id === detailed.id ? detailed : t)));
      }
    } catch {
      // fallback to list data
    }
  };

  const handleUpdateStatusDirect = async (ticketId: string, targetStatus: string, reason?: string) => {
    try {
      let updated: Ticket | null = null;
      if (reason) {
        updated = await updateTicket(ticketId, { status: targetStatus, reason } as any);
        if (!updated) updated = await updateTicketStatus(ticketId, targetStatus);
      } else {
        updated = await updateTicketStatus(ticketId, targetStatus);
      }
      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id.toString() === ticketId ? updated! : t)));
        if (selectedTicket && selectedTicket.id.toString() === ticketId) setSelectedTicket(updated);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleResolveDirect = async (ticketId: string, summary: string, dateStr: string, image: File | null) => {
    try {
      const updated = await updateTicketStatus(ticketId, "Resolved", summary, new Date(dateStr).toISOString(), image || undefined);
      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id.toString() === ticketId ? updated : t)));
        if (selectedTicket && selectedTicket.id.toString() === ticketId) setSelectedTicket(updated);
      }
    } catch (err) {
      console.error("Failed to resolve:", err);
    }
  };

  // Handle change assignee inside detail modal
  const handleAssignChange = async (agentIdStr: string) => {
    if (!selectedTicket) return;
    const agentId = agentIdStr === "unassigned" ? null : agentIdStr;
    try {
      const updated = await assignTicket(selectedTicket.id.toString(), agentId);
      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
        setSelectedTicket(updated);
      }
    } catch (err) {
      console.error("Failed to assign ticket:", err);
    }
  };

  // Handle status change inside detail modal — sync with settings requiresReason
  const handleStatusChange = async (statusName: string) => {
    if (!selectedTicket) return;
    const targetStatus = statusName;
    const ticketId = selectedTicket.id.toString();

    const isResolvingWithoutSummary =
      (targetStatus.toLowerCase() === "resolved" || targetStatus.toLowerCase() === "closed") &&
      !selectedTicket.resolutionSummary;

    if (isResolvingWithoutSummary) {
      setPendingStatusUpdate({ ticketId, targetStatus });
      setResolveDate(getInitialWorkingDateTime(new Date(), holidays));
      setShowResolveDialog(true);
      return;
    }

    const targetMaster = statuses.find((s: any) => s.name.toLowerCase() === targetStatus.toLowerCase());
    if (targetMaster?.requiresReason) {
      setPendingStatusUpdate({ ticketId, targetStatus });
      setStatusReason("");
      setShowReasonDialog(true);
      return;
    }

    await handleUpdateStatusDirect(ticketId, targetStatus);
  };

  const handleSubmitResolution = async () => {
    if (!pendingStatusUpdate) return;
    setResolutionError("");
    setResolveCategoryError("");

    if (!resolveDate) {
      setResolutionError("Waktu penyelesaian wajib diisi.");
      return;
    }
    const val = validateWorkingHoursDateTime(resolveDate, holidays);
    if (!val.valid) {
      setResolutionError(val.error || "Waktu penyelesaian di luar jam kerja operasional.");
      return;
    }

    if (!resolutionSummary || !resolutionSummary.trim()) {
      setResolutionError("Ringkasan solusi penanganan wajib diisi.");
      return;
    }

    await handleResolveDirect(
      pendingStatusUpdate.ticketId,
      resolutionSummary,
      resolveDate,
      resolutionImage
    );
    setShowResolveDialog(false);
    setPendingStatusUpdate(null);
    setResolutionSummary("");
    setResolutionImage(null);
  };

  // Handle add note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteContent.trim()) return;

    setIsNoteSubmitting(true);
    try {
      const note = await addTicketNote(selectedTicket.id.toString(), newNoteContent, isNoteInternal);
      if (note) {
        const updatedTicket: Ticket = {
          ...selectedTicket,
          notes: [...(selectedTicket.notes || []), note]
        };
        setSelectedTicket(updatedTicket);
        setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
        setNewNoteContent("");
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  // Handle Quick Add Task
  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTaskTitle.trim() || !addTaskDesc.trim()) return;

    setIsTaskSubmitting(true);
    try {
      const newTicket = await createTicket({
        title: addTaskTitle,
        description: addTaskDesc,
        priority: addTaskPriority,
        category: addTaskCategory,
        submitterName: session?.name || "IT Staff",
        submitterEmail: session?.email || "staff@internal.corp",
        assignedToId: addTaskAssigneeId === "unassigned" ? undefined : addTaskAssigneeId,
      });

      if (newTicket) {
        setTickets((prev) => [newTicket, ...prev]);
        setIsAddDialogOpen(false);
        setAddTaskTitle("");
        setAddTaskDesc("");
        setAddTaskPriority("medium");
        setAddTaskCategory("Development");
        setAddTaskAssigneeId("unassigned");
      }
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setIsTaskSubmitting(false);
    }
  };

  // Date formatting helpers
  const formatDate = (date: Date | undefined) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(date));
  };

  return (
    <div className={styles.container}>
      {/* Banner / Title Header */}
      <div className={styles.banner}>
        <div>
          <h2 className={styles.bannerTitle}>
            <CalendarClock size={22} className={styles.bannerIcon} />
            Kalender Jadwal SLA IT Helpdesk
          </h2>
          <p className={styles.bannerSubtitle}>
            Pantau jadwal SLA penanganan tiket IT helpdesk secara visual berdasarkan Target Deadline dan Tanggal Dibuat
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          <Plus size={16} />
          Create Task
        </Button>
      </div>

      {/* Monthly Workload & SLA Summary Bar */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIconBox} style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" }}>
            <CalendarClock size={22} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>
              {dateField === "deadline" ? "Target SLA Bulan Ini" : "Tiket Dibuat Bulan Ini"}
            </span>
            <span className={styles.summaryValue}>{monthSummary.total}</span>
            <span className={styles.summarySubtext}>
              {monthNames[month]} {year} • IT Helpdesk
            </span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIconBox} style={{ background: monthSummary.peakCount >= 5 ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)", color: monthSummary.peakCount >= 5 ? "#f87171" : "#fbbf24" }}>
            <Flame size={22} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Hari Paling Padat</span>
            <span className={styles.summaryValue}>
              {monthSummary.peakCount > 0 ? `Tgl ${monthSummary.peakDayNum}` : "-"}
            </span>
            <span className={styles.summarySubtext}>
              {monthSummary.peakCount > 0
                ? `${monthSummary.peakCount} tiket (${monthSummary.peakCount >= 5 ? "🔥 Padat" : monthSummary.peakCount >= 3 ? "⚡ Sedang" : "🌱 Longgar"})`
                : "Tidak ada jadwal tiket"}
            </span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIconBox} style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b" }}>
            <Clock size={22} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Mendekati Deadline (&lt; 24j)</span>
            <span className={styles.summaryValue}>{monthSummary.dueSoon}</span>
            <span className={styles.summarySubtext}>Perlu diprioritaskan penyelesaiannya</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryIconBox} style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
            <AlertTriangle size={22} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Lewat Deadline (SLA Overdue)</span>
            <span className={styles.summaryValue} style={{ color: monthSummary.overdue > 0 ? "#f87171" : "#ffffff" }}>
              {monthSummary.overdue}
            </span>
            <span className={styles.summarySubtext}>
              {monthSummary.overdue > 0 ? "⚠️ Melebihi batas SLA resolusi" : "Semua SLA terkendali"}
            </span>
          </div>
        </div>
      </div>

      {/* Workload / Density Legend Bar */}
      <div className={styles.legendBar}>
        <div className={styles.legendItems}>
          <span className={styles.legendLabel}>
            <Layers size={14} />
            Indikator Beban Kerja Harian:
          </span>
          <span className={`${styles.legendPill} ${styles.legendPillLonggar}`}>
            🌱 Longgar (1-2 tiket)
          </span>
          <span className={`${styles.legendPill} ${styles.legendPillSedang}`}>
            ⚡ Sedang (3-4 tiket)
          </span>
          <span className={`${styles.legendPill} ${styles.legendPillPadat}`}>
            🔥 Padat (≥5 tiket)
          </span>
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 4 }}>
          <span>Mode: <strong>{dateField === "deadline" ? "Berdasarkan Target Waktu SLA" : "Berdasarkan Waktu Tiket Dibuat"}</strong></span>
        </div>
      </div>

      <div className={styles.contentArea}>
        {/* Controls / Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filtersGroup}>
            {/* Search Input */}
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={15} />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* 3 Dropdown Filters (Category, Priority, Status) */}
            <div className={styles.filterDropdownsRow}>
              {/* Category Select */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className={styles.selectTriggerCompact}>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent style={{ background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority Select */}
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className={styles.selectTriggerCompact}>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent style={{ background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {(priorities as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Select */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className={styles.selectTriggerCompact}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent style={{ background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((s: any) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle between SLA deadline and Created date */}
            <div className={styles.dateFieldToggle}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${dateField === "deadline" ? styles.toggleBtnActive : ""}`}
                onClick={() => setDateField("deadline")}
                title="Tampilkan berdasarkan Target Waktu SLA"
              >
                🎯 Target Deadline
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${dateField === "created" ? styles.toggleBtnActive : ""}`}
                onClick={() => setDateField("created")}
                title="Tampilkan berdasarkan tanggal pembuatan tiket"
              >
                📅 Tanggal Dibuat
              </button>
            </div>
          </div>

          {/* Calendar Month Navigation */}
          <div className={styles.calendarNav}>
            <button onClick={handlePrevMonth} className={styles.navBtn} title="Previous Month">
              <ChevronLeft size={16} />
            </button>
            <span className={styles.currentMonthText}>
              {monthNames[month]} {year}
            </span>
            <button onClick={handleNextMonth} className={styles.navBtn} title="Next Month">
              <ChevronRight size={16} />
            </button>
            <button onClick={handleToday} className={styles.todayBtn} title="Hari ini">
              Today
            </button>
          </div>
        </div>

        {/* Calendar Grid wrapper */}
        <div className={styles.calendarWrapper}>
          <div className={styles.daysHeader}>
            <div className={styles.dayName}>Sun</div>
            <div className={styles.dayName}>Mon</div>
            <div className={styles.dayName}>Tue</div>
            <div className={styles.dayName}>Wed</div>
            <div className={styles.dayName}>Thu</div>
            <div className={styles.dayName}>Fri</div>
            <div className={styles.dayName}>Sat</div>
          </div>

          <div className={styles.daysGrid}>
            {calendarDays.map((day, idx) => {
              const dayKey = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`;
              const dayTickets = ticketsByDay[dayKey] || [];
              const isCurr = day.isCurrentMonth;
              const isTodayCell = isToday(day.date);
              const count = dayTickets.length;
              const isNonWorking = !isWorkingDay(day.date, holidays);

              const densityClass =
                count >= 5
                  ? styles.dayCellPadat
                  : count >= 3
                  ? styles.dayCellSedang
                  : count >= 1
                  ? styles.dayCellLonggar
                  : "";

              return (
                <div
                  key={idx}
                  className={`${styles.dayCell} ${!isCurr ? styles.dayCellOutside : ""} ${isTodayCell ? styles.dayCellToday : ""} ${densityClass}`}
                >
                  <div className={styles.cellHeader}>
                    <span className={styles.dayNumber}>{day.date.getDate()}</span>
                    {dateField === "deadline" && isNonWorking && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          fontWeight: 500,
                        }}
                      >
                        Libur
                      </span>
                    )}
                    {count >= 5 ? (
                      <span className={styles.densityBadgePadat} title="Beban Padat: ≥5 tiket">
                        🔥 Padat ({count})
                      </span>
                    ) : count >= 3 ? (
                      <span className={styles.densityBadgeSedang} title="Beban Sedang: 3-4 tiket">
                        ⚡ Sedang ({count})
                      </span>
                    ) : count >= 1 ? (
                      <span className={styles.densityBadgeLonggar} title="Beban Longgar: 1-2 tiket">
                        🌱 {count} Tiket
                      </span>
                    ) : null}
                  </div>

                  <div className={styles.cellTickets}>
                    {dayTickets.map((t) => {
                      const isDone = ["resolved", "closed", "completed"].includes((t.status || "").toLowerCase());
                      const isOverdue = t.slaDeadline && new Date(t.slaDeadline).getTime() < Date.now() && !isDone;
                      const isDueToday = t.slaDeadline && isToday(new Date(t.slaDeadline)) && !isDone;

                      const targetDateStr = dateField === "deadline" ? t.slaDeadline : t.createdAt;
                      const timeStr = targetDateStr
                        ? new Date(targetDateStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                        : null;

                      return (
                        <div
                          key={t.id}
                          className={styles.ticketItem}
                          style={{ borderLeftColor: getPriorityColor(t.priority) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(t);
                          }}
                          title={`${t.ticketCode || t.id}: ${t.title} (${t.status})`}
                        >
                          <div className={styles.ticketCardHeader}>
                            {timeStr ? (
                              <span className={styles.ticketTime}>
                                <Clock size={10} />
                                {timeStr}
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.45)" }}>
                                {t.ticketCode || `#${t.id}`}
                              </span>
                            )}

                            {isDone ? (
                              <span className={styles.badgeDone}>✓ Selesai</span>
                            ) : isOverdue ? (
                              <span className={styles.badgeOverdue}>⚠️ Overdue</span>
                            ) : isDueToday ? (
                              <span className={styles.badgeDueToday}>🎯 Hari Ini</span>
                            ) : null}
                          </div>

                          <span className={styles.ticketTitleText}>
                            {t.ticketCode ? `[${t.ticketCode}] ` : ""}{t.title}
                          </span>

                          <div className={styles.ticketFooter}>
                            <span className={styles.ticketAssignee}>
                              <User size={10} />
                              {t.assignedTo || "Unassigned"}
                            </span>
                            <span style={{ opacity: 0.6 }}>{t.category}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ticket Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className={styles.modalContent}>
          {selectedTicket && (
            <>
              <DialogHeader className={styles.modalHeader}>
                <div className={styles.modalHeaderMeta}>
                  <span className={styles.modalTicketCode}>
                    {selectedTicket.ticketCode || `Ticket #${selectedTicket.id}`}
                  </span>
                  <Badge style={{ backgroundColor: getStatusColor(selectedTicket.status), color: "#fff", border: "none", padding: "3px 10px", fontSize: "0.75rem", borderRadius: 6 }}>
                    {selectedTicket.status}
                  </Badge>
                  <Badge style={{ backgroundColor: getPriorityColor(selectedTicket.priority), color: "#fff", border: "none", padding: "3px 10px", fontSize: "0.75rem", borderRadius: 6, textTransform: "capitalize" }}>
                    {selectedTicket.priority} Priority
                  </Badge>
                  <span className={styles.modalDivider}>•</span>
                  <span className={styles.modalCategory}>{selectedTicket.category}</span>
                </div>
                <DialogTitle className={styles.modalTitle}>
                  {selectedTicket.title}
                </DialogTitle>
              </DialogHeader>

              <div className={styles.modalGrid}>
                {/* Left Side: Description & Notes */}
                <div className={styles.modalLeft}>
                  <div className={styles.modalSection}>
                    <h4 className={styles.sectionTitle}>Description</h4>
                    <div className={styles.ticketDescBox}>
                      {selectedTicket.description || <span style={{ opacity: 0.5, fontStyle: "italic" }}>No description provided.</span>}
                    </div>
                  </div>

                  {/* Notes & Activity List */}
                  <div className={styles.notesSection}>
                    <h4 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MessageSquare size={13} />
                      Activity & Notes ({selectedTicket.notes?.length || 0})
                    </h4>

                    <div className={styles.notesList}>
                      {selectedTicket.notes && selectedTicket.notes.length > 0 ? (
                        selectedTicket.notes.map((note) => (
                          <div
                            key={note.id}
                            className={`${styles.noteItem} ${note.isInternal ? styles.noteInternal : ""}`}
                          >
                            <div className={styles.noteHeader}>
                              <span className={styles.noteAuthor}>{note.author || (note as any).authorName || "Staff"}</span>
                              <span className={styles.noteDate}>{formatDate(note.createdAt ? new Date(note.createdAt) : undefined)}</span>
                            </div>
                            <div
                              className={styles.noteContent}
                              dangerouslySetInnerHTML={{ __html: note.content }}
                            />
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic py-2">No notes or activities yet.</p>
                      )}
                    </div>

                    {/* Add Quick Note Form */}
                    <form onSubmit={handleAddNote} className={styles.noteForm}>
                      <Input
                        placeholder="Add a quick note or update..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className={styles.noteInput}
                      />
                      <div className={styles.noteOptions}>
                        <label className={styles.internalCheckboxLabel}>
                          <input
                            type="checkbox"
                            checked={isNoteInternal}
                            onChange={(e) => setIsNoteInternal(e.target.checked)}
                          />
                          <span>Internal note (staff only)</span>
                        </label>
                        <Button
                          type="submit"
                          disabled={isNoteSubmitting || !newNoteContent.trim()}
                          size="sm"
                          className={styles.postNoteBtn}
                        >
                          Post Note
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Right Side: Meta Details & Actions */}
                <div className={styles.modalRight}>
                  <div className={styles.infoRow}>
                    <span className={styles.sectionTitle}>Status</span>
                    <select
                      className={styles.prioritySelect}
                      value={selectedTicket.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      {statuses.map((s: any) => (
                        <option key={s.id} value={s.name} className={styles.selectOption}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.sectionTitle}>Assignee</span>
                    <select
                      className={styles.prioritySelect}
                      value={selectedTicket.assignedToId ? selectedTicket.assignedToId.toString() : "unassigned"}
                      onChange={(e) => handleAssignChange(e.target.value)}
                    >
                      <option value="unassigned" className={styles.selectOption}>Unassigned</option>
                      {agents.map((agent: Agent) => (
                        <option key={agent.id} value={agent.id.toString()} className={styles.selectOption}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.sectionTitle}>Priority</span>
                    <span className={styles.infoVal} style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {selectedTicket.priority}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.sectionTitle}>Submitter</span>
                    <span className={styles.infoVal}>{selectedTicket.submitterName}</span>
                    {selectedTicket.submitterEmail && (
                      <span className={styles.infoSubVal}>{selectedTicket.submitterEmail}</span>
                    )}
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.sectionTitle}>Target SLA Deadline</span>
                    <span className={styles.infoVal} style={{ color: selectedTicket.slaDeadline ? "#60a5fa" : undefined }}>
                      {selectedTicket.slaDeadline ? formatDate(new Date(selectedTicket.slaDeadline)) : "-"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.sectionTitle}>Created At</span>
                    <span className={styles.infoVal}>
                      {formatDate(new Date(selectedTicket.createdAt))}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/ticket/${selectedTicket.ticketCode || selectedTicket.id}`)}
                    className={styles.openTicketBtn}
                  >
                    <span>Open Full Ticket View</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reason Dialog for Status Updates that require reason */}
      <ReasonDialog
        open={showReasonDialog}
        onOpenChange={(open) => {
          setShowReasonDialog(open);
          if (!open) setPendingStatusUpdate(null);
        }}
        targetStatus={pendingStatusUpdate?.targetStatus || ""}
        reason={statusReason}
        onReasonChange={setStatusReason}
        onSubmit={async () => {
          if (!pendingStatusUpdate || !statusReason.trim()) return;
          await handleUpdateStatusDirect(pendingStatusUpdate.ticketId, pendingStatusUpdate.targetStatus, statusReason);
          setShowReasonDialog(false);
          setPendingStatusUpdate(null);
          setStatusReason("");
        }}
      />

      {/* Resolve Dialog for Resolution Summary & Business Hours Validation */}
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
        categories={[]}
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
        holidays={holidays}
        onSubmit={handleSubmitResolution}
      />

      {/* Add Dev Task Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900 text-white border border-slate-700 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Plus size={18} />
              Create Task / Ticket
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleQuickAddTask} style={{ marginTop: 12 }}>
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Title</span>
              <Input
                placeholder="What needs to be done?"
                value={addTaskTitle}
                onChange={(e) => setAddTaskTitle(e.target.value)}
                required
                className="bg-slate-950 text-white border-slate-800 rounded-lg text-sm"
              />
            </div>

            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Description</span>
              <Textarea
                placeholder="Details of the ticket..."
                value={addTaskDesc}
                onChange={(e) => setAddTaskDesc(e.target.value)}
                required
                className="bg-slate-950 text-white border-slate-800 rounded-lg text-sm min-h-24"
              />
            </div>

            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Category</span>
              <select
                className={styles.prioritySelect}
                value={addTaskCategory}
                onChange={(e) => setAddTaskCategory(e.target.value)}
              >
                {categories.map((c: any) => (
                  <option key={c.id} value={c.name} className={styles.selectOption}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Priority</span>
                <select
                  className={styles.prioritySelect}
                  value={resolvedAddPriority}
                  onChange={(e) => setAddTaskPriority(e.target.value)}
                >
                  {(priorities as any[]).map((p: any) => (
                    <option key={p.id} value={p.name.toLowerCase()} className={styles.selectOption}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Assignee</span>
                <select
                  className={styles.prioritySelect}
                  value={addTaskAssigneeId}
                  onChange={(e) => setAddTaskAssigneeId(e.target.value)}
                >
                  <option value="unassigned" className={styles.selectOption}>Unassigned</option>
                  {agents.map((agent: Agent) => (
                    <option key={agent.id} value={agent.id.toString()} className={styles.selectOption}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => setIsAddDialogOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isTaskSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                {isTaskSubmitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
