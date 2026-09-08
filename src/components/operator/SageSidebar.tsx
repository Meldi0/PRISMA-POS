import React from 'react';
import { 
  LayoutDashboard, 
  ListFilter, 
  BarChart3, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Database, 
  LogOut, 
  Headphones, 
  Search,
  Compass,
  X,
  Archive,
  UserCheck,
  ShieldAlert,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';

export type DashboardViewType = 
  | 'tickets' 
  | 'archive' 
  | 'track' 
  | 'users' 
  | 'approvals' 
  | 'audit_log' 
  | 'datasource' 
  | 'settings' 
  | 'reports' 
  | 'kanban' 
  | 'table';

interface SageSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: DashboardViewType;
  onViewChange: (view: DashboardViewType) => void;
  ticketCounts?: {
    total: number;
    open: number;
    in_progress: number;
    waiting: number;
    closed: number;
    archived?: number;
    active?: number;
  };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const SageSidebar: React.FC<SageSidebarProps> = ({
  collapsed,
  onToggle,
  activeView,
  onViewChange,
  ticketCounts,
  mobileOpen = false,
  onMobileClose
}) => {
  const { user, logout, hasPermission } = useAuth();
  const [pendingApprovals, setPendingApprovals] = React.useState<number>(0);

  // Poll pending approvals if user has approve permission
  React.useEffect(() => {
    if (hasPermission('user.approve')) {
      apiService.getApprovals({ status: 'PENDING' }).then(res => {
        if (res.status === 'success' && res.data) {
          setPendingApprovals(res.data.length);
        }
      }).catch(() => {});
    }
  }, [hasPermission]);

  const getInitials = (name?: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getRoleLabel = (r?: string) => {
    switch (r) {
      case 'ADMIN':
      case 'ADMIN_PUSAT':
      case 'admin':
        return 'Admin';
      case 'PETUGAS_UPT':
      case 'OPERATOR':
      case 'operator':
      case 'upt':
        return 'Petugas UPT Pusat';
      case 'UPT_LUAR':
      case 'PELAPOR':
      case 'USER_REGIONAL':
      case 'USER_CABANG':
      case 'pengguna_umum':
        return 'UPT Luar';
      default:
        return 'UPT Luar';
    }
  };

  const isPelapor = user?.role === 'UPT_LUAR' || user?.role === 'PELAPOR' || user?.role === 'pengguna_umum' || user?.role === 'USER_CABANG' || user?.role === 'USER_REGIONAL';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ADMIN_PUSAT' || user?.role === 'admin';
  const canViewTickets = hasPermission('ticket.view') || hasPermission('ticket.view_own') || hasPermission('ticket.view_all');

  const navItems = [
    ...(canViewTickets ? [
      { 
        id: 'tickets' as DashboardViewType, 
        icon: ListFilter, 
        label: isPelapor ? 'Tiket Saya / Kantor' : 'Semua Tiket',
        badge: ticketCounts ? (ticketCounts.active ?? (ticketCounts.open + ticketCounts.in_progress + ticketCounts.waiting)) : undefined 
      },
      { 
        id: 'archive' as DashboardViewType, 
        icon: Archive, 
        label: isPelapor ? 'Riwayat Selesai' : 'Arsip Tiket',
        badge: ticketCounts ? (ticketCounts.archived ?? ticketCounts.closed) : undefined
      },
      { 
        id: 'track' as DashboardViewType, 
        icon: Compass, 
        label: 'Lacak Tiket' 
      },
    ] : []),
    ...((hasPermission('sla.view') || hasPermission('operator.stats_view')) ? [
      { 
        id: 'reports' as DashboardViewType, 
        icon: BarChart3, 
        label: 'Monitoring Tiket & SLA' 
      },
    ] : []),
    ...(hasPermission('user.approve') || hasPermission('approval.view') || hasPermission('approval.manage') ? [
      { 
        id: 'approvals' as DashboardViewType, 
        icon: UserCheck, 
        label: 'Persetujuan Registrasi',
        badge: pendingApprovals > 0 ? pendingApprovals : undefined
      },
    ] : []),
    ...((hasPermission('user.view') && isAdmin) ? [
      { 
        id: 'users' as DashboardViewType, 
        icon: Users, 
        label: 'Manajemen Staf & Hak Akses' 
      },
    ] : []),
    ...(hasPermission('audit_log.view') || hasPermission('audit.view') ? [
      { 
        id: 'audit_log' as DashboardViewType, 
        icon: Shield, 
        label: 'Log Audit Keamanan' 
      },
    ] : []),
    ...(isAdmin ? [
      { 
        id: 'datasource' as DashboardViewType, 
        icon: Database, 
        label: 'Database Aiven' 
      },
    ] : []),
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#083342] text-white select-none overflow-hidden">
      {/* Logo Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-[10px] bg-white/10 p-1 flex items-center justify-center flex-shrink-0 shadow-sm border border-white/15">
            <img src="/prisma-pos-logo.png" alt="PRISMA POS Logo" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-[15px] font-black text-white leading-tight tracking-tight whitespace-nowrap">PRISMA POS</p>
              <p className="text-[9px] text-[#38BDF8] font-bold uppercase tracking-wider whitespace-nowrap">Integrated Helpdesk</p>
            </div>
          )}
        </div>

        {/* Mobile Close */}
        {mobileOpen && onMobileClose && (
          <button onClick={onMobileClose} className="p-1 rounded-lg text-white/60 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map(({ id, icon: Icon, label, badge }) => {
          const isActive = activeView === id || (id === 'tickets' && (activeView === 'kanban' || activeView === 'table'));
          return (
            <button
              key={id}
              onClick={() => {
                onViewChange(id);
                if (mobileOpen && onMobileClose) onMobileClose();
              }}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 group relative cursor-pointer ${
                isActive
                  ? 'bg-[#199FB1] text-white shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} className="flex-shrink-0" />
              
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="text-[13px] font-semibold truncate text-left">{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-[#0D5C75]' : 'bg-white/20 text-white'
                    }`}>
                      {badge}
                    </span>
                  )}
                </div>
              )}

              {/* Tooltip on Mini-rail collapse */}
              {collapsed && (
                <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-[#0D5C75] text-white text-[12px] font-medium rounded-[6px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-md z-50">
                  {label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="border-t border-white/10 p-3 flex-shrink-0">
        <div className={`flex items-center gap-3 px-2 py-2 rounded-[10px] hover:bg-white/10 transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-[#199FB1] flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 shadow-xs">
            {getInitials(user?.name)}
          </div>
          
          {!collapsed && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-[13px] font-semibold text-white truncate">{user?.name || 'Ahmad Operator'}</p>
              <p className="text-[11px] text-[#38BDF8] truncate font-semibold">
                {getRoleLabel(user?.role)} • <span className="font-mono text-[9px] text-[#BAE6FD]">{user?.data_scope || 'OFFICE'}</span>
              </p>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={logout}
              className="p-1 rounded text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Keluar"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Collapse Toggle Button */}
      <button
        onClick={onToggle}
        className="hidden lg:flex absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-[#083342] border border-white/20 items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all shadow-sm z-30 cursor-pointer"
        title={collapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Slide-out Drawer */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-50 w-64 lg:hidden transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside
        className="hidden lg:flex flex-col transition-all duration-200 ease-in-out flex-shrink-0 relative z-30"
        style={{ width: collapsed ? 72 : 240 }}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default SageSidebar;
