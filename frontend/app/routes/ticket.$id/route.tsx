import { useState, useEffect } from "react";
import { useToast } from "~/hooks/use-toast";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Settings,
  MessageSquare,
  ArrowUpCircle,
  XCircle,
  Building,
  Tag,
  Users,
  X,
  Home,
  Inbox,
  Eye,
  UserCheck,
  Image as ImageIcon,
  TicketPlus,
} from "lucide-react";
import { Button } from "~/components/ui/button/button";
import { Label } from "~/components/ui/label/label";
import { Textarea } from "~/components/ui/textarea/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { getTicketById, getTickets, getAgents, updateTicket, assignTicket, updateTicketStatus, addTicketNote, type Ticket, type TicketStatus } from "~/services/ticket.service";
import { settingsApi, type Priority } from "~/services/settings.service";
import { usersApi } from "~/services/api.service";
import { getUserSession } from "~/services/session.service";
import type { Route } from "./+types/route";
import { Badge } from "~/components/ui/badge/badge";
import styles from "./style.module.css";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getUserSession(request);
  const ticketId = params.id;

  // Fetch ticket and agents (agents needed for staff profile modal in public view)
  const ticketId_val = params.id!;
  const ticketPromise = getTicketById(ticketId_val);
  const agentsPromise = getAgents();
  const prioritiesPromise = session ? settingsApi.getPriorities() : Promise.resolve({ success: true, data: { data: [] } });
  const statusesPromise = settingsApi.getStatuses();

  const [ticket, agents, prioritiesRes, statusesRes] = await Promise.all([
    ticketPromise,
    agentsPromise,
    prioritiesPromise,
    statusesPromise
  ]);

  return {
    session,
    ticket,
    agents,
    priorities: (prioritiesRes.data?.data || []) as Priority[],
    statuses: (statusesRes.data?.data || []) as Status[]
  };
}

