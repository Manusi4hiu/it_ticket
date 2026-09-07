import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/route";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Inbox,
  AlertCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowDownCircle,
  UserCheck,
  Trash2,
  Check,
  MoreHorizontal
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
  getTicketStats,
  assignTicket,
  deleteTicket,
  type Ticket,
  type Agent
} from "~/services/ticket.service";
import { settingsApi, type Status, type Category } from "~/services/settings.service";
import { requireAuth } from "~/services/session.service";
import { sortStatusesByWorkflow, getStatusWorkflowRank, canTakeTicket, inferFilterGroup } from "~/utils/ticket-ui";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const url = new URL(request.url);
  
  const statusResponse = await settingsApi.getStatuses();

  const allStatuses = statusResponse.data?.data || [];
  const defaultStatusObj = allStatuses.find((s: any) => s.isDefault);
  const defaultStatusName = defaultStatusObj ? defaultStatusObj.name : "NEW";

  const statusParam = url.searchParams.get("status");
  const filters = {
    status: statusParam === "all" ? undefined : (statusParam || defaultStatusName),
    priority: url.searchParams.get("priority") || undefined,
    category: url.searchParams.get("category") || undefined,
    assignedTo: url.searchParams.get("assignedTo") || undefined,
    search: url.searchParams.get("search") || undefined,
    page: parseInt(url.searchParams.get("page") || "1"),
    per_page: 15
  };

  const [ticketResponse, agents, categoryResponse, statsResponse] = await Promise.all([
    getTickets(filters),
    getAgents(),
    settingsApi.getCategories(),
    getTicketStats()
  ]);

  return Response.json({
    session,
    tickets: ticketResponse.tickets,
    totalTickets: ticketResponse.total,
    agents,
    // Closed tetap di-hide dari halaman utama by design; status lain semua masuk
    statuses: (statusResponse.data?.data || []).filter((s: any) => s.showOnItHelpdesk !== false && s.name.toLowerCase() !== 'closed') as Status[],
    categories: (categoryResponse.data?.data || []) as Category[],
    stats: statsResponse,
    filters
  });
}

