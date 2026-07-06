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
  Activity
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { Card, CardContent } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { Textarea } from "~/components/ui/textarea/textarea";
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

// Column definition
interface KanbanColumn {
  id: string; // matches DB status name (case-insensitive checks)
  title: string;
  icon: React.ReactNode;
  color: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: "New", title: "New Issues", icon: <Inbox size={18} />, color: "#3B82F6" },
  { id: "Assigned", title: "Assigned", icon: <UserCheck size={18} />, color: "#F59E0B" },
  { id: "In Progress", title: "In Progress", icon: <Clock size={18} />, color: "#10B981" },
  { id: "Resolved", title: "Resolved & Closed", icon: <CheckCircle size={18} />, color: "#8B5CF6" }
];

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  const [ticketsRes, agents, statusesRes] = await Promise.all([
    getTickets({ category: "Development", per_page: 150 }), // Only show Development-scoped tracking tasks
    getAgents(),
    settingsApi.getStatuses()
  ]);

  return {
    session,
    initialTickets: ticketsRes.tickets,
    agents,
    statuses: statusesRes.data?.data || []
  };
}

export default function DevDashboard() {
  const { session, initialTickets, agents, statuses } = useLoaderData() as typeof loader extends (...args: any[]) => Promise<infer T> ? T : any;
  const navigate = useNavigate();

  // Kanban tickets state
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [draggedTicketId, setDraggedTicketId] = useState<number | null>(null);
  const [activeDragColumn, setActiveDragColumn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Authorization helper
  const canManage = session?.userRole === "Administrator" || session?.userRole === "Staff";

  // Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isNoteInternal, setIsNoteInternal] = useState(true);
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);

  // Add Dev Task Modal State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskDesc, setAddTaskDesc] = useState("");
  const [addTaskPriority, setAddTaskPriority] = useState("medium");
  const [addTaskAssigneeId, setAddTaskAssigneeId] = useState("unassigned");
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);

  // Edit Dev Task Modal State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskAssigneeId, setEditTaskAssigneeId] = useState("unassigned");
  const [isTaskUpdating, setIsTaskUpdating] = useState(false);

  // Delete Task Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTaskDeleting, setIsTaskDeleting] = useState(false);

  const handleAddDevTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTaskTitle.trim() || !addTaskDesc.trim() || isTaskSubmitting) return;

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
      }
    } catch (err) {
      console.error("Failed to add dev task:", err);
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
    setEditTaskPriority(ticket.priority);
    setEditTaskAssigneeId(ticket.assignedToId?.toString() || "unassigned");
    setIsEditDialogOpen(true);
    setIsDetailOpen(false);
  };

  const handleEditDevTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !editTaskTitle.trim() || !editTaskDesc.trim() || isTaskUpdating) return;

    setIsTaskUpdating(true);
    try {
      const updated = await updateTicket(selectedTicket.id.toString(), {
        title: editTaskTitle,
        description: editTaskDesc,
        priority: editTaskPriority,
        assignedToId: editTaskAssigneeId === "unassigned" ? null : parseInt(editTaskAssigneeId, 10),
      });

      if (updated) {
        setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
        setIsEditDialogOpen(false);
        setSelectedTicket(updated);
        setIsDetailOpen(true);
      }
    } catch (err) {
      console.error("Failed to update dev task:", err);
    } finally {
      setIsTaskUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setIsDetailOpen(true);
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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, ticketId: number) => {
    setDraggedTicketId(ticketId);
    e.dataTransfer.setData("text/plain", ticketId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTicketId(null);
    setActiveDragColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (activeDragColumn !== columnId) {
      setActiveDragColumn(columnId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setActiveDragColumn(null);
    const ticketIdStr = e.dataTransfer.getData("text/plain") || draggedTicketId?.toString();
    if (!ticketIdStr) return;

    const ticketId = parseInt(ticketIdStr, 10);
    const originalTicket = tickets.find((t) => t.id === ticketId);
    if (!originalTicket) return;

    // Skip if status is unchanged
    if (originalTicket.status.toLowerCase() === targetStatus.toLowerCase()) return;

    // Optimistic Update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: targetStatus, resolvedAt: targetStatus.toLowerCase() === 'resolved' ? new Date() : undefined } : t))
    );

    try {
      const updated = await updateTicketStatus(ticketId.toString(), targetStatus);
      if (!updated) {
        // Rollback on failure
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? originalTicket : t)));
      } else {
        // Update local ticket with correct resolution summary/timestamps from server
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      // Rollback
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? originalTicket : t)));
    }
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

  const handleOpenDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    setNewNoteContent("");
  };

  const handleAssignChange = async (agentIdStr: string) => {
    if (!selectedTicket) return;
    const agentId = agentIdStr === "unassigned" ? null : agentIdStr;
    const updated = await assignTicket(selectedTicket.id.toString(), agentId);

    if (updated) {
      // Update local lists
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
      setSelectedTicket(updated);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteContent.trim() || isNoteSubmitting) return;

    setIsNoteSubmitting(true);
    try {
      const newNote = await addTicketNote(selectedTicket.id.toString(), newNoteContent, isNoteInternal);
      if (newNote) {
        // Fetch updated ticket to keep notes list accurate
        const updatedTickets = await getTickets({ category: "Development", per_page: 150 });
        setTickets(updatedTickets.tickets);

        const updatedSelected = updatedTickets.tickets.find((t) => t.id === selectedTicket.id);
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

  return (
    <div className={styles.container}>
      {/* Dev Server Metrics Banner - Replaced with Developer Resource Center */}
      <div className={styles.metricsBanner}>
        <div className={styles.bannerLeft}>
          <Layers className={styles.pulseIcon} size={20} />
          <div>
            <h2 className={styles.bannerTitle}>Developer Resource Center</h2>
            <p className={styles.bannerSubtitle}>Quick guidelines, local services configuration, and system references</p>
          </div>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statIcon} style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3B82F6" }}>
              <Server size={16} />
            </div>
            <div>
              <div className={styles.statLabel}>LOCAL DEV PORTS</div>
              <div className={styles.statValue}>API: 5000 | Web: 5173</div>
            </div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon} style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10B981" }}>
              <Database size={16} />
            </div>
            <div>
              <div className={styles.statLabel}>DATABASE SYSTEM</div>
              <div className={styles.statValue}>PostgreSQL (Connected)</div>
            </div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon} style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8B5CF6" }}>
              <Clock size={16} />
            </div>
            <div>
              <div className={styles.statLabel}>SLA STANDARDS</div>
              <div className={styles.statValue}>Crit: 1h | High: 4h | Med: 24h</div>
            </div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statIcon} style={{ background: "rgba(245, 158, 11, 0.1)", color: "#F59E0B" }}>
              <Activity size={16} />
            </div>
            <div>
              <div className={styles.statLabel}>DEV TASK BACKLOG</div>
              <div className={styles.statValue}>{tickets.length} Tasks Active</div>
            </div>
          </div>
        </div>
      </div>

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
        <div>
          <Button onClick={() => setIsAddDialogOpen(true)} className={styles.addDevTaskBtn}>
            <Plus size={16} style={{ marginRight: 6 }} />
            Add Dev Task
          </Button>
        </div>
      </div>

      {/* Kanban Board Layout */}
      <div className={styles.kanbanBoard}>
        {COLUMNS.map((column) => {
          // Map DB statuses (e.g. status === "closed" mapped to Resolved column for simplicity)
          const columnTickets = filteredTickets.filter((ticket) => {
            const status = ticket.status.toLowerCase();
            if (column.id === "Resolved") {
              return status === "resolved" || status === "closed";
            }
            return status === column.id.toLowerCase();
          });

          const isColumnOver = activeDragColumn === column.id;

          return (
            <div
              key={column.id}
              className={`${styles.kanbanColumn} ${isColumnOver ? styles.columnDragOver : ""}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className={styles.columnHeader} style={{ borderTop: `3px solid ${column.color}` }}>
                <div className={styles.columnHeaderLeft}>
                  <span className={styles.columnIcon} style={{ color: column.color }}>{column.icon}</span>
                  <h3 className={styles.columnTitle}>{column.title}</h3>
                </div>
                <span className={styles.columnCount}>{columnTickets.length}</span>
              </div>

              <div className={styles.cardContainer}>
                {columnTickets.length === 0 ? (
                  <div className={styles.emptyColumn}>
                    <span>Drop tickets here</span>
                  </div>
                ) : (
                  columnTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={`${styles.ticketCard} ${draggedTicketId === ticket.id ? styles.cardIsDragging : ""}`}
                      draggable
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
                    >
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

                {/* Developer Notes Column */}
                <div className={styles.detailNotesCol}>
                  <h5 className={styles.metaTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={16} />
                    Internal Developer Comments ({selectedTicket.notes?.length || 0})
                  </h5>

                  <div className={styles.notesList}>
                    {(!selectedTicket.notes || selectedTicket.notes.length === 0) ? (
                      <div className={styles.emptyNotes}>
                        <MessageSquare size={24} style={{ opacity: 0.2, marginBottom: 8 }} />
                        <p>No comments added yet</p>
                      </div>
                    ) : (
                      selectedTicket.notes.map((note) => (
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
                          <p className={styles.noteBody}>{note.content.replace(/<[^>]*>/g, "")}</p>
                          {note.isInternal && (
                            <span className={styles.internalBadge}>Developer Only</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddNote} className={styles.noteForm}>
                    <Textarea
                      placeholder="Type your comment/notes here..."
                      className={styles.noteTextarea}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      required
                    />
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
                        disabled={isNoteSubmitting || !newNoteContent.trim()}
                        style={{ height: '32px' }}
                      >
                        {isNoteSubmitting ? "Posting..." : "Comment"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              <DialogFooter style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 16 }}>
                {canManage && (
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    style={{ color: 'var(--color-critical-9)', borderColor: 'rgba(239, 68, 68, 0.2)', marginRight: 'auto' }}
                  >
                    Delete Task
                  </Button>
                )}
                {canManage && (
                  <Button variant="outline" onClick={() => handleOpenEdit(selectedTicket)}>
                    Edit Task
                  </Button>
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
            <div className={styles.formGroup}>
              <label htmlFor="taskTitle" className={styles.formLabel}>Task Subject / Title *</label>
              <input
                id="taskTitle"
                type="text"
                required
                placeholder="e.g., Fix authentication logic, Refactor database schema..."
                className={styles.addTaskInput}
                value={addTaskTitle}
                onChange={(e) => setAddTaskTitle(e.target.value)}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="taskDesc" className={styles.formLabel}>Task Description *</label>
              <Textarea
                id="taskDesc"
                required
                placeholder="Please describe the work details..."
                className={styles.addTaskTextarea}
                value={addTaskDesc}
                onChange={(e) => setAddTaskDesc(e.target.value)}
              />
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
            <div className={styles.formGroup}>
              <label htmlFor="editTaskTitle" className={styles.formLabel}>Task Subject / Title *</label>
              <input
                id="editTaskTitle"
                type="text"
                required
                placeholder="e.g., Fix authentication logic..."
                className={styles.addTaskInput}
                value={editTaskTitle}
                onChange={(e) => setEditTaskTitle(e.target.value)}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="editTaskDesc" className={styles.formLabel}>Task Description *</label>
              <Textarea
                id="editTaskDesc"
                required
                placeholder="Please describe the work details..."
                className={styles.addTaskTextarea}
                value={editTaskDesc}
                onChange={(e) => setEditTaskDesc(e.target.value)}
              />
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
              <Button type="submit" disabled={isTaskUpdating || !editTaskTitle.trim()} className={styles.btnLaunchTicket}>
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
    </div>
  );
}
