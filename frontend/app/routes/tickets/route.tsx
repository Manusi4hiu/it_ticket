import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router";
import type { Route } from "./+types/route";
import { 
  Search, 
  Filter, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Inbox,
  AlertCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowDownCircle,
  MoreHorizontal,
  UserCheck,
  Trash2
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Badge } from "~/components/ui/badge/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "~/components/ui/select/select";
import { 
  getTickets, 
  getAgents, 
  assignTicket,
  deleteTicket,
  type Ticket, 
  type Agent 
} from "~/services/ticket.service";
import { settingsApi } from "~/services/settings.service";
import { requireAuth } from "~/services/session.service";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  const url = new URL(request.url);
  
  const filters = {
    status: url.searchParams.get("status") || undefined,
    priority: url.searchParams.get("priority") || undefined,
    category: url.searchParams.get("category") || undefined,
    assignedTo: url.searchParams.get("assignedTo") || undefined,
    search: url.searchParams.get("search") || undefined,
    page: parseInt(url.searchParams.get("page") || "1"),
    per_page: 15
  };

  const [ticketResponse, agents, statusResponse, categoryResponse] = await Promise.all([
    getTickets(filters),
    getAgents(),
    settingsApi.getStatuses(),
    settingsApi.getCategories()
  ]);

  return {
    session,
    tickets: ticketResponse.tickets,
    totalTickets: ticketResponse.total,
    agents,
    statuses: statusResponse.data?.data || [],
    categories: categoryResponse.data?.data || [],
    filters
  };
}

export default function TicketsList({ loaderData }: Route.ComponentProps) {
  const { 
    session,
    tickets: initialTickets, 
    totalTickets, 
    agents, 
    statuses, 
    categories, 
    filters: initialFilters 
  } = loaderData;
  
  const [tickets, setTickets] = useState(initialTickets);
  
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(initialFilters.search || "");

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
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    
    // Reset to page 1 if changing a filter, but not if changing the page itself
    if (key !== "page") {
      newParams.set("page", "1");
    }
    
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearchValue("");
  };

  const handleTakeTicket = async (ticketId: number) => {
    const updated = await assignTicket(ticketId.toString(), session.userId.toString());
    if (updated) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, assignedTo: updated.assignedTo, assignedToId: updated.assignedToId } : t));
    }
  };

  const handleDeleteTicket = async (ticketId: number) => {
    if (confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) {
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
    const s = status.toLowerCase();
    if (s.includes('new')) return styles.statusNew;
    if (s.includes('progress')) return styles.statusInProgress;
    if (s.includes('resolved')) return styles.statusResolved;
    if (s.includes('closed')) return styles.statusClosed;
    return styles.statusNew;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tickets</h1>
        
        <div className={styles.filterBar}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search summary, description, or submitter..." 
              className={styles.searchInput}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <Select 
              value={searchParams.get("assignedTo") || "all"} 
              onValueChange={(val) => handleFilterChange("assignedTo", val)}
            >
              <SelectTrigger className={styles.selectTrigger}>
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={searchParams.get("status") || "all"} 
              onValueChange={(val) => handleFilterChange("status", val)}
            >
              <SelectTrigger className={styles.selectTrigger}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status.id} value={status.name}>{status.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={searchParams.get("priority") || "all"} 
              onValueChange={(val) => handleFilterChange("priority", val)}
            >
              <SelectTrigger className={styles.selectTrigger}>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={searchParams.get("category") || "all"} 
              onValueChange={(val) => handleFilterChange("category", val)}
            >
              <SelectTrigger className={styles.selectTrigger}>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchParams.toString() || searchValue) && (
              <Button variant="ghost" onClick={clearFilters} className={styles.clearButton}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Key</th>
                <th>Summary</th>
                <th style={{ width: '150px' }}>Assignee</th>
                <th style={{ width: '150px' }}>Submitter</th>
                <th style={{ width: '100px' }}>Priority</th>
                <th style={{ width: '130px' }}>Status</th>
                <th style={{ width: '150px' }}>Created</th>
                {session.userRole === 'Administrator' && <th style={{ width: '60px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <Inbox className={styles.emptyIcon} />
                      <p>No tickets found matching your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
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
                          {(session.userRole === 'Staff' || session.userRole === 'Administrator') && (
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
                      {new Date(ticket.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    {session.userRole === 'Administrator' && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={styles.miniDeleteButton}
                          onClick={() => handleDeleteTicket(ticket.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
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
              Showing 1 to {tickets.length} of {totalTickets} tickets
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
              
              {/* Simplified pagination dots */}
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Only show current, first, last, and neighbors
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= initialFilters.page - 1 && pageNum <= initialFilters.page + 1)
                ) {
                  return (
                    <Button
                      key={pageNum}
                      variant="outline"
                      size="sm"
                      className={`${styles.pageButton} ${initialFilters.page === pageNum ? styles.pageButtonActive : ''}`}
                      onClick={() => handleFilterChange("page", pageNum.toString())}
                    >
                      {pageNum}
                    </Button>
                  );
                } else if (
                  pageNum === initialFilters.page - 2 || 
                  pageNum === initialFilters.page + 2
                ) {
                  return <span key={pageNum} style={{ color: '#6b7280' }}><MoreHorizontal size={14} /></span>;
                }
                return null;
              })}

              <Button 
                variant="outline" 
                size="sm" 
                className={styles.pageButton}
                disabled={initialFilters.page === totalPages}
                onClick={() => handleFilterChange("page", (initialFilters.page + 1).toString())}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