export default function TicketsList({ loaderData }: Route.ComponentProps) {
  const { 
    session,
    tickets: initialTickets, 
    totalTickets, 
    agents, 
    statuses, 
    categories, 
    stats,
    filters: initialFilters 
  } = loaderData;
  
  const [tickets, setTickets] = useState(initialTickets);
  
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(initialFilters.search || "");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [jumpPage, setJumpPage] = useState("");
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const isAdministrator = session?.userRole === 'Administrator' || session?.userRole?.toLowerCase() === 'administrator';

  // In-header filter popover state
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setActiveHeaderDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sorted statuses: fixed IT workflow rank: New → Triaged → Assigned → In Progress → Resolved
  const sortedStatuses = useMemo(() => {
    return sortStatusesByWorkflow(statuses);
  }, [statuses]);

  // Sorted tickets: workflow rank New → Triaged → Assigned → In Progress → Resolved (no closed)
  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => {
      const ra = getStatusWorkflowRank(a.status);
      const rb = getStatusWorkflowRank(b.status);
      if (ra !== rb) return ra - rb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tickets]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (searchParams.get("search") || "")) {
        const newParams = new URLSearchParams(searchParams);
        if (searchValue) {
          newParams.set("search", searchValue);
        } else {
          newParams.delete("search");
        }
        newParams.set("page", "1");
        setSearchParams(newParams);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all" || !value) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    
    if (key !== "page") {
      newParams.set("page", "1");
    }
    
    setSearchParams(newParams);
    setActiveHeaderDropdown(null);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearchValue("");
    setActiveHeaderDropdown(null);
  };

  // Dynamically categorize statuses into New, Progress, Done, and Pending groups.
  // Sumber: filterGroup eksplisit dari Settings (master data) — SATU status hanya
  // masuk SATU grup (tidak bisa tampil di dua tombol sekaligus).
  // Fallback: infer dari nama hanya jika filterGroup belum diset (null/Auto).
  // Grup kosong (semua statusnya dipindah/dihapus) -> tombol tetap render dgn badge 0,
  // dan KLIK tombol grup kosong menghasilkan filter yang tidak match apa pun (bukan default nama).
  const { newStatusNames, progressStatusNames, doneStatusNames, pendingStatusNames } = useMemo(() => {
    const newNames: string[] = [];
    const doneNames: string[] = [];
    const progressNames: string[] = [];
    const pendingNames: string[] = [];

    statuses.forEach((s) => {
      const group = s.filterGroup || inferFilterGroup(s.name, s.isDefault);
      if (group === "new") newNames.push(s.name);
      else if (group === "done") doneNames.push(s.name);
      else if (group === "pending") pendingNames.push(s.name);
      else progressNames.push(s.name);
    });

    return {
      newStatusNames: newNames,
      progressStatusNames: progressNames,
      doneStatusNames: doneNames,
      pendingStatusNames: pendingNames,
    };
  }, [statuses]);

  // Segmented status buttons active state
  const currentStatusParam = searchParams.get("status") || "";
  const currentStatusList = useMemo(() => {
    return currentStatusParam.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  }, [currentStatusParam]);

  const isNewActive = useMemo(() => {
    if (currentStatusList.length === 0) return false;
    const lowerNew = newStatusNames.map(s => s.toLowerCase());
    return currentStatusList.every(s => lowerNew.includes(s));
  }, [currentStatusList, newStatusNames]);

  const isDoneActive = useMemo(() => {
    if (currentStatusList.length === 0) return false;
    const lowerDone = doneStatusNames.map(s => s.toLowerCase());
    return currentStatusList.every(s => lowerDone.includes(s));
  }, [currentStatusList, doneStatusNames]);

  const isPendingActive = useMemo(() => {
    if (currentStatusList.length === 0) return false;
    const lowerPending = pendingStatusNames.map(s => s.toLowerCase());
    return currentStatusList.every(s => lowerPending.includes(s));
  }, [currentStatusList, pendingStatusNames]);

  const isProgressActive = useMemo(() => {
    if (currentStatusList.length === 0) return false;
    const lowerProgress = progressStatusNames.map(s => s.toLowerCase());
    return currentStatusList.some(s => lowerProgress.includes(s)) && !isNewActive && !isDoneActive && !isPendingActive;
  }, [currentStatusList, progressStatusNames, isNewActive, isDoneActive, isPendingActive]);

  const handleSegmentedStatusClick = (type: "new" | "progress" | "done" | "pending") => {
    // Grup kosong (tidak ada status di grup itu) -> kirim sentinel yg tidak match
    // status apa pun, sehingga hasil filter = kosong (bukan bocor ke status grup lain)
    const SENTINEL_EMPTY = "__none__";
    const groupNames = type === "new" ? newStatusNames : type === "progress" ? progressStatusNames : type === "pending" ? pendingStatusNames : doneStatusNames;
    const isActive = type === "new" ? isNewActive : type === "progress" ? isProgressActive : type === "pending" ? isPendingActive : isDoneActive;
    const value = groupNames.length > 0 ? groupNames.join(",") : SENTINEL_EMPTY;
    handleFilterChange("status", isActive ? "all" : value);
  };

  const handleTakeTicket = async (ticketId: number) => {
    const updated = await assignTicket(ticketId.toString(), session.userId.toString());
    if (updated) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, assignedTo: updated.assignedTo, assignedToId: updated.assignedToId, status: updated.status, updatedAt: updated.updatedAt } : t));
    }
  };

  const handleDeleteTicket = async (ticketId: number) => {
    if (confirm("Are you sure you want to delete this ticket?")) {
      const success = await deleteTicket(ticketId.toString());
      if (success) {
        setTickets(prev => prev.filter(t => t.id !== ticketId));
      } else {
        alert("Failed to delete ticket. Please check your permissions.");
      }
    }
  };

  const totalPages = Math.ceil(totalTickets / initialFilters.per_page);

  const getPriorityIcon = (priority: string) => {
    const p = priority.toLowerCase();
    switch (p) {
      case 'critical': return <AlertTriangle className={`${styles.priorityIcon} ${styles.priorityCritical}`} />;
      case 'high': return <AlertCircle className={`${styles.priorityIcon} ${styles.priorityHigh}`} />;
      case 'medium': return <Clock className={`${styles.priorityIcon} ${styles.priorityMedium}`} />;
      case 'low': return <ArrowDownCircle className={`${styles.priorityIcon} ${styles.priorityLow}`} />;
      default: return null;
    }
  };

  const getStatusClass = (status: string) => {
    const s = String(status || "").toLowerCase().trim();
    if (newStatusNames.some(n => n.toLowerCase() === s)) return styles.statusNew;
    if (doneStatusNames.some(n => n.toLowerCase() === s)) return styles.statusResolved;
    if (pendingStatusNames.some(n => n.toLowerCase() === s)) return styles.statusPending;
    return styles.statusInProgress;
  };

  // Active filters list for chips/pills
  const currentAssignedTo = searchParams.get("assignedTo");
  const currentPriority = searchParams.get("priority");
  const currentCategory = searchParams.get("category");
  const hasActiveFilters = Boolean(currentStatusParam || currentAssignedTo || currentPriority || currentCategory || searchValue);

  // Filtered lists for popover search
  const filteredAgents = useMemo(() => {
    if (!assigneeSearch.trim()) return agents;
    return agents.filter(a => a.name.toLowerCase().includes(assigneeSearch.toLowerCase()));
  }, [agents, assigneeSearch]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [categories, categorySearch]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tickets</h1>
        
        <div className={styles.filterBar}>
          {/* 1. Full-Width Search Input */}
          <div className={styles.searchInputWrapperFull}>
            <Search className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search summary, description, ticket code, or submitter..." 
              className={styles.searchInput}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button 
                type="button" 
                className={styles.searchClearBtn}
                onClick={() => setSearchValue("")}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* 2. Segmented Status Buttons (New, Progress, Done, Pending) */}
          <div className={styles.segmentedControls}>
            <button
              type="button"
              className={`${styles.segmentedButton} ${isNewActive ? styles.segmentedButtonActive : ""}`}
              onClick={() => handleSegmentedStatusClick("new")}
            >
              <span>NEW</span>
              <span className={styles.segmentedCount}>
                {stats?.new ?? 0}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.segmentedButton} ${isProgressActive ? styles.segmentedButtonActive : ""}`}
              onClick={() => handleSegmentedStatusClick("progress")}
            >
              <span>PROGRESS</span>
              <span className={styles.segmentedCount}>
                {stats?.workedOn ?? 0}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.segmentedButton} ${isDoneActive ? styles.segmentedButtonActive : ""}`}
              onClick={() => handleSegmentedStatusClick("done")}
            >
              <span>DONE</span>
              <span className={styles.segmentedCount}>
                {stats?.resolved ?? 0}
              </span>
            </button>

            <button
              type="button"
              className={`${styles.segmentedButton} ${isPendingActive ? styles.segmentedButtonActive : ""}`}
              onClick={() => handleSegmentedStatusClick("pending")}
            >
              <span>PENDING</span>
              <span className={styles.segmentedCount}>
                {stats?.pending ?? 0}
              </span>
            </button>
          </div>

          {/* 3. Active filter indicators if any */}
          {hasActiveFilters && (
            <div className={styles.activeFiltersBar}>
              <div className={styles.activeFilterPills}>
                <span style={{ fontSize: "0.78rem", color: "var(--color-neutral-9)" }}>Active filters:</span>
                {currentStatusParam && (
                  <span className={styles.filterPill}>
                    Status: {currentStatusParam}
                    <span className={styles.filterPillClose} onClick={() => handleFilterChange("status", "all")}><X size={12} /></span>
                  </span>
                )}
                {currentAssignedTo && (
                  <span className={styles.filterPill}>
                    Assignee: {currentAssignedTo === "unassigned" ? "Unassigned" : (agents.find(a => String(a.id) === currentAssignedTo)?.name || currentAssignedTo)}
                    <span className={styles.filterPillClose} onClick={() => handleFilterChange("assignedTo", "all")}><X size={12} /></span>
                  </span>
                )}
                {currentPriority && (
                  <span className={styles.filterPill}>
                    Priority: {currentPriority}
                    <span className={styles.filterPillClose} onClick={() => handleFilterChange("priority", "all")}><X size={12} /></span>
                  </span>
                )}
                {currentCategory && (
                  <span className={styles.filterPill}>
                    Category: {currentCategory}
                    <span className={styles.filterPillClose} onClick={() => handleFilterChange("category", "all")}><X size={12} /></span>
                  </span>
                )}
                {searchValue && (
                  <span className={styles.filterPill}>
                    Query: "{searchValue}"
                    <span className={styles.filterPillClose} onClick={() => setSearchValue("")}><X size={12} /></span>
                  </span>
                )}
              </div>
              <button type="button" onClick={clearFilters} className={styles.clearAllButton}>
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Table with In-Header Column Filter Popovers */}
      <div className={styles.tableContainer} ref={tableRef}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Key</th>
                <th>Summary</th>

                {/* ASSIGNEE Column Header with Popover Filter */}
                <th style={{ width: '160px' }}>
                  <div className={styles.thFilterContainer}>
                    <button
                      type="button"
                      className={`${styles.thFilterButton} ${currentAssignedTo ? styles.thFilterButtonActive : ""}`}
                      onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === "assignee" ? null : "assignee")}
                    >
                      <span>
                        Assignee
                        {currentAssignedTo && <span className={styles.filterBadgeDot} />}
                      </span>
                      <ChevronDown size={14} className={styles.thChevron} style={{ transform: activeHeaderDropdown === "assignee" ? "rotate(180deg)" : "none" }} />
                    </button>

                    {activeHeaderDropdown === "assignee" && (
                      <div className={styles.columnFilterPopover}>
                        {agents.length > 6 && (
                          <input
                            type="text"
                            placeholder="Filter assignee..."
                            className={styles.columnFilterSearch}
                            value={assigneeSearch}
                            onChange={(e) => setAssigneeSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div
                          className={`${styles.columnFilterItem} ${!currentAssignedTo ? styles.columnFilterItemActive : ""}`}
                          onClick={() => handleFilterChange("assignedTo", "all")}
                        >
                          <span>All Assignees</span>
                          {!currentAssignedTo && <Check size={14} />}
                        </div>
                        <div
                          className={`${styles.columnFilterItem} ${currentAssignedTo === "unassigned" ? styles.columnFilterItemActive : ""}`}
                          onClick={() => handleFilterChange("assignedTo", "unassigned")}
                        >
                          <span>Unassigned</span>
                          {currentAssignedTo === "unassigned" && <Check size={14} />}
                        </div>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
                        {filteredAgents.map((agent) => {
                          const isSelected = currentAssignedTo === String(agent.id) || currentAssignedTo === agent.name;
                          return (
                            <div
                              key={agent.id}
                              className={`${styles.columnFilterItem} ${isSelected ? styles.columnFilterItemActive : ""}`}
                              onClick={() => handleFilterChange("assignedTo", String(agent.id))}
                            >
                              <span>{agent.name}</span>
                              {isSelected && <Check size={14} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </th>

                <th style={{ width: '140px' }}>Submitter</th>

                {/* PRIORITY Column Header with Popover Filter */}
                <th style={{ width: '120px' }}>
                  <div className={styles.thFilterContainer}>
                    <button
                      type="button"
                      className={`${styles.thFilterButton} ${currentPriority ? styles.thFilterButtonActive : ""}`}
                      onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === "priority" ? null : "priority")}
                    >
                      <span>
                        Priority
                        {currentPriority && <span className={styles.filterBadgeDot} />}
                      </span>
                      <ChevronDown size={14} className={styles.thChevron} style={{ transform: activeHeaderDropdown === "priority" ? "rotate(180deg)" : "none" }} />
                    </button>

                    {activeHeaderDropdown === "priority" && (
                      <div className={styles.columnFilterPopover}>
                        <div
                          className={`${styles.columnFilterItem} ${!currentPriority ? styles.columnFilterItemActive : ""}`}
                          onClick={() => handleFilterChange("priority", "all")}
                        >
                          <span>All Priorities</span>
                          {!currentPriority && <Check size={14} />}
                        </div>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
                        {[
                          { id: "critical", label: "Critical", color: "#f87171" },
                          { id: "high", label: "High", color: "#fb923c" },
                          { id: "medium", label: "Medium", color: "#fbbf24" },
                          { id: "low", label: "Low", color: "#9ca3af" }
                        ].map((p) => {
                          const isSelected = currentPriority?.toLowerCase() === p.id;
                          return (
                            <div
                              key={p.id}
                              className={`${styles.columnFilterItem} ${isSelected ? styles.columnFilterItemActive : ""}`}
                              onClick={() => handleFilterChange("priority", p.id)}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color }} />
                                <span>{p.label}</span>
                              </div>
                              {isSelected && <Check size={14} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </th>

                {/* STATUS Column Header with Popover Filter */}
                <th style={{ width: '130px' }}>
                  <div className={styles.thFilterContainer}>
                    <button
                      type="button"
                      className={`${styles.thFilterButton} ${currentStatusParam ? styles.thFilterButtonActive : ""}`}
                      onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === "status" ? null : "status")}
                    >
                      <span>
                        Status
                        {currentStatusParam && <span className={styles.filterBadgeDot} />}
                      </span>
                      <ChevronDown size={14} className={styles.thChevron} style={{ transform: activeHeaderDropdown === "status" ? "rotate(180deg)" : "none" }} />
                    </button>

                    {activeHeaderDropdown === "status" && (
                      <div className={styles.columnFilterPopover}>
                        <div
                          className={`${styles.columnFilterItem} ${!currentStatusParam ? styles.columnFilterItemActive : ""}`}
                          onClick={() => handleFilterChange("status", "all")}
                        >
                          <span>All Statuses</span>
                          {!currentStatusParam && <Check size={14} />}
                        </div>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
                        {sortedStatuses.map((s) => {
                          const isSelected = currentStatusParam.toLowerCase() === s.name.toLowerCase();
                          return (
                            <div
                              key={s.id}
                              className={`${styles.columnFilterItem} ${isSelected ? styles.columnFilterItemActive : ""}`}
                              onClick={() => handleFilterChange("status", s.name)}
                            >
                              <span>{s.name}</span>
                              {isSelected && <Check size={14} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </th>

                {/* CATEGORY Column Header with Popover Filter */}
                <th style={{ width: '140px' }}>
                  <div className={styles.thFilterContainer}>
                    <button
                      type="button"
                      className={`${styles.thFilterButton} ${currentCategory ? styles.thFilterButtonActive : ""}`}
                      onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === "category" ? null : "category")}
                    >
                      <span>
                        Category
                        {currentCategory && <span className={styles.filterBadgeDot} />}
                      </span>
                      <ChevronDown size={14} className={styles.thChevron} style={{ transform: activeHeaderDropdown === "category" ? "rotate(180deg)" : "none" }} />
                    </button>

                    {activeHeaderDropdown === "category" && (
                      <div className={styles.columnFilterPopover}>
                        {categories.length > 6 && (
                          <input
                            type="text"
                            placeholder="Filter category..."
                            className={styles.columnFilterSearch}
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div
                          className={`${styles.columnFilterItem} ${!currentCategory ? styles.columnFilterItemActive : ""}`}
                          onClick={() => handleFilterChange("category", "all")}
                        >
                          <span>All Categories</span>
                          {!currentCategory && <Check size={14} />}
                        </div>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
                        {filteredCategories.map((c) => {
                          const isSelected = currentCategory?.toLowerCase() === c.name.toLowerCase();
                          return (
                            <div
                              key={c.id}
                              className={`${styles.columnFilterItem} ${isSelected ? styles.columnFilterItemActive : ""}`}
                              onClick={() => handleFilterChange("category", c.name)}
                            >
                              <span>{c.name}</span>
                              {isSelected && <Check size={14} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </th>

                <th style={{ width: '130px' }}>Created</th>
                {isAdministrator && <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {sortedTickets.length === 0 ? (
                <tr>
                  <td colSpan={isAdministrator ? 9 : 8}>
                    <div className={styles.emptyState}>
                      <Inbox className={styles.emptyIcon} />
                      <p>No tickets found matching your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedTickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    className={styles.tableRow}
                    onClick={() => navigate(`/ticket/${ticket.ticketCode || ticket.id}`)}
                  >
                    <td><span className={styles.ticketKey}>{ticket.ticketCode || ticket.id}</span></td>
                    <td><span className={styles.ticketSummary}>{ticket.title}</span></td>
                    <td>
                      {ticket.assignedTo ? (
                        <div className={styles.assignedWrapper}>
                          <UserCheck size={14} className={styles.assignedIcon} />
                          {ticket.assignedTo}
                        </div>
                      ) : (
                        <div className={styles.takeAction}>
                          <span className={styles.unassignedText}>Unassigned</span>
                          {(session.userRole === 'Staff' || session.userRole === 'Administrator') && canTakeTicket(ticket.status) && (
                            <Button
                              size="sm"
                              className={styles.miniTakeButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTakeTicket(ticket.id);
                              }}
                            >
                              Take
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{ticket.submitterName}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getPriorityIcon(ticket.priority)}
                        <span style={{ fontSize: '0.8rem' }}>{ticket.priority}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusClass(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral-11)' }}>
                        {ticket.category}
                      </span>
                    </td>
                    <td>
                      {new Date(ticket.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    {isAdministrator && (
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          className={styles.deleteRedBtn}
                          onClick={() => handleDeleteTicket(ticket.id)}
                          title="Hapus ticket"
                          aria-label="Hapus ticket"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalTickets > 0 && (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              Showing {(initialFilters.page - 1) * initialFilters.per_page + 1} to {(initialFilters.page - 1) * initialFilters.per_page + sortedTickets.length} of {totalTickets} tickets
            </div>
            <div className={styles.paginationActions}>
              <Button 
                variant="outline" 
                size="sm" 
                className={styles.pageButton}
                disabled={initialFilters.page === 1}
                onClick={() => handleFilterChange("page", (initialFilters.page - 1).toString())}
              >
                <ChevronLeft size={16} />
              </Button>
              
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= initialFilters.page - 1 && pageNum <= initialFilters.page + 1)
                ) {
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === initialFilters.page ? "default" : "outline"}
                      size="sm"
                      className={`${styles.pageButton} ${pageNum === initialFilters.page ? styles.pageButtonActive : ""}`}
                      onClick={() => handleFilterChange("page", pageNum.toString())}
                    >
                      {pageNum}
                    </Button>
                  );
                } else if (
                  pageNum === initialFilters.page - 2 || 
                  pageNum === initialFilters.page + 2
                ) {
                  return (
                    <Button
                      key={pageNum}
                      variant="ghost"
                      size="sm"
                      className={styles.pageButton}
                      onClick={() => setIsJumpOpen(true)}
                      title="Go to page"
                      style={{ color: '#9ca3af' }}
                    >
                      <MoreHorizontal size={14} />
                    </Button>
                  );
                }
                return null;
              })}

              <Button 
                variant="outline" 
                size="sm" 
                className={styles.pageButton}
                disabled={initialFilters.page === totalPages || totalPages === 0}
                onClick={() => handleFilterChange("page", (initialFilters.page + 1).toString())}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Jump to page dialog — small square via [...] */}
        <Dialog open={isJumpOpen} onOpenChange={setIsJumpOpen}>
          <DialogContent className="bg-slate-900 text-white border border-slate-700 rounded-xl p-4" style={{ maxWidth: 260, width: 260, minHeight: 180 }}>
            <DialogHeader style={{ gap: 2, marginBottom: 8 }}>
              <DialogTitle className="text-sm font-semibold text-white" style={{ textAlign: 'center' }}>Go to page</DialogTitle>
              <DialogDescription className="text-xs text-slate-400" style={{ textAlign: 'center' }}>
                1 – {totalPages}
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8, flex: 1, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center' }}>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const p = parseInt(jumpPage, 10);
                      if (!isNaN(p) && p >= 1 && p <= totalPages) {
                        handleFilterChange("page", p.toString());
                        setIsJumpOpen(false);
                        setJumpPage("");
                      }
                    }
                  }}
                  placeholder={`${initialFilters.page}`}
                  autoFocus
                  style={{
                    width: 90,
                    height: 36,
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    textAlign: 'center',
                    fontWeight: 600
                  }}
                />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>/ {totalPages}</span>
              </div>
            </div>
            <DialogFooter style={{ marginTop: 16, gap: 8, justifyContent: 'center' }}>
              <Button variant="outline" size="sm" onClick={() => { setIsJumpOpen(false); setJumpPage(""); }} style={{ height: 32, fontSize: '0.8rem', minWidth: 70 }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!jumpPage || isNaN(parseInt(jumpPage, 10)) || parseInt(jumpPage, 10) < 1 || parseInt(jumpPage, 10) > totalPages}
                onClick={() => {
                  const p = parseInt(jumpPage, 10);
                  if (!isNaN(p) && p >= 1 && p <= totalPages) {
                    handleFilterChange("page", p.toString());
                    setIsJumpOpen(false);
                    setJumpPage("");
                  }
                }}
                style={{ height: 32, fontSize: '0.8rem', minWidth: 60 }}
              >
                Go
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
