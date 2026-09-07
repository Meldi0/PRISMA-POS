export type UserRole = 
  | 'ADMIN'
  | 'PETUGAS_UPT'
  | 'UPT_LUAR'
  | 'ADMIN_PUSAT' 
  | 'OPERATOR' 
  | 'PELAPOR' 
  | 'admin' 
  | 'operator' 
  | 'upt' 
  | 'USER_REGIONAL' 
  | 'USER_CABANG' 
  | 'pengguna_umum';

export interface Role {
  role_code: UserRole;
  name: string;
  description?: string;
  default_scope: DataScope;
}

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE';

export type DataScope = 'GLOBAL' | 'REGIONAL' | 'OFFICE' | 'OWN';

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'closed';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type TicketChannel = 'web' | 'email';

export interface Region {
  region_id: string;
  code: string;
  name: string;
  description?: string;
}

export interface Office {
  office_id: string;
  region_id: string;
  code: string;
  name: string;
  type: 'PUSAT' | 'KCU' | 'KC' | 'KCP';
  address?: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  module: string;
  action: string;
  description?: string;
  effect?: 'ALLOW' | 'DENY';
  is_override?: boolean;
}

export interface RegistrationApproval {
  approval_id: string;
  user_id: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  reviewed_at?: string;
  reviewer_name?: string;
  requested_at: string;
  name: string;
  email: string;
  phone_number?: string;
  position?: string;
  nopen_kc?: string;
  role: UserRole;
  account_status: AccountStatus;
  data_scope: DataScope;
  region_id?: string;
  office_id?: string;
  region_name?: string;
  office_name?: string;
}

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  account_status?: AccountStatus;
  data_scope?: DataScope;
  region_id?: string;
  office_id?: string;
  office_code?: string;
  region_name?: string;
  region_code?: string;
  office_name?: string;
  position?: string;
  mfa_enabled?: boolean;
  failed_attempts?: number;
  locked_until?: string;
  last_login_at?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  password_plain?: string;

  // Profil Dinas Lengkap Pos Indonesia
  nip?: string;
  department?: string;
  role_title?: string;
  phone_number?: string;
  nopen_kc?: string;

  // Granular Permissions array for current session
  permissions?: string[];
}

export interface Ticket {
  ticket_id: string;
  created_at: string;
  updated_at: string;
  subject: string;
  category: string;
  department?: string;
  topic?: string;
  location?: string;
  region_id?: string;
  region_name?: string;
  region_code?: string;
  office_id?: string;
  office_name?: string;
  office_code?: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  requester_name?: string;
  requester_email: string;
  requester_phone?: string;
  requester_nip?: string;
  assigned_upt?: string;
  assigned_operator?: string;
  sla_due_at: string;
  is_archived?: boolean;
  reopen_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  attachments?: Array<{ name: string; size: string; type: string; dataUrl?: string }>;
}

export interface ThreadMessage {
  thread_id: string;
  ticket_id: string;
  sender_id: string;
  sender_name?: string;
  sender_role: UserRole | string;
  message: string;
  visibility: 'public' | 'internal';
  created_at: string;
}

export interface AuditLogItem {
  log_id: string;
  ticket_id?: string;
  actor_id?: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface OperatorProductivityItem {
  user_id: string;
  name: string;
  email: string;
  role: string;
  position: string;
  department: string;
  tickets_handled: number;
  total_actions: number;
  tickets_resolved: number;
  last_active_at: string | null;
}

export interface TicketReopenRequest {
  request_id: string;
  ticket_id: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewer_name?: string;
  review_note?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  code?: number;
  message?: string;
  data?: T;
  mfa_required?: boolean;
  challenge_token?: string;
  masked_email?: string;
  smtp_configured?: boolean;
  otp_preview?: string;
  account_status?: AccountStatus;
}