export default function TicketDetail({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { session, ticket: initialTicket, agents, priorities, statuses } = loaderData;

  // Determine view mode
  const isPublic = !session;
  const isManagement = session?.userRole === "Management";
  const isAdministrator = session?.userRole === "Administrator";

  // Current user info (if logged in)
  const currentUser = session
    ? {
      id: session.userId,
      name: session.userName,
      role: session.userRole,
    }
    : null;

  const { toast } = useToast();
  const [ticket, setTicket] = useState(initialTicket);
  const [status, setStatus] = useState<string>(initialTicket?.status || "New");
  const [priority, setPriority] = useState(initialTicket?.priority || "medium");
  const [assignedTo, setAssignedTo] = useState(initialTicket?.assignedTo || "");
  const [collaborators, setCollaborators] = useState<string[]>(initialTicket?.collaborators || []);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(initialTicket?.collaboratorIds || []);
  const [newNote, setNewNote] = useState("");
  const [noteImage, setNoteImage] = useState<File | null>(null);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionError, setResolutionError] = useState("");

  // Staff Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [loadingStaffTickets, setLoadingStaffTickets] = useState(false);
  const [staffTickets, setStaffTickets] = useState<Ticket[]>([]);

  if (!ticket) {
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
          <h2>Ticket not found</h2>
          <p>The ticket ID you requested does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // --- Handlers (Staff Only) ---

  const handleAddCollaborator = async (collaboratorId: string) => {
    const agent = agents.find(a => a.id === collaboratorId);
    if (!agent) return;

    if (!collaboratorIds.includes(collaboratorId) && agent.name !== assignedTo) {
      const newIds = [...collaboratorIds, collaboratorId];
      const newNames = [...collaborators, agent.name];

      setCollaboratorIds(newIds);
      setCollaborators(newNames);

      try {
        const updatedTicket = await updateTicket(ticket.id, {
          collaboratorIds: newIds,
        });
        if (updatedTicket) {
          setTicket(updatedTicket);
          setCollaborators(updatedTicket.collaborators || []);
          setCollaboratorIds(updatedTicket.collaboratorIds || []);
        }
      } catch (error) {
        console.error("Failed to add collaborator:", error);
      }
    }
  };

  const handleRemoveCollaborator = async (collaboratorName: string) => {
    const agent = agents.find(a => a.name === collaboratorName);
    if (!agent) return;

    const newIds = collaboratorIds.filter(id => id !== agent.id);
    const newNames = collaborators.filter((c) => c !== collaboratorName);

    setCollaboratorIds(newIds);
    setCollaborators(newNames);

    try {
      const updatedTicket = await updateTicket(ticket.id, {
        collaboratorIds: newIds,
      });
      if (updatedTicket) {
        setTicket(updatedTicket);
        setCollaborators(updatedTicket.collaborators || []);
        setCollaboratorIds(updatedTicket.collaboratorIds || []);
      }
    } catch (error) {
      console.error("Failed to remove collaborator:", error);
    }
  };


  const handleUpdateStatus = async () => {
    if ((status.toLowerCase() === "resolved" || status.toLowerCase() === "closed") && !ticket?.resolutionSummary) {
      setShowResolveDialog(true);
      return;
    }

    try {
      // 1. Add note if exists
      if (newNote || noteImage) {
        await addTicketNote(ticket.id, newNote || "Note with image", true, noteImage || undefined);
        setNewNote("");
        setNoteImage(null);
      }

      // 2. Find new assignee ID
      const selectedAgent = agents.find(a => a.name === assignedTo);
      const newAssignedId = selectedAgent ? selectedAgent.id : undefined;

      // 3. Update ticket with all changes
      const updatedTicket = await updateTicket(ticket.id, {
        status,
        priority, // Include priority in update
        assignedToId: newAssignedId,
        collaboratorIds,
      });

      // Refresh ticket data
      if (updatedTicket) {
        setTicket(updatedTicket);
        setStatus(updatedTicket.status);
        setPriority(updatedTicket.priority);
        setAssignedTo(updatedTicket.assignedTo || "");
        setCollaborators(updatedTicket.collaborators || []);
        setCollaboratorIds(updatedTicket.collaboratorIds || []);

        toast({
          title: "Ticket Updated",
          description: "The ticket details have been successfully updated.",
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update ticket. Please try again.",
        variant: "destructive",
      });
    }
  };

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
      return;
    }
    setResolutionError("");
    setResolutionSummary("");
    setShowResolveDialog(true);
  };

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
      const updatedTicket = await updateTicketStatus(ticket.id, "resolved", resolutionSummary);

      if (updatedTicket) {
        setTicket(updatedTicket);
        setStatus("resolved");
        setShowResolveDialog(false);
        setResolutionSummary("");

        toast({
          title: "Ticket Resolved! 🎉",
          description: `Ticket ${ticket.id} has been successfully closed with your resolution.`,
          variant: "success",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to resolve ticket. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Resolution error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while resolving the ticket.",
        variant: "destructive",
      });
    }
  };
  const handleStaffClick = async (staffId: string) => {
    // Find staff info from agents list
    let staffInfo = agents.find(a => a.id === staffId);

    // If not in agents (maybe guest view or newly added), try to fetch specifically
    if (!staffInfo) {
      try {
        const response = await usersApi.getById(staffId);
        if (response.success && response.data) {
          const user = (response.data as any).user;
          staffInfo = {
            id: user.id,
            name: user.full_name,
            email: user.email,
            phone: user.phone,
            username: user.username
          };
        }
      } catch (error) {
        console.error("Failed to fetch specific staff info:", error);
      }
    }

    if (!staffInfo) return;

    setSelectedStaff(staffInfo);
    setIsStaffModalOpen(true);
    setLoadingStaffTickets(true);

    try {
      const { tickets } = await getTickets({ assignedTo: staffId });
      setStaffTickets(tickets);
    } catch (error) {
      console.error("Failed to fetch staff tickets:", error);
    } finally {
      setLoadingStaffTickets(false);
    }
  };
  // --- Helpers ---

  const formatDuration = (start: Date, end: Date) => {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTimeRemaining = (deadline: Date) => {
    if (ticket.status.toLowerCase() === "resolved" || ticket.status.toLowerCase() === "closed") {
      if (ticket.resolvedAt && ticket.createdAt) {
        return formatDuration(new Date(ticket.createdAt), new Date(ticket.resolvedAt));
      }
      return "Completed";
    }

    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));

    if (diff < 0) {
      return `${hours}h ${minutes}m overdue`;
    }
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getSLAStatusClass = (slaStatus: string) => {
    switch (slaStatus) {
      case "good":
        return styles.slaGood;
      case "warning":
        return styles.slaWarning;
      case "breached":
        return styles.slaBreached;
      default:
        return styles.slaGood;
    }
  };

  const getSLAIcon = () => {
    switch (ticket.slaStatus) {
      case "good":
        return <CheckCircle className={`${styles.slaIcon} ${styles.slaIconGood}`} />;
      case "warning":
        return <Clock className={`${styles.slaIcon} ${styles.slaIconWarning}`} />;
      case "breached":
        return <AlertTriangle className={`${styles.slaIcon} ${styles.slaIconBreached}`} />;
    }
  };

  const getStatusColor = (statusName: string) => {
    const statusObj = statuses.find(s => s.name.toLowerCase() === statusName.toLowerCase());
    return statusObj?.color || 'var(--color-neutral-8)';
  };

  const getStatusIconDetail = (statusName: string) => {
    const lower = statusName.toLowerCase();
    if (lower.includes('new')) return <Inbox style={{ width: "16px", height: "16px" }} />;
    if (lower.includes('triaged')) return <Eye style={{ width: "16px", height: "16px" }} />;
    if (lower.includes('assigned')) return <UserCheck style={{ width: "16px", height: "16px" }} />;
    if (lower.includes('progress')) return <Clock style={{ width: "16px", height: "16px" }} />;
    if (lower.includes('resolve')) return <CheckCircle style={{ width: "16px", height: "16px" }} />;
    if (lower.includes('close')) return <XCircle style={{ width: "16px", height: "16px" }} />;
    return <Circle style={{ width: "16px", height: "16px" }} />;
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerActions}>
        <Button
          variant="outline"
          onClick={() => navigate(isPublic ? "/" : "/dashboard")}
          className={styles.backButton}
        >
          {isPublic ? <Home className={styles.backIcon} /> : <ArrowLeft className={styles.backIcon} />}
          {isPublic ? "Back to Home" : "Back to Dashboard"}
        </Button>
        {isPublic && <div className={styles.publicBadge}>Public Tracking View</div>}
      </div>
      <main className={styles.main}>
        <div className={isPublic ? styles.gridPublic : styles.grid}>
        {/* Left Column - Ticket Details */}
        <div>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <FileText className={styles.sectionIcon} />
                Ticket Information
              </h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.ticketHeader}>
                <div className={styles.ticketId}>{ticket.ticketCode || ticket.id}</div>
                <h1 className={styles.ticketTitle}>{ticket.title}</h1>
                <div className={styles.ticketMeta}>
                  <span
                    className={styles.statusBadge}
                    style={{
                      backgroundColor: `${getStatusColor(ticket.status)}15`,
                      color: getStatusColor(ticket.status),
                      borderColor: `${getStatusColor(ticket.status)}30`,
                    }}
                  >
                    {getStatusIconDetail(ticket.status)}
                    {ticket.status}
                  </span>
                  {!isPublic && (
                    <span
                      className={`${styles.priorityBadge} ${styles[`priority${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}`]}`}
                    >
                      {ticket.priority === "critical" && <ArrowUpCircle style={{ width: "14px", height: "14px" }} />}
                      {ticket.priority}
                    </span>
                  )}
                </div>
              </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>
                      <User />
                      Submitter
                    </span>
                    <span className={styles.infoValue}>{ticket.submitterName}</span>
                  </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <Calendar />
                    Created
                  </span>
                  <span className={styles.infoValue}>{formatDate(ticket.createdAt)}</span>
                </div>

                { /* Show minimal info for public */}
                {!isPublic && (
                  <>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>
                        <Mail />
                        Email
                      </span>
                      <span className={styles.infoValue}>{ticket.submitterEmail}</span>
                    </div>

                    {ticket.submitterPhone && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>
                          <Phone />
                          Phone
                        </span>
                        <span className={styles.infoValue}>{ticket.submitterPhone}</span>
                      </div>
                    )}

                    {ticket.submitterDepartment && (
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>
                          <Building />
                          Department
                        </span>
                        <span className={styles.infoValue}>{ticket.submitterDepartment}</span>
                      </div>
                    )}
                  </>
                )}

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <Tag />
                    Category
                  </span>
                  <span className={styles.infoValue}>
                    <Badge variant="outline">{ticket.category}</Badge>
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <Clock />
                    Last Updated
                  </span>
                  <span className={styles.infoValue}>{formatDate(ticket.updatedAt)}</span>
                </div>
              </div>

              <div className={styles.description}>
                <h3>Description</h3>
                <p className={styles.descriptionText}>{ticket.description}</p>
              </div>

              {ticket.imageUrl && (
                <div className={styles.attachmentSection}>
                  <h3>
                    <ImageIcon size={14} style={{ display: 'inline', marginRight: 6, opacity: 0.7 }} />
                    Attachment
                  </h3>
                  <div className={styles.imageAttachment}>
                    <a
                      href={`http://localhost:5000${ticket.imageUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.imageLink}
                    >
                      <img
                        src={`http://localhost:5000${ticket.imageUrl}`}
                        alt="Ticket Attachment"
                      />
                    </a>
                  </div>
                </div>
              )}

              <div className={styles.staffGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    <User />
                    Staff Assigned
                  </span>
                  <span className={styles.infoValue}>
                    {ticket.assignedToId ? (
                      <span
                        className={styles.profileLink}
                        onClick={() => handleStaffClick(ticket.assignedToId!)}
                      >
                        {ticket.assignedTo}
                      </span>
                    ) : (
                      ticket.assignedTo || "Waiting for Assignment"
                    )}
                  </span>
                </div>

                {ticket.collaborators && ticket.collaborators.length > 0 && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>
                      <Users />
                      Collaborators
                    </span>
                    <div className={styles.collaboratorsList}>
                      {ticket.collaborators.map((c, i) => {
                        const collaboratorId = ticket.collaboratorIds[i];
                        return (
                          <Badge key={i} variant="secondary" className={styles.collaboratorBadge}>
                            {collaboratorId ? (
                              <span
                                className={styles.profileLinkBadge}
                                onClick={() => handleStaffClick(collaboratorId)}
                              >
                                {c}
                              </span>
                            ) : c}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {ticket.resolutionSummary && (
                <div className={styles.resolutionSection}>
                  <h3 className={styles.resolutionTitle}>
                    <CheckCircle className={styles.resolutionIcon} />
                    Resolution Summary
                  </h3>
                  <p className={styles.resolutionText}>{ticket.resolutionSummary}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes Timeline - HIDDEN FOR PUBLIC */}
          {!isPublic && (
            <div className={styles.section} id="activity">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <MessageSquare className={styles.sectionIcon} />
                  Activity & Notes
                </h2>
              </div>
              <div className={styles.sectionContent}>
                {ticket.notes.length === 0 ? (
                  <div className={styles.emptyNotes}>
                    <MessageSquare className={styles.emptyNotesIcon} />
                    <p>No notes or activity yet</p>
                  </div>
                ) : (
                  <div className={styles.timeline}>
                    {ticket.notes.map((note) => (
                      <div 
                        key={note.id} 
                        className={`${styles.timelineItem} ${note.isInternal ? styles.timelineItemInternal : ""}`}
                      >
                        <div className={`${styles.timelineContent} ${note.isInternal ? styles.timelineContentInternal : ""}`}>
                          <div className={styles.timelineHeader}>
                            <span className={styles.timelineAuthor}>{note.author}</span>
                            <span className={styles.timelineTime}>{formatDate(note.createdAt)}</span>
                            {note.isInternal && <span className={styles.internalBadge}>Internal Only</span>}
                          </div>
                          <p className={styles.timelineText}>{note.content}</p>
                          {note.imageUrl && (
                            <div className={styles.noteImageContainer}>
                              <a
                                href={`http://localhost:5000${note.imageUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={`http://localhost:5000${note.imageUrl}`}
                                  alt="Documentation"
                                  className={styles.noteImage}
                                />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Actions & SLA - MAINLY HIDDEN FOR PUBLIC */}
        {!isPublic && (
          <div>
            {/* SLA Status */}
            <div className={`${styles.slaCard} ${getSLAStatusClass(ticket.slaStatus)}`}>
              <div className={styles.slaHeader}>
                {getSLAIcon()}
                <h3
                  className={`${styles.slaTitle} ${styles[`slaTitle${ticket.slaStatus.charAt(0).toUpperCase() + ticket.slaStatus.slice(1)}`]}`}
                >
                  {ticket.status.toLowerCase() === "resolved" || ticket.status.toLowerCase() === "closed"
                    ? "Resolution Time"
                    : (
                      <>
                        {ticket.slaStatus === "good" && "SLA On Track"}
                        {ticket.slaStatus === "warning" && "SLA Warning"}
                        {ticket.slaStatus === "breached" && "SLA Breached"}
                      </>
                    )
                  }
                </h3>
              </div>
              <div
                className={`${styles.slaTime} ${styles[`slaTime${ticket.slaStatus.charAt(0).toUpperCase() + ticket.slaStatus.slice(1)}`]}`}
              >
                {formatTimeRemaining(ticket.slaDeadline)}
              </div>
              <p
                className={`${styles.slaDeadline} ${styles[`slaDeadline${ticket.slaStatus.charAt(0).toUpperCase() + ticket.slaStatus.slice(1)}`]}`}
              >
                Deadline: {formatDate(ticket.slaDeadline)}
              </p>
            </div>

            {/* Actions Panel */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <Settings className={styles.sectionIcon} />
                  Ticket Actions
                </h2>
              </div>
              <div className={styles.sectionContent}>
                <form className={styles.actionForm}>
                  <div className={styles.formGroup}>
                    <Label htmlFor="status">Update Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value)}
                      disabled={isManagement}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isManagement && (
                      <p style={{ fontSize: "0.75rem", color: "var(--color-neutral-9)", marginTop: "var(--space-1)" }}>
                        Management role has view-only access
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <Label htmlFor="priority">Ticket Priority</Label>
                    {isAdministrator ? (
                      <Select
                        value={priority}
                        onValueChange={(value) => setPriority(value)}
                      >
                        <SelectTrigger id="priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((p) => (
                            <SelectItem key={p.id} value={p.name.toLowerCase()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className={styles.priorityContainer}>
                        <span
                          className={`${styles.priorityBadge} ${styles[`priority${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}`]}`}
                        >
                          {ticket.priority === "critical" && <ArrowUpCircle style={{ width: "14px", height: "14px", marginRight: '6px' }} />}
                          {ticket.priority}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <Label htmlFor="assignee">Assign To</Label>
                    <Select
                      value={assignedTo || "unassigned"}
                      onValueChange={(value) => setAssignedTo(value === "unassigned" ? "" : value)}
                      disabled={isManagement || !isAdministrator}
                    >
                      <SelectTrigger id="assignee">
                        <SelectValue placeholder="Select agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.name}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* ... permission texts ... */}
                  </div>

                  {/* ... collaborators inputs ... */}
                  {/* Collaborators Section */}
                  <div className={styles.formGroup}>
                    <Label>Collaborators</Label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      {collaborators.length > 0 && (
                        <div className={styles.collaboratorsList}>
                          {collaborators.map((collaborator) => (
                            <Badge
                              key={collaborator}
                              variant="secondary"
                              className={styles.collaboratorBadgeAction}
                            >
                              <Users style={{ width: "12px", height: "12px" }} />
                              {collaborator}
                              {(isAdministrator || assignedTo === currentUser?.name) && !isManagement && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCollaborator(collaborator)}
                                  className={styles.removeCollaboratorBtn}
                                >
                                  <X />
                                </button>
                              )}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {(isAdministrator || assignedTo === currentUser?.name) && !isManagement && (
                        <Select onValueChange={(value) => handleAddCollaborator(value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Add collaborator..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agents
                              .filter((agent) => agent.name !== assignedTo && !collaboratorIds.includes(agent.id))
                              .map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <Label htmlFor="note">Add Internal Note</Label>
                    <Textarea
                      id="note"
                      placeholder="Add notes about this ticket..."
                      rows={4}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <Label>Documentation (Image)</Label>
                    <div className={styles.fileUploadContainer}>
                      <input
                        type="file"
                        id="note-image"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setNoteImage(e.target.files[0]);
                          }
                        }}
                        className={styles.fileInput}
                      />
                      <Label htmlFor="note-image" className={styles.fileLabel}>
                        <ImageIcon size={18} style={{ marginRight: 8 }} />
                        {noteImage ? 'Change Image' : 'Select Image'}
                      </Label>

                      {noteImage && (
                        <div className={styles.filePreview}>
                          <div className={styles.previewInfo}>
                            <ImageIcon size={14} style={{ marginRight: 6 }} />
                            <span className={styles.fileName}>{noteImage.name}</span>
                            <button
                              type="button"
                              onClick={() => setNoteImage(null)}
                              className={styles.removeFile}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <img
                            src={URL.createObjectURL(noteImage)}
                            alt="Preview"
                            className={styles.imagePreviewThumb}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {!isManagement && (
                    <>
                      <Button type="button" onClick={handleUpdateStatus}>
                        Update Ticket
                      </Button>

                      <Button
                        type="button"
                        onClick={handleOpenResolveDialog}
                        variant="default"
                        className={styles.resolveButton}
                        disabled={
                          !ticket?.assignedTo ||
                          (ticket?.assignedTo !== currentUser?.name) ||
                          ticket.status.toLowerCase() === "resolved" ||
                          ticket.status.toLowerCase() === "closed"
                        }
                      >
                        <CheckCircle />
                        {ticket.status.toLowerCase() === "resolved" || ticket.status.toLowerCase() === "closed"
                          ? "Ticket Resolved"
                          : "Mark as Resolved"}
                      </Button>

                      {/* Close button... */}
                    </>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Public Info Card */}
        {isPublic && (
          <div className={styles.publicSidebar}>
            <div className={`${styles.slaCard} ${styles.slaInfoOnly}`}>
              <h3 className={styles.sidebarTitle}>Ticket Status</h3>
              <p>This is a read-only view of your ticket status. If you need to add more information, please reply to the confirmation email you received.</p>
              <div className={styles.statusBox}>
                <strong>Current Status</strong>
                <div className={`${styles.statusBadge} ${styles[
                  `status${ticket.status.replace("-", "")}`
                ]}`}>
                  {getStatusIconDetail(ticket.status)}
                  {ticket.status.replace("-", " ")}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resolution Dialog - Only for Staff */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle className={styles.dialogTitle}>
              <CheckCircle className={styles.dialogIcon} />
              Resolve Ticket
            </DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              Please provide a detailed summary of how this issue was resolved.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogBody}>
            <Label htmlFor="resolution-summary">Resolution Summary *</Label>
            <Textarea
              id="resolution-summary"
              placeholder="Describe the steps taken..."
              rows={6}
              value={resolutionSummary}
              onChange={(e) => {
                setResolutionSummary(e.target.value);
                setResolutionError("");
              }}
              className={resolutionError ? styles.textareaError : ""}
            />
            {resolutionError && <p className={styles.errorText}>{resolutionError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitResolution}>
              Resolve Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Profile Modal */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent style={{ maxWidth: "450px" }}>
          <DialogHeader>
            <DialogTitle>Staff Profile</DialogTitle>
          </DialogHeader>

          {selectedStaff && (
            <div style={{ padding: "var(--space-2) 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
                <div className={styles.modalAvatar}>
                  {selectedStaff.name.charAt(0)}
                </div>
                <div>
                  <h3 className={styles.modalStaffName}>{selectedStaff.name}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                    <div className={styles.infoLabel} style={{ fontSize: "0.75rem" }}>
                      <Mail size={12} style={{ marginRight: 6 }} />
                      {selectedStaff.email}
                    </div>
                    {selectedStaff.phone && (
                      <div className={styles.infoLabel} style={{ fontSize: "0.75rem" }}>
                        <Phone size={12} style={{ marginRight: 6 }} />
                        {selectedStaff.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.modalTicketsTitle}>
                <TicketPlus size={18} />
                Ongoing Tickets
              </div>

              <div className={styles.modalTicketsList}>
                {loadingStaffTickets ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "var(--color-neutral-9)" }}>
                    Loading tickets...
                  </div>
                ) : staffTickets.length === 0 ? (
                  <div className={styles.modalNoTickets}>
                    No ongoing tickets found for this staff.
                  </div>
                ) : (
                  staffTickets
                    .filter(t => t.status !== 'resolved' && t.status !== 'closed')
                    .map(t => (
                      <div
                        key={t.id}
                        className={styles.modalTicketItem}
                        onClick={() => {
                          setIsStaffModalOpen(false);
                          navigate(`/ticket/${t.id}`);
                        }}
                      >
                        <div className={styles.modalTicketHeader}>
                          <span className={styles.modalTicketId}>{t.id}</span>
                          <Badge variant="outline" style={{ fontSize: "0.6rem", height: "18px" }}>
                            {t.status}
                          </Badge>
                        </div>
                        <h4 className={styles.modalTicketTitle}>{t.title}</h4>
                      </div>
                    ))
                )}
                {staffTickets.length > 0 && staffTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length === 0 && (
                  <div className={styles.modalNoTickets}>
                    No ongoing tickets (all resolved).
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStaffModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </div>
  );
}
