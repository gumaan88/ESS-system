
import { Timestamp } from 'firebase/firestore';

export enum SystemRole {
  EMPLOYEE = 'EMPLOYEE',
  HOD = 'HOD', // Head of Department
  HR_SPECIALIST = 'HR_SPECIALIST', // Was HR_ADMIN, renamed/mapped for clarity
  HR_MANAGER = 'HR_MANAGER', // If needed separate from specialist
  ACCOUNTANT = 'ACCOUNTANT',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  CFO = 'CFO',
  CEO = 'CEO',
  // Keep HR_ADMIN for backward compatibility or generic admin tasks if needed
  HR_ADMIN = 'HR_ADMIN' 
}

export enum RequestStatus {
  DRAFT = 'DRAFT', // New status for Drafts
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
}

export enum ApprovalStepType {
    REPORTS_TO = 'REPORTS_TO',
    SYSTEM_ROLE = 'SYSTEM_ROLE',
}

export enum FieldType {
    TEXT = 'text',
    NUMBER = 'number',
    DATE = 'date',
    TIME = 'time',
    FILE = 'file',
    SELECT = 'select',
    TEXTAREA = 'textarea',
}

export interface Employee {
  uid: string;
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  reportsTo: string | null; // UID of manager
  systemRole: SystemRole;
  balances: {
    annual: number; // Annual Leave
    sick: number;   // Sick Leave
    casual: number; // Emergency/Casual Leave
    permissionsUsed: number; // Tracked via requests, but good to have a cache if needed
  };
  delegation?: {
      uid: string; // User ID delegated to
      name: string;
      until: Timestamp;
  } | null;
}

export interface FormField {
    id: string;
    label: string;
    type: FieldType;
    options?: string[];
    required: boolean;
}

export interface ApprovalStep {
    order: number;
    type: ApprovalStepType;
    roleValue: SystemRole | null; // e.g., 'HR_ADMIN' if type is SYSTEM_ROLE
}

export interface ServiceDefinition {
  id: string;
  title: string;
  icon: string; // e.g., SVG path or font icon class
  color: string; // e.g., 'blue-500'
  fields: FormField[];
  approvalSteps: ApprovalStep[];
}

export interface HistoryEntry {
  user: string; // User's name
  uid: string; // User's UID
  action: string; // e.g., 'Created', 'Approved', 'Rejected'
  note?: string;
  time: Timestamp;
}

export interface Request {
  id: string;
  employeeId: string;
  employeeName: string;
  department?: string; // Added for filtering
  serviceId: string;
  serviceTitle: string;
  status: RequestStatus;
  currentStepIndex: number;
  assignedTo: string; // UID of the person responsible for the current step
  payload: Record<string, any>; // For Permissions: { date, startTime, endTime, duration, type }
  history: HistoryEntry[];
  createdAt: Timestamp;
}
