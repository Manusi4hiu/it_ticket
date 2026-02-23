export type TicketStatus = "new" | "triaged" | "assigned" | "in-progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type SLAStatus = "good" | "warning" | "breached";

export type TicketCategory = "Hardware" | "Software" | "Network" | "Other";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  submitterName: string;
  submitterEmail: string;
  submitterPhone?: string;
  submitterDepartment?: string;
  assignedTo?: string;
  collaborators: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  slaDeadline: Date;
  slaStatus: SLAStatus;
  notes: TicketNote[];
  resolutionSummary?: string;
}

export interface TicketNote {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
  isInternal: boolean;
}

export const mockTickets: Ticket[] = [
  {
    id: "TKT-001",
    title: "Unable to access email on mobile device",
    description:
      "I cannot sync my work email to my iPhone. I have tried removing and re-adding the account multiple times but keep getting an authentication error.",
    status: "new",
    priority: "high",
    category: "Software",
    submitterName: "Sarah Johnson",
    submitterEmail: "sarah.johnson@company.com",
    submitterPhone: "+1 (555) 123-4567",
    submitterDepartment: "HR",
    collaborators: [],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    slaDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
    slaStatus: "good",
    notes: [],
  },
  {
    id: "TKT-002",
    title: "Laptop running extremely slow",
    description:
      "My laptop has been running very slow for the past week. Applications take forever to open and the system freezes frequently. I have already restarted multiple times.",
    status: "assigned",
    priority: "medium",
    category: "Hardware",
    submitterName: "Michael Chen",
    submitterEmail: "michael.chen@company.com",
    submitterDepartment: "Finance",
    assignedTo: "John Smith",
    collaborators: [],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    slaDeadline: new Date(Date.now() + 3 * 60 * 60 * 1000),
    slaStatus: "warning",
    notes: [
      {
        id: "NOTE-001",
        content: "Initial triage completed. Assigned to John for hardware diagnostics.",
        author: "Admin",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        isInternal: true,
      },
    ],
  },
  {
    id: "TKT-003",
    title: "Cannot print from workstation",
    description:
      "The printer on the 3rd floor is not showing up in my available printers list. I need to print urgent documents for a client meeting.",
    status: "in-progress",
    priority: "high",
    category: "Hardware",
    submitterName: "Emily Rodriguez",
    submitterEmail: "emily.rodriguez@company.com",
    submitterPhone: "+1 (555) 987-6543",
    submitterDepartment: "Sales",
    assignedTo: "Jane Doe",
    collaborators: ["Mike Wilson"],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    slaDeadline: new Date(Date.now() + 1 * 60 * 60 * 1000),
    slaStatus: "warning",
    notes: [
      {
        id: "NOTE-002",
        content: "Checking printer network connectivity and driver installation.",
        author: "Jane Doe",
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        isInternal: true,
      },
    ],
  },
  {
    id: "TKT-004",
    title: "VPN connection keeps dropping",
    description:
      "When working from home, my VPN connection drops every 15-20 minutes. This is making it impossible to work remotely.",
    status: "triaged",
    priority: "critical",
    category: "Network",
    submitterName: "David Park",
    submitterEmail: "david.park@company.com",
    submitterDepartment: "Operations",
    collaborators: [],
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    slaDeadline: new Date(Date.now() - 1 * 60 * 60 * 1000), // Already breached
    slaStatus: "breached",
    notes: [
      {
        id: "NOTE-003",
        content: "High priority - remote worker unable to connect. Need immediate attention.",
        author: "Admin",
        createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
        isInternal: true,
      },
    ],
  },
  {
    id: "TKT-005",
    title: "Request for software installation - Adobe Creative Suite",
    description:
      "I need Adobe Creative Suite installed on my workstation for the new marketing campaign. My manager has approved this request.",
    status: "resolved",
    priority: "low",
    category: "Software",
    submitterName: "Lisa Anderson",
    submitterEmail: "lisa.anderson@company.com",
    submitterDepartment: "Marketing",
    assignedTo: "John Smith",
    collaborators: [],
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    slaDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
    slaStatus: "good",
    notes: [
      {
        id: "NOTE-004",
        content: "License verified with procurement. Proceeding with installation.",
        author: "John Smith",
        createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
        isInternal: true,
      },
    ],
    resolutionSummary:
      "Adobe Creative Suite successfully installed and activated. User confirmed all applications are working correctly.",
  },
  {
    id: "TKT-006",
    title: "Forgot password - need reset",
    description:
      "I forgot my password and cannot log into my account. I have tried the self-service reset but it says my security questions are incorrect.",
    status: "new",
    priority: "medium",
    category: "Other",
    submitterName: "Robert Taylor",
    submitterEmail: "robert.taylor@company.com",
    submitterPhone: "+1 (555) 246-8135",
    submitterDepartment: "IT",
    collaborators: [],
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    slaDeadline: new Date(Date.now() + 7 * 60 * 60 * 1000),
    slaStatus: "good",
    notes: [],
  },
];

export const agents = [
  { id: "1", name: "John Smith", email: "john.smith@company.com" },
  { id: "2", name: "Jane Doe", email: "jane.doe@company.com" },
  { id: "3", name: "Mike Wilson", email: "mike.wilson@company.com" },
  { id: "4", name: "Sarah Connor", email: "sarah.connor@company.com" },
];
