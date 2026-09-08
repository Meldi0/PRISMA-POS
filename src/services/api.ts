import { 
  User, 
  Ticket, 
  ThreadMessage, 
  ApiResponse,
  TicketStatus,
  TicketPriority,
  Region,
  Office,
  Role,
  Permission,
  RegistrationApproval,
  AuditLogItem,
  OperatorProductivityItem,
  TicketReopenRequest
} from '../types';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'poso_auth_token',
  AUTH_USER: 'poso_auth_user'
};

const API_BASE = '/api';

class PosoApiService {
  // In-flight mutex to avoid duplicate thread messages
  private inFlightThreads: Map<string, Promise<ApiResponse<ThreadMessage>>> = new Map();

  constructor() {}

  // -----------------------------------------------------------------------------------------------
  // AUTH TOKEN & SESSION MANAGEMENT
  // -----------------------------------------------------------------------------------------------

  public getStoredToken(): string {
    return sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || '';
  }

  public setStoredToken(token: string | null) {
    if (token) {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  }

  public getStoredUser(): User | null {
    const raw = sessionStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return null;
  }

  public setStoredUser(user: User | null) {
    if (user) {
      const json = JSON.stringify(user);
      sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, json);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // HTTP CLIENT HELPER
  // -----------------------------------------------------------------------------------------------

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = this.getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Safely read response as text first to handle empty responses (204/502/504) or non-JSON payloads
      const rawText = await response.text();
      let data: any = null;

      if (rawText && rawText.trim().length > 0) {
        try {
          data = JSON.parse(rawText);
        } catch {
          // If response is not JSON (e.g. HTML error page or raw proxy text)
          data = null;
        }
      }

      if (!response.ok) {
        let errorMessage = data?.message;
        if (!errorMessage) {
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            errorMessage = 'Backend API PRISMA POS (Port 5001) tidak dapat dihubungi. Pastikan server backend sedang berjalan.';
          } else if (response.status === 404) {
            errorMessage = `Endpoint ${endpoint} tidak ditemukan di server backend.`;
          } else if (rawText && rawText.length < 200 && !rawText.includes('<html')) {
            errorMessage = rawText;
          } else {
            errorMessage = `Permintaan gagal dengan status HTTP ${response.status} (${response.statusText || 'Error'}).`;
          }
        }

        return {
          status: 'error',
          code: response.status,
          message: errorMessage,
          data: data?.data,
          mfa_required: data?.mfa_required,
          challenge_token: data?.challenge_token,
          account_status: data?.account_status
        };
      }

      // If response is OK but body was empty (e.g. HTTP 204 or 200 without content)
      if (!data) {
        return {
          status: 'success',
          code: response.status,
          message: 'Berhasil'
        } as unknown as ApiResponse<T>;
      }

      return data;
    } catch (err: any) {
      console.error(`API Error [${endpoint}]:`, err);
      return {
        status: 'error',
        code: 500,
        message: 'Gagal terhubung ke backend server PRISMA POS. Pastikan server lokal aktif di port 5001.'
      };
    }
  }

  // -----------------------------------------------------------------------------------------------
  // SYSTEM & DATABASE STATUS
  // -----------------------------------------------------------------------------------------------

  public async ping(): Promise<{ success: boolean; latency: number; message: string; timestamp?: string }> {
    const start = Date.now();
    try {
      const res = await this.request<{ database: string; latency_ms: number; timestamp: string }>('/health', {
        method: 'GET'
      });

      const latency = Date.now() - start;

      if (res && res.status === 'success') {
        return {
          success: true,
          latency: res.data?.latency_ms || latency,
          message: 'Koneksi Backend PRISMA POS & Aiven MySQL Aktif!',
          timestamp: res.data?.timestamp || new Date().toISOString()
        };
      }

      return {
        success: false,
        latency,
        message: res.message || 'Database Aiven MySQL tidak merespons.'
      };
    } catch (err: any) {
      return {
        success: false,
        latency: Date.now() - start,
        message: err.message || 'Gagal terhubung ke server backend.'
      };
    }
  }

  public async getDbStatus(): Promise<ApiResponse<{
    database_engine: string;
    host: string;
    port: number;
    database_name: string;
    ssl_mode: string;
    ssl_active: boolean;
    latency_ms: number;
    mysql_version: string;
    table_counts: Record<string, number>;
    connection_pool: { connection_limit: number; status: string };
  }>> {
    return this.request('/admin/db-status', { method: 'GET' });
  }

  // -----------------------------------------------------------------------------------------------
  // MASTER DATA ORGANISASI
  // -----------------------------------------------------------------------------------------------

  async getRegions(): Promise<ApiResponse<Region[]>> {
    return this.request<Region[]>('/regions', { method: 'GET' });
  }

  async getOffices(regionId?: string): Promise<ApiResponse<Office[]>> {
    const q = regionId ? `?region_id=${encodeURIComponent(regionId)}` : '';
    return this.request<Office[]>(`/offices${q}`, { method: 'GET' });
  }

  async getRoles(): Promise<ApiResponse<Role[]>> {
    return this.request<Role[]>('/roles', { method: 'GET' });
  }

  // -----------------------------------------------------------------------------------------------
  // AUTHENTICATION & MFA
  // -----------------------------------------------------------------------------------------------

  async login(params: { email: string; password: string }): Promise<ApiResponse<{ token?: string; user?: User }>> {
    const res = await this.request<{ token?: string; user?: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(params)
    });

    if (res.status === 'success' && res.data?.token && res.data?.user) {
      this.setStoredToken(res.data.token);
      this.setStoredUser(res.data.user);
    }

    return res;
  }

  async verifyMfa(params: { challenge_token: string; otp_code: string }): Promise<ApiResponse<{ token: string; user: User }>> {
    const res = await this.request<{ token: string; user: User }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(params)
    });

    if (res.status === 'success' && res.data) {
      this.setStoredToken(res.data.token);
      this.setStoredUser(res.data.user);
    }

    return res;
  }

  async resendMfa(params: { challenge_token: string }): Promise<ApiResponse<any>> {
    return this.request('/auth/mfa/resend', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async setupMfa(): Promise<ApiResponse<{ secret: string; qr_uri: string; backup_codes: string[] }>> {
    return this.request('/auth/mfa/setup', { method: 'POST' });
  }

  async confirmMfa(params: { code: string }): Promise<ApiResponse<any>> {
    return this.request('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async register(params: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    position?: string;
    nip?: string;
    nopen?: string;
    user_type?: string;
    region_id?: string;
    office_id?: string;
  }): Promise<ApiResponse<{ user_id: string; account_status: string }>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async getProfile(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me', { method: 'GET' });
  }

  // -----------------------------------------------------------------------------------------------
  // TICKETS
  // -----------------------------------------------------------------------------------------------

  async getTickets(params?: {
    status?: TicketStatus | 'all';
    priority?: TicketPriority | 'all';
    category?: string;
    assigned_upt?: string;
    search?: string;
    page?: number;
    limit?: number;
    requester_email?: string;
  }): Promise<ApiResponse<{ tickets: Ticket[]; total: number; page: number; limit: number; total_pages: number }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          query.set(k, String(v));
        }
      });
    }

    const endpoint = `/tickets${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request(endpoint, { method: 'GET' });
  }

  async getTicketDetail(ticketId: string): Promise<ApiResponse<{ ticket: Ticket; threads: ThreadMessage[] }>> {
    return this.request<{ ticket: Ticket; threads: ThreadMessage[] }>(`/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'GET'
    });
  }

  async trackTicket(ticketId: string, email?: string): Promise<ApiResponse<{ ticket: Ticket; threads: ThreadMessage[] }>> {
    const query = email ? `?email=${encodeURIComponent(email.trim())}` : '';
    return this.request<{ ticket: Ticket; threads: ThreadMessage[] }>(
      `/tickets/track/${encodeURIComponent(ticketId.trim())}${query}`,
      { method: 'GET' }
    );
  }

  async createTicket(payload: {
    subject: string;
    category: string;
    department?: string;
    topic?: string;
    location?: string;
    region_id?: string;
    office_id?: string;
    description: string;
    priority?: TicketPriority;
    channel?: 'web' | 'email';
    requester_name?: string;
    requester_email?: string;
    requester_phone?: string;
    requester_nip?: string;
    assigned_upt?: string;
    assigned_operator?: string;
    attachments?: Array<{ name: string; size?: string; type?: string; dataUrl?: string; url?: string }>;
  }): Promise<ApiResponse<Ticket>> {
    return this.request<Ticket>('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateTicketStatus(payload: {
    ticket_id: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    assigned_upt?: string;
    assigned_operator?: string;
    note?: string;
    is_archived?: boolean | number;
  }): Promise<ApiResponse<Ticket>> {
    return this.request<Ticket>(`/tickets/${encodeURIComponent(payload.ticket_id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async archiveTicket(ticketId: string, archive = true): Promise<ApiResponse<Ticket>> {
    return this.updateTicketStatus({
      ticket_id: ticketId,
      is_archived: archive ? 1 : 0,
      ...(archive ? { status: 'closed' } : { status: 'in_progress' })
    });
  }

  async addThreadMessage(payload: {
    ticket_id: string;
    message: string;
    visibility?: 'public' | 'internal';
    sender_name?: string;
    sender_id?: string;
    sender_role?: string;
    sender_email?: string;
  }): Promise<ApiResponse<ThreadMessage>> {
    const mutexKey = `${payload.ticket_id}:${payload.message.trim()}`;
    if (this.inFlightThreads.has(mutexKey)) {
      return this.inFlightThreads.get(mutexKey)!;
    }

    const promise = (async () => {
      try {
        const res = await this.request<ThreadMessage>(`/tickets/${encodeURIComponent(payload.ticket_id)}/threads`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return res;
      } finally {
        setTimeout(() => this.inFlightThreads.delete(mutexKey), 4000);
      }
    })();

    this.inFlightThreads.set(mutexKey, promise);
    return promise;
  }

  // -----------------------------------------------------------------------------------------------
  // ADMIN APPROVALS
  // -----------------------------------------------------------------------------------------------

  async getApprovals(params?: { status?: string; search?: string }): Promise<ApiResponse<RegistrationApproval[]>> {
    const query = new URLSearchParams();
    if (params) {
      if (params.status) query.set('status', params.status);
      if (params.search) query.set('search', params.search);
    }
    return this.request<RegistrationApproval[]>(`/admin/approvals${query.toString() ? `?${query.toString()}` : ''}`, {
      method: 'GET'
    });
  }

  async approveRegistration(id: string, payload: { role?: string; data_scope?: string; region_id?: string; office_id?: string } = {}): Promise<ApiResponse<any>> {
    return this.request(`/admin/approvals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async rejectRegistration(id: string, reason: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/approvals/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // -----------------------------------------------------------------------------------------------
  // ADMIN USER MANAGEMENT & GRANULAR ACCESS
  // -----------------------------------------------------------------------------------------------

  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>('/admin/users', { method: 'GET' });
  }

  async createUser(payload: {
    name: string;
    email: string;
    password?: string;
    role: any;
    data_scope?: string;
    region_id?: string;
    office_id?: string;
    position?: string;
    upt_unit?: string;
    nip?: string;
    department?: string;
    phone_number?: string;
    role_title?: string;
    avatar_url?: string;
    [key: string]: any;
  }): Promise<ApiResponse<User>> {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateUserRole(payload: {
    target_user_id: string;
    name?: string;
    role?: any;
    new_role?: any;
    data_scope?: string;
    region_id?: string;
    office_id?: string;
    position?: string;
    account_status?: string;
    is_active?: boolean;
    reset_password?: string;
    role_title?: string;
    new_upt_unit?: string;
    [key: string]: any;
  }): Promise<ApiResponse<User>> {
    return this.request<User>(`/admin/users/${encodeURIComponent(payload.target_user_id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async getUserPermissions(userId: string): Promise<ApiResponse<{ user: User; permissions: Permission[]; allowedCodes: string[] }>> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/permissions`, { method: 'GET' });
  }

  async updateUserPermissions(userId: string, overrides: Array<{ permission_id: number; effect: 'ALLOW' | 'DENY' | 'INHERIT' }>): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ overrides })
    });
  }

  async suspendUser(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/suspend`, { method: 'POST' });
  }

  async activateUser(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/activate`, { method: 'POST' });
  }

  async resetUserMfa(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/reset-mfa`, { method: 'POST' });
  }

  async deleteUser(userId: string): Promise<ApiResponse<boolean>> {
    const res = await this.request(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
    return {
      status: res.status,
      code: res.code,
      message: res.message,
      data: res.status === 'success'
    };
  }

  // -----------------------------------------------------------------------------------------------
  // ADMIN FEATURES & AUDIT
  // -----------------------------------------------------------------------------------------------

  async getAuditLog(params?: { limit?: number; action?: string }): Promise<ApiResponse<AuditLogItem[]>> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.action) query.set('action', params.action);
    return this.request<AuditLogItem[]>(`/admin/audit-logs${query.toString() ? `?${query.toString()}` : ''}`, { method: 'GET' });
  }

  async getFeatureFlags(): Promise<ApiResponse<any>> {
    return this.request('/admin/features', { method: 'GET' });
  }

  async updateFeatureFlags(feature_flags: any): Promise<ApiResponse<any>> {
    return this.request('/admin/features', {
      method: 'PUT',
      body: JSON.stringify({ feature_flags })
    });
  }

  // -----------------------------------------------------------------------------------------------
  // ANALYTICS & MONITORING
  // -----------------------------------------------------------------------------------------------

  async getAnalytics(): Promise<ApiResponse<any>> {
    return this.request('/analytics', { method: 'GET' });
  }

  async getOperatorProductivity(): Promise<ApiResponse<OperatorProductivityItem[]>> {
    return this.request<OperatorProductivityItem[]>('/analytics/operator-productivity', { method: 'GET' });
  }

  // -----------------------------------------------------------------------------------------------
  // TICKET REOPEN WORKFLOW
  // -----------------------------------------------------------------------------------------------

  async requestTicketReopen(ticketId: string, reason: string): Promise<ApiResponse<any>> {
    return this.request(`/tickets/${encodeURIComponent(ticketId)}/request-reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async reviewTicketReopen(
    ticketId: string, 
    action: 'APPROVE' | 'REJECT', 
    note?: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/tickets/${encodeURIComponent(ticketId)}/reopen-review`, {
      method: 'POST',
      body: JSON.stringify({ action, note })
    });
  }

  async getTicketReopenRequests(ticketId: string): Promise<ApiResponse<TicketReopenRequest[]>> {
    return this.request<TicketReopenRequest[]>(`/tickets/${encodeURIComponent(ticketId)}/reopen-requests`, {
      method: 'GET'
    });
  }

  // -----------------------------------------------------------------------------------------------
  // TELEGRAM BOT GATEWAY
  // -----------------------------------------------------------------------------------------------

  async getTelegramStatus(): Promise<ApiResponse<any>> {
    return this.request<any>('/admin/telegram/status', { method: 'GET' });
  }

  async testTelegramNotification(): Promise<ApiResponse<any>> {
    return this.request<any>('/admin/telegram/test', { method: 'POST', body: JSON.stringify({}) });
  }
}

export const apiService = new PosoApiService();
export default apiService;
