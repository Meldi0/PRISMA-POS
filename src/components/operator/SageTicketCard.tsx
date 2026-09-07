import React from 'react';
import { Ticket, TicketStatus } from '../../types';
import { PriorityBadge } from '../ui/Badge';
import { SlaCountdown } from '../features/SlaCountdown';
import { parseTicketDetails } from '../../utils/ticketFormatter';
import { ArrowRight, CheckCheck, MapPin, Building2, Archive, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SageTicketCardProps {
  ticket: Ticket;
  onClick: (ticket: Ticket) => void;
  onStatusChange?: (ticket: Ticket, newStatus: TicketStatus) => void;
  isDragging?: boolean;
}

export const SageTicketCard: React.FC<SageTicketCardProps> = ({
  ticket,
  onClick,
  onStatusChange,
  isDragging = false
}) => {
  const { user, hasPermission } = useAuth();
  const isPelapor = user?.role === 'UPT_LUAR' || user?.role === 'PELAPOR' || user?.role === 'pengguna_umum' || user?.role === 'USER_CABANG' || user?.role === 'USER_REGIONAL';
  const canChangeStatus = !isPelapor && Boolean(
    user?.role === 'ADMIN' || 
    user?.role === 'PETUGAS_UPT' || 
    user?.role === 'ADMIN_PUSAT' || 
    user?.role === 'OPERATOR' ||
    user?.role === 'admin' ||
    user?.role === 'operator' ||
    user?.role === 'upt' ||
    hasPermission('ticket.change_status') ||
    hasPermission('ticket.resolve') ||
    hasPermission('ticket.close')
  );

  const parsed = parseTicketDetails(ticket.description, ticket.category);

  const getCategoryColor = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('operasi') || c.includes('ops')) return '#F58A61';
    if (c.includes('cgs') || c.includes('sarana')) return '#0D5C75';
    if (c.includes('security') || c.includes('keamanan')) return '#DC2626';
    if (c.includes('quality') || c.includes('qc')) return '#8B5CF6';
    if (c.includes('ti') || c.includes('it') || c.includes('informasi')) return '#199FB1';
    return '#64748B';
  };

  const getInitials = (name?: string) => {
    if (!name) return 'UN';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleProcess = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStatusChange) {
      if (ticket.status === 'open') onStatusChange(ticket, 'in_progress');
      else if (ticket.status === 'in_progress') onStatusChange(ticket, 'waiting');
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStatusChange) {
      onStatusChange(ticket, 'closed');
    }
  };

  return (
    <div
      onClick={() => onClick(ticket)}
      className={`
        bg-white rounded-[16px] p-4 border border-[#E2E8F0]/80 cursor-pointer
        transition-all duration-150 select-none group
        hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:scale-[1.01] hover:border-[#A5D1E1]
        ${isDragging ? 'shadow-xl opacity-70 rotate-1' : 'shadow-[0_2px_8px_rgba(15,23,42,0.04)]'}
      `}
    >
      {/* Top row: Category dot & Priority Badge */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: getCategoryColor(ticket.category) }}
          />
          <span className="text-[11px] font-semibold text-[#64748B] truncate">
            {parsed.departmentAndTopic || ticket.category}
          </span>
        </div>
        <PriorityBadge priority={ticket.priority} />
      </div>

      {/* Title / Subject */}
      <h4 className="text-[14px] font-bold text-[#0F172A] leading-snug line-clamp-2 mb-1.5 group-hover:text-[#0D5C75] transition-colors">
        {ticket.subject}
      </h4>

      {/* Office & Region Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {ticket.office_name && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#0D5C75] border border-[#CBD5E1]/60">
            <Building2 size={11} className="text-[#0D5C75] shrink-0" />
            <span>{ticket.office_name.replace(' 40000', '').replace(' 16000', '').replace(' 40500', '')}</span>
          </span>
        )}
        {(ticket.region_code || ticket.region_name) && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAF4F8] text-[#199FB1] border border-[#199FB1]/30">
            <MapPin size={11} className="text-[#199FB1] shrink-0" />
            <span>{ticket.region_code || ticket.region_id}</span>
          </span>
        )}
      </div>

      {/* Reporter & Location */}
      <p className="text-[12px] text-[#64748B] mb-3 truncate">
        {ticket.requester_name || 'Pelapor'} · {parsed.location || ticket.assigned_upt || 'Unit Kantor'}
      </p>

      {/* SLA Countdown Badge */}
      <div className="mb-3">
        <SlaCountdown
          slaTarget={ticket.sla_due_at || ticket.created_at}
          isClosed={ticket.status === 'closed'}
          compact
        />
      </div>

      {/* Bottom row: Assigned Technician Avatar & Fast Action Button */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#F1F5F9]">
        {ticket.assigned_upt ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-2xs"
              style={{ backgroundColor: '#0D5C75' }}
            >
              {getInitials(ticket.assigned_upt)}
            </div>
            <span className="text-[11px] font-semibold text-[#64748B] truncate max-w-[110px]" title={ticket.assigned_upt}>
              {ticket.assigned_upt}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-[#CBD5E1] italic">Belum didisposisi</span>
        )}

        {canChangeStatus && (
          <div className="flex items-center gap-1">
            {ticket.status === 'open' && (
              <button
                type="button"
                onClick={handleProcess}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-[#EAF4F8] text-[#0D5C75] hover:bg-[#0D5C75] hover:text-white transition-all cursor-pointer"
              >
                <ArrowRight size={12} />
                <span>Proses</span>
              </button>
            )}

            {ticket.status === 'in_progress' && (
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-[#ECFDF5] text-[#059669] hover:bg-[#059669] hover:text-white transition-all cursor-pointer"
              >
                <CheckCheck size={12} />
                <span>Selesai</span>
              </button>
            )}

            {ticket.status === 'closed' && onStatusChange && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(ticket, 'in_progress');
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-[#EFF6FF] border border-[#BAE6FD] text-[#0284C7] hover:bg-[#0284C7] hover:text-white transition-all cursor-pointer shadow-2xs"
                title="Aktifkan kembali tiket ini ke antrean kerja aktif"
              >
                <RotateCcw size={11} />
                <span>Buka Kembali</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SageTicketCard;
