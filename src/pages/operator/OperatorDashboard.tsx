import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  RefreshCw, 
  Search, 
  Filter, 
  LayoutGrid, 
  TableIcon, 
  Compass, 
  Users, 
  Database,
  BarChart3,
  Calendar,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
  Layers,
  Archive,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { Ticket, TicketStatus, TicketPriority } from '../../types';
import { SageSidebar, DashboardViewType } from '../../components/operator/SageSidebar';
import { SageTopBar } from '../../components/operator/SageTopBar';
import { SageKanbanBoard } from '../../components/operator/SageKanbanBoard';
import { SageTableView } from '../../components/operator/SageTableView';
import { SageTicketDrawer } from '../../components/operator/SageTicketDrawer';
import { SageTicketTrackerView } from '../../components/operator/SageTicketTrackerView';
import { UserManagement } from '../../components/admin/UserManagement';
import { UserApprovalManagement } from '../../components/admin/UserApprovalManagement';
import { AuditLogView } from '../../components/admin/AuditLogView';
import { DataSourceConfig } from '../../components/admin/DataSourceConfig';
import { CommandPalette } from '../../components/features/CommandPalette';
import { OperatorTicketModal } from '../../components/operator/OperatorTicketModal';
import { useToast } from '../../context/ToastContext';
import { soundService } from '../../utils/sound';
import { realtimeService } from '../../services/realtime';
import { FloatingChatBadge } from '../../components/notifications/FloatingChatBadge';

