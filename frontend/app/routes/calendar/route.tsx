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
  Sparkles,
  ClipboardList
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
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Fetch tickets, agents, and statuses
  const [ticketsRes, agents, statusesRes, categoriesRes] = await Promise.all([
    getTickets({ per_page: 250 }),
    getAgents(),
    settingsApi.getStatuses(),
    settingsApi.getCategories()
  ]);

  return {
    session,
    initialTickets: ticketsRes.tickets,
    agents,
    statuses: statusesRes.data?.data || [],
    categories: categoriesRes.data?.data || []
  };
}

export default function TicketCalendar() {
  const { session, initialTickets, agents, statuses, categories } = useLoaderData() as typeof loader extends (...args: any[]) => Promise<infer T> ? T : any;
  const navigate = useNavigate();

  // Tickets state
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateField, setDateField] = useState<"deadline" | "created">("deadline"); // "deadline" (SLA) or "created" (Created Date)

  // Current calendar month view state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Ticket Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isNoteInternal, setIsNoteInternal] = useState(true);
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

  // Add Dev Task Modal State (Quick task creation)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskDesc, setAddTaskDesc] = useState("");
  const [addTaskPriority, setAddTaskPriority] = useState("medium");
  const [addTaskCategory, setAddTaskCategory] = useState("Development");
  const [addTaskAssigneeId, setAddTaskAssigneeId] = useState("unassigned");
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);

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

  // Map tickets to calendar days
  const ticketsByDay = useMemo(() => {
    const map: Record<string, Ticket[]> = {};

    filteredTickets.forEach((ticket) => {
      const dateToCompare = dateField === "deadline" ? ticket.slaDeadline : ticket.createdAt;
      if (!dateToCompare) return;

      const dateObj = new Date(dateToCompare);
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;

      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(ticket);
    });

    return map;
  }, [filteredTickets, dateField]);

  // Helper to check if a day is today
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Helper to color priorities
  const getPriorityColor = (priority: string) => {
    const p = priority.toLowerCase();
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
  const handleOpenDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    setNewNoteContent("");
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

  // Handle status change inside detail modal
  const handleStatusChange = async (statusName: string) => {
    if (!selectedTicket) return;
    try {
      const updated = await updateTicketStatus(selectedTicket.id.toString(), statusName);
      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
        setSelectedTicket(updated);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Handle adding notes
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteContent.trim() || isNoteSubmitting) return;

    setIsNoteSubmitting(true);
    try {
      const newNote = await addTicketNote(selectedTicket.id.toString(), newNoteContent, isNoteInternal);
      if (newNote) {
        // Refresh ticket list
        const updatedRes = await getTickets({ per_page: 250 });
        setTickets(updatedRes.tickets);

        const updatedSelected = updatedRes.tickets.find((t) => t.id === selectedTicket.id);
        if (updatedSelected) {
          setSelectedTicket(updatedSelected);
        }
        setNewNoteContent("");
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  // Quick create task from calendar
  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTaskTitle.trim() || !addTaskDesc.trim() || isTaskSubmitting) return;

    setIsTaskSubmitting(true);
    try {
      const newTicket = await createTicket({
        title: addTaskTitle,
        description: addTaskDesc,
        category: addTaskCategory,
        priority: addTaskPriority,
        submitterName: session.userName,
        submitterEmail: session.userEmail || "dev@company.com",
        submitterPhone: "",
        submitterDepartment: "Development"
      });

      if (newTicket) {
        if (addTaskAssigneeId !== "unassigned") {
          await assignTicket(newTicket.id.toString(), addTaskAssigneeId);
        }

        // Refresh
        const updatedRes = await getTickets({ per_page: 250 });
        setTickets(updatedRes.tickets);

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
            <Calendar size={22} className={styles.bannerIcon} />
            IT Tickets Calendar
          </h2>
          <p className={styles.bannerSubtitle}>
            Browse, manage, and schedule helpdesk tickets and development tasks on a calendar view
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          <Plus size={16} />
          Create Task
        </Button>
      </div>

      <div className={styles.contentArea}>
        {/* Controls / Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filtersGroup}>
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: 200 }}>
              <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} size={14} />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 30, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", height: 36, borderRadius: 8 }}
              />
            </div>

            {/* Category Select */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger style={{ width: 140, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", height: 36, color: "#fff" }}>
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
              <SelectTrigger style={{ width: 130, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", height: 36, color: "#fff" }}>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent style={{ background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent/Critical</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Select */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger style={{ width: 130, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", height: 36, color: "#fff" }}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent style={{ background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((s: any) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle between SLA deadline and Created date */}
            <div className={styles.dateFieldToggle}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${dateField === "deadline" ? styles.toggleBtnActive : ""}`}
                onClick={() => setDateField("deadline")}
              >
                SLA Deadline
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${dateField === "created" ? styles.toggleBtnActive : ""}`}
                onClick={() => setDateField("created")}
              >
                Created Date
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
            <button onClick={handleToday} className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-md border border-slate-700 transition" style={{ marginLeft: 6 }}>
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

              return (
                <div
                  key={idx}
                  className={`${styles.dayCell} ${!isCurr ? styles.dayCellOutside : ""} ${isTodayCell ? styles.dayCellToday : ""}`}
                >
                  <div className={styles.cellHeader}>
                    <span className={styles.dayNumber}>{day.date.getDate()}</span>
                    {dayTickets.length > 0 && (
                      <span className={styles.ticketCountBadge}>
                        {dayTickets.length}
                      </span>
                    )}
                  </div>

                  <div className={styles.cellTickets}>
                    {dayTickets.map((t) => (
                      <div
                        key={t.id}
                        className={styles.ticketItem}
                        style={{ borderLeftColor: getPriorityColor(t.priority) }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(t);
                        }}
                        title={`${t.ticketCode || t.id}: ${t.title}`}
                      >
                        {t.ticketCode ? `[${t.ticketCode}] ` : ""}{t.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ticket Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl bg-slate-900 text-white border border-slate-700 rounded-xl p-6">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-blue-400">
                    {selectedTicket.ticketCode || `Ticket #${selectedTicket.id}`}
                  </span>
                  <Badge style={{ backgroundColor: getStatusColor(selectedTicket.status), color: "#fff", border: "none" }}>
                    {selectedTicket.status}
                  </Badge>
                  <Badge style={{ backgroundColor: getPriorityColor(selectedTicket.priority), color: "#fff", border: "none" }}>
                    {selectedTicket.priority} Priority
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-bold mt-2 text-white">
                  {selectedTicket.title}
                </DialogTitle>
              </DialogHeader>

              <div className={styles.modalGrid}>
                {/* Left Side: Ticket Content & Notes */}
                <div className={styles.modalLeft}>
                  <div>
                    <h4 className={styles.sectionTitle}>Description</h4>
                    <div className={styles.ticketDescBox}>
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Notes Segment */}
                  <div className={styles.notesSection}>
                    <h4 className={styles.sectionTitle}>Notes / Log ({selectedTicket.notes.length})</h4>
                    <div className={styles.notesList}>
                      {selectedTicket.notes.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No notes posted yet.</p>
                      ) : (
                        selectedTicket.notes.map((note) => (
                          <div
                            key={note.id}
                            className={`${styles.noteItem} ${note.isInternal ? styles.noteInternal : ""}`}
                          >
                            <div className={styles.noteHeader}>
                              <span className={styles.noteAuthor}>{note.author}</span>
                              <span>{formatDate(note.createdAt)}</span>
                            </div>
                            <p className={styles.noteContent}>{note.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddNote} className={styles.noteForm}>
                      <Textarea
                        placeholder="Type notes or updates here..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="bg-slate-950 text-white border-slate-800 placeholder-slate-600 rounded-lg min-h-16 text-sm"
                      />
                      <div className={styles.noteOptions}>
                        <label className={styles.internalCheckboxLabel}>
                          <input
                            type="checkbox"
                            checked={isNoteInternal}
                            onChange={(e) => setIsNoteInternal(e.target.checked)}
                            className="rounded border-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                          />
                          Internal note (Staff visible only)
                        </label>
                        <Button
                          type="submit"
                          disabled={!newNoteContent.trim() || isNoteSubmitting}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs"
                        >
                          {isNoteSubmitting ? "Posting..." : "Post Note"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Right Side: Meta Details & Actions */}
                <div className={styles.modalRight}>
                  <div>
                    <h4 className={styles.sectionTitle}>Assignee</h4>
                    <div className="flex flex-col gap-2">
                      <select
                        className={styles.assignSelect}
                        value={selectedTicket.assignedToId?.toString() || "unassigned"}
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
                  </div>

                  <div>
                    <h4 className={styles.sectionTitle}>Update Status</h4>
                    <div className="flex flex-col gap-2">
                      <select
                        className={styles.assignSelect}
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
                  </div>

                  <div className="flex flex-col gap-3 mt-2 text-xs">
                    <div className={styles.infoRow}>
                      <span className={styles.sectionTitle}>Category</span>
                      <span className={styles.infoVal}>{selectedTicket.category}</span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.sectionTitle}>Submitter</span>
                      <span className={styles.infoVal}>{selectedTicket.submitterName}</span>
                      <span className={styles.infoSubVal}>{selectedTicket.submitterEmail}</span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.sectionTitle}>Created At</span>
                      <span className={styles.infoVal}>{formatDate(selectedTicket.createdAt)}</span>
                    </div>

                    <div className={styles.infoRow}>
                      <span className={styles.sectionTitle}>SLA Deadline</span>
                      <span className={styles.infoVal}>{formatDate(selectedTicket.slaDeadline)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
                  value={addTaskPriority}
                  onChange={(e) => setAddTaskPriority(e.target.value)}
                >
                  <option value="low" className={styles.selectOption}>Low</option>
                  <option value="medium" className={styles.selectOption}>Medium</option>
                  <option value="high" className={styles.selectOption}>High</option>
                  <option value="critical" className={styles.selectOption}>Critical</option>
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
