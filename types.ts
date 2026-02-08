
import { Timestamp } from 'firebase/firestore';

export enum SystemRole {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR_ADMIN = 'HR_ADMIN',
  CFO = 'CFO',
  CEO = 'CEO',
}

export enum RequestStatus {
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
    vacation: number;
    permissions: number;
  };
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
  serviceId: string;
  serviceTitle: string;
  status: RequestStatus;
  currentStepIndex: number;
  assignedTo: string; // UID of the person responsible for the current step
  payload: Record<string, any>;
  history: HistoryEntry[];
  createdAt: Timestamp;
}