export const OperatorDashboard: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role === 'ADMIN_PUSAT' || user?.role === 'admin';
  const { success, error: toastError, info } = useToast();

  // Navigation & Layout state
  const [activeView, setActiveView] = useState<DashboardViewType>('tickets');
  const [layoutMode, setLayoutMode] = useState<'kanban' | 'table'>('table');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');

  // Tickets & Data state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [modalTicket, setModalTicket] = useState<Ticket | null>(null);

  const prevTicketCountRef = useRef<number>(0);
  const isInitialTicketLoadRef = useRef<boolean>(true);
  const lastTicketTimestampsRef = useRef<Record<string, string>>({});

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Coral FAB auto-collapse state
  const [fabCollapsed, setFabCollapsed] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Request browser notification permission once & set realtime user context
  useEffect(() => {
    soundService.requestNotificationPermission().catch(() => {});
    if (user) {
      realtimeService.setUserContext(user.user_id, user.name);
    }
  }, [user]);

  // Open ticket directly from notifications or floating chat badge
  const handleOpenTicketById = async (ticketId: string) => {
    const found = tickets.find(t => t.ticket_id.toLowerCase() === ticketId.toLowerCase());
    if (found) {
      setSelectedTicket(found);
    } else {
      try {
        const res = await apiService.getTicketDetail(ticketId);
        if (res.status === 'success' && res.data) {
          setSelectedTicket(res.data.ticket);
        }
      } catch (err) {
        toastError('Tiket tidak ditemukan');
      }
    }
  };

  // FAB collapse on scroll
  useEffect(() => {
    const resetIdle = () => {
      setFabCollapsed(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setFabCollapsed(false), 2000);
    };
    window.addEventListener('scroll', resetIdle, { passive: true });
    return () => {
      window.removeEventListener('scroll', resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // Fetch Tickets from Database
  const fetchTickets = async (silent = false) => {
    try {
      if (!silent) setIsSyncing(true);
      const res = await apiService.getTickets();
      if (res && res.status === 'success' && res.data) {
        const newTickets = res.data.tickets || [];
        
        // 1. Check for newly arrived tickets submitted from other devices
        if (!isInitialTicketLoadRef.current && newTickets.length > prevTicketCountRef.current) {
          const newest = newTickets[0];
          soundService.playIncomingMessageSound();
          soundService.notifyBrowser(`Tiket Baru Masuk #${newest.ticket_id}`, `${newest.subject} (${newest.category})`);
          info(`Tiket baru masuk: #${newest.ticket_id} - ${newest.subject}`);
        }

        // 2. Check for updated tickets with new replies from customer
        if (!isInitialTicketLoadRef.current) {
          for (const t of newTickets) {
            const lastUpdated = lastTicketTimestampsRef.current[t.ticket_id];
            if (lastUpdated && lastUpdated !== t.updated_at) {
              apiService.getTicketDetail(t.ticket_id).then(detailRes => {
                if (detailRes.status === 'success' && detailRes.data?.threads) {
                  const threads = detailRes.data.threads;
                  if (threads.length > 0) {
                    const latestMsg = threads[threads.length - 1];
                    const isStaff = (latestMsg.sender_role === 'ADMIN' || latestMsg.sender_role === 'PETUGAS_UPT' || latestMsg.sender_role === 'ADMIN_PUSAT' || latestMsg.sender_role === 'OPERATOR' || latestMsg.sender_role === 'admin' || latestMsg.sender_role === 'operator' || latestMsg.sender_role === 'upt');
                    if (!isStaff) {
                      realtimeService.addNotification({
                        id: `NOTIF-${latestMsg.thread_id || Date.now()}`,
                        ticket_id: t.ticket_id,
                        sender_name: latestMsg.sender_name || t.requester_name || 'Pelapor',
                        sender_role: latestMsg.sender_role || 'UPT_LUAR',
                        message: latestMsg.message,
                        created_at: latestMsg.created_at,
                        is_read: false
                      });
                      soundService.playIncomingMessageSound();
                      soundService.notifyBrowser(`Balasan Baru di #${t.ticket_id}`, `${latestMsg.sender_name}: ${latestMsg.message.slice(0, 60)}`);
                      info(`Pesan baru dari ${latestMsg.sender_name} di #${t.ticket_id}`);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('poso_realtime_chat', { detail: {
                          id: `NOTIF-${latestMsg.thread_id || Date.now()}`,
                          ticket_id: t.ticket_id,
                          sender_name: latestMsg.sender_name || t.requester_name || 'Pelapor',
                          message: latestMsg.message,
                          created_at: latestMsg.created_at,
                          is_read: false
                        }}));
                      }
                    }
                  }
                }
              }).catch(() => {});
            }
            lastTicketTimestampsRef.current[t.ticket_id] = t.updated_at;
          }
        } else {
          newTickets.forEach(t => {
            lastTicketTimestampsRef.current[t.ticket_id] = t.updated_at;
          });
        }

        prevTicketCountRef.current = newTickets.length;
        isInitialTicketLoadRef.current = false;
        setTickets(newTickets);
      }
    } catch (err: any) {
      if (!silent) {
        console.error('Failed to load tickets:', err);
        toastError(err.message || 'Gagal memuat tiket dari database');
      }
    } finally {
      if (!silent) setIsSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets(false);

    // Fast background multi-device auto-sync every 4 seconds
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [user?.email]);

  // Fast Status Change Handler
  // Fast Status Change Handler (Automatic Archiving when status === 'closed')
  const handleStatusChange = async (ticket: Ticket, newStatus: TicketStatus) => {
    const willBeArchived = newStatus === 'closed';

    // Optimistic UI update
    setTickets((prev) =>
      prev.map((t) =>
        t.ticket_id === ticket.ticket_id
          ? {
              ...t,
              status: newStatus,
              is_archived: willBeArchived,
              updated_at: new Date().toISOString()
            }
          : t
      )
    );
    if (selectedTicket?.ticket_id === ticket.ticket_id) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              is_archived: willBeArchived
            }
          : null
      );
    }

    try {
      const res = await apiService.updateTicketStatus({
        ticket_id: ticket.ticket_id,
        status: newStatus
      });

      if (res.status === 'success') {
        if (newStatus === 'closed') {
          success(`Tiket #${ticket.ticket_id} telah selesai & otomatis masuk ke Arsip.`);
        } else if (ticket.status === 'closed') {
          success(`Tiket #${ticket.ticket_id} diaktifkan kembali ke antrean tiket aktif.`);
        } else {
          success(`Tiket #${ticket.ticket_id} diperbarui ke status ${newStatus}.`);
        }
      } else {
        toastError(res.message || 'Gagal memperbarui status');
        fetchTickets();
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi gangguan koneksi');
      fetchTickets();
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (tickets.length === 0) {
      info('Tidak ada data tiket untuk diekspor.');
      return;
    }

    const headers = ['ID Tiket', 'Subjek', 'Kategori', 'Pelapor', 'Email', 'Prioritas', 'Status', 'Unit UPT', 'Tanggal Dibuat'];
    const rows = filteredTickets.map((t) => [
      t.ticket_id,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.requester_name || '').replace(/"/g, '""')}"`,
      t.requester_email,
      t.priority,
      t.status,
      `"${(t.assigned_upt || '').replace(/"/g, '""')}"`,
      new Date(t.created_at).toLocaleString('id-ID'),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PRISMA_POS_Tiket_Ekspor_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Data tiket berhasil diekspor ke CSV.');
  };

  // Automatic Grouping:
  // Active: status !== 'closed' (open, in_progress, waiting)
  // Archived: status === 'closed'
  const activeTickets = tickets.filter((t) => t.status !== 'closed');
  const archivedTickets = tickets.filter((t) => t.status === 'closed');

  // Filtered active tickets (for Semua Tiket workspace)
  const filteredActiveTickets = activeTickets.filter((t) => {
    const matchCat = selectedCategory === 'all' || t.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchStatus = selectedStatus === 'all' || (t.status || 'open') === selectedStatus;
    const matchSearch =
      t.ticket_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.requester_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.requester_email || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchStatus && matchSearch;
  });

  // Filtered archived tickets (Dedicated search for Arsip Tiket, e.g. TICK-20260903-6991, subject, requester, etc.)
  const effectiveArchiveQuery = (archiveSearchQuery || searchQuery).trim().toLowerCase();
  const filteredArchivedTickets = archivedTickets.filter((t) => {
    if (!effectiveArchiveQuery) return true;
    const matchId = t.ticket_id.toLowerCase().includes(effectiveArchiveQuery);
    const matchSub = (t.subject || '').toLowerCase().includes(effectiveArchiveQuery);
    const matchReq =
      (t.requester_name || '').toLowerCase().includes(effectiveArchiveQuery) ||
      (t.requester_email || '').toLowerCase().includes(effectiveArchiveQuery);
    const matchCat = (t.category || '').toLowerCase().includes(effectiveArchiveQuery);
    const matchLoc = (t.location || '').toLowerCase().includes(effectiveArchiveQuery);
    return matchId || matchSub || matchReq || matchCat || matchLoc;
  });

  // Current Working Dataset
  const filteredTickets = activeView === 'archive' ? filteredArchivedTickets : filteredActiveTickets;

  // Calculate Real Stats Strip
  const stats = {
    open: activeTickets.filter((t) => t.status === 'open').length,
    in_progress: activeTickets.filter((t) => t.status === 'in_progress').length,
    waiting: activeTickets.filter((t) => t.status === 'waiting').length,
    urgent: activeTickets.filter((t) => t.priority === 'Urgent').length,
    closed: archivedTickets.length,
    archived: archivedTickets.length,
    active: activeTickets.length,
    total: tickets.length,
  };

  return (
    <div className="flex h-screen bg-[#F4F7F9] text-[#0F172A] font-sans overflow-hidden selection:bg-[#0D5C75] selection:text-white">
      
      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        tickets={tickets}
        onSelectTicket={(t) => setSelectedTicket(t)}
      />

      {/* Left Sidebar */}
      <SageSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
        activeView={activeView}
        onViewChange={(v) => {
          setActiveView(v);
          if (v === 'kanban' || v === 'table') {
            setLayoutMode(v);
          }
        }}
        ticketCounts={stats}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workstation Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Top Header Bar */}
        <SageTopBar
          onMobileMenuToggle={() => setMobileSidebarOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          activeView={activeView}
          onViewChange={(v) => {
            if (v === 'kanban' || v === 'table') {
              setLayoutMode(v);
              if (activeView !== 'tickets' && activeView !== 'archive') {
                setActiveView('tickets');
              }
            } else {
              setActiveView(v);
            }
          }}
          layoutMode={layoutMode}
          onLayoutModeChange={(mode) => {
            setLayoutMode(mode);
            if (activeView !== 'tickets' && activeView !== 'archive') {
              setActiveView('tickets');
            }
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          onRefresh={fetchTickets}
          onExport={handleExportCSV}
          onNewTicketClick={() => window.open('/submit', '_blank')}
          onOpenTicket={handleOpenTicketById}
          isSyncing={isSyncing}
        />

        {/* Scrollable View Area */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
          
          {/* 1. STATS STRIP (6 CHIPS) */}
          {(activeView === 'tickets' || activeView === 'archive' || activeView === 'kanban' || activeView === 'table') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 flex-shrink-0">
              {[
                { label: 'Open', value: stats.open, color: '#0284C7', bg: '#EFF6FF', border: '#BAE6FD' },
                { label: 'In Progress', value: stats.in_progress, color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
                { label: 'Menunggu', value: stats.waiting, color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Urgent Aktif', value: stats.urgent, color: '#F58A61', bg: '#FFF7ED', border: '#FFEDD5' },
                { label: 'Arsip Selesai', value: stats.closed, color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
                { label: 'Total Tiket', value: stats.total, color: '#0D5C75', bg: '#EAF4F8', border: '#A5D1E1' },
              ].map(({ label, value, color, bg, border }) => (
                <div
                  key={label}
                  className="rounded-[12px] border p-3 flex flex-col gap-0.5 shadow-2xs transition-all"
                  style={{ backgroundColor: bg, borderColor: border }}
                >
                  <span className="text-[22px] font-bold leading-tight font-mono" style={{ color }}>
                    {value}
                  </span>
                  <span className="text-[11px] font-semibold text-[#64748B]">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* 2. DYNAMIC WORKSPACE VIEW ROUTING */}
          <div className="flex-1 min-h-0">
            {/* VIEW: SEMUA TIKET AKTIF */}
            {(activeView === 'tickets' || activeView === 'kanban' || activeView === 'table') && (
              <>
                {layoutMode === 'kanban' ? (
                  <SageKanbanBoard
                    tickets={filteredTickets}
                    onTicketClick={(t) => setSelectedTicket(t)}
                    onStatusChange={handleStatusChange}
                    onNewTicketClick={() => window.open('/submit', '_blank')}
                  />
                ) : (
                  <SageTableView
                    tickets={filteredTickets}
                    onTicketClick={(t) => setSelectedTicket(t)}
                    onStatusChange={handleStatusChange}
                  />
                )}
              </>
            )}

            {/* VIEW: ARSIP TIKET */}
            {activeView === 'archive' && (
              <div className="flex flex-col gap-4 h-full">
                {/* Clean, Premium Archive Header with Dedicated In-Page Search */}
                <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                  {/* Left: Title, Badge & Subtitle */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#059669] shrink-0 shadow-2xs">
                      <Archive size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-[17px] font-bold text-[#0F172A] tracking-tight whitespace-nowrap">
                          Arsip Tiket Selesai
                        </h2>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] shrink-0">
                          {archivedTickets.length} Tiket Tersimpan
                        </span>
                      </div>
                      <p className="text-[12px] text-[#64748B] mt-0.5 truncate">
                        Pencarian dan riwayat seluruh tiket yang telah tuntas ditangani (format tabel arsip).
                      </p>
                    </div>
                  </div>

                  {/* Right: Dedicated Search Input (Standard Tailwind width & padding) */}
                  <div className="w-full md:w-[380px] shrink-0">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                        <Search size={16} />
                      </div>
                      <input
                        type="text"
                        value={archiveSearchQuery}
                        onChange={(e) => setArchiveSearchQuery(e.target.value)}
                        placeholder="Cari ID Tiket (cth: TICK-20260903-6991)..."
                        className="w-full h-10 pl-10 pr-9 bg-[#F8FAFC] border border-[#CBD5E1] rounded-[10px] text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:border-[#0D5C75] focus:ring-2 focus:ring-[#0D5C75]/15 transition-all outline-none"
                      />
                      {archiveSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setArchiveSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                          title="Bersihkan pencarian"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Archive Search Feedback */}
                {archiveSearchQuery && (
                  <div className="flex items-center justify-between px-2 text-[12px] text-[#64748B] flex-shrink-0">
                    <span>
                      Ditemukan <strong className="text-[#0F172A] font-bold">{filteredArchivedTickets.length}</strong> tiket untuk pencarian "<span className="text-[#0D5C75] font-semibold">{archiveSearchQuery}</span>"
                    </span>
                    <button
                      type="button"
                      onClick={() => setArchiveSearchQuery('')}
                      className="text-[#0D5C75] font-semibold hover:underline cursor-pointer"
                    >
                      Reset Pencarian
                    </button>
                  </div>
                )}

                {/* Always Table Format for Archive View */}
                <div className="flex-1 min-h-0">
                  <SageTableView
                    tickets={filteredArchivedTickets}
                    onTicketClick={(t) => setSelectedTicket(t)}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              </div>
            )}

            {activeView === 'track' && (
              <SageTicketTrackerView
                recentTickets={tickets}
              />
            )}

            {activeView === 'approvals' && (
              <UserApprovalManagement />
            )}

            {activeView === 'audit_log' && (
              <AuditLogView />
            )}

            {activeView === 'users' && (hasPermission('user.view') || isAdmin) && (
              <UserManagement />
            )}

            {activeView === 'datasource' && (hasPermission('system.config') || isAdmin) && (
              <DataSourceConfig />
            )}

            {activeView === 'reports' && (
              <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[#EAF4F8] flex items-center justify-center text-[#0D5C75]">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#0F172A]">Laporan Kepatuhan SLA & Kinerja</h3>
                    <p className="text-[12px] text-[#64748B]">Rekapitulasi beban kerja dan waktu penyelesaian tiket</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase">Tingkat Resolusi</span>
                    <p className="text-[24px] font-bold text-[#10B981]">
                      {stats.total > 0 ? Math.round(((stats.closed + stats.archived) / stats.total) * 100) : 100}%
                    </p>
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase">Rata-Rata Respons</span>
                    <p className="text-[24px] font-bold text-[#0D5C75]">≤ 1.8 Jam</p>
                  </div>

                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase">Tiket Lewat SLA</span>
                    <p className="text-[24px] font-bold text-[#059669]">0 Tiket</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating Action Button (FAB) Coral `#F58A61` */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => window.open('/submit', '_blank')}
        className="fixed bottom-6 right-24 z-30 h-13 px-4 rounded-full bg-[#F58A61] hover:bg-[#E77448] text-white shadow-xl shadow-[#F58A61]/35 hidden sm:flex items-center gap-2 font-bold text-sm transition-all cursor-pointer"
        title="Buat Tiket Baru"
      >
        <Plus size={20} />
        {!fabCollapsed && <span className="pr-1 whitespace-nowrap">Tiket Baru</span>}
      </motion.button>

      {/* Floating Realtime Chat Badge (Kanan Bawah) */}
      <FloatingChatBadge onOpenTicket={handleOpenTicketById} />

      {/* Slide-out Ticket Drawer */}
      <SageTicketDrawer
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onStatusChange={handleStatusChange}
        onTicketUpdated={fetchTickets}
      />

      {/* Operator Detail Modal (if opened via legacy trigger) */}
      {modalTicket && (
        <OperatorTicketModal
          ticket={modalTicket}
          onClose={() => setModalTicket(null)}
          onTicketUpdated={() => {
            setModalTicket(null);
            fetchTickets();
          }}
        />
      )}

    </div>
  );
};

export default OperatorDashboard;
