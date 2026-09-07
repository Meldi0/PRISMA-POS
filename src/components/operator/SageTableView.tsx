import React, { useState } from 'react';
import { Ticket, TicketStatus } from '../../types';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { SlaCountdown } from '../features/SlaCountdown';
import { parseTicketDetails } from '../../utils/ticketFormatter';
import { Eye, ArrowUpDown, ChevronRight, Inbox, Archive, RotateCcw, Building2, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SageTableViewProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
  onStatusChange?: (ticket: Ticket, newStatus: TicketStatus) => void;
}

export const SageTableView: React.FC<SageTableViewProps> = ({
  tickets,
  onTicketClick,
  onStatusChange
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

  const [sortField, setSortField] = useState<'ticket_id' | 'created_at' | 'priority'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(p => !p);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedTickets = [...tickets].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'ticket_id') cmp = a.ticket_id.localeCompare(b.ticket_id);
    else if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else if (sortField === 'priority') cmp = a.priority.localeCompare(b.priority);
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 shadow-[0_2px_8px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col h-full min-h-0">
      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[12px] font-bold text-[#64748B] select-none">
              <th 
                onClick={() => handleSort('ticket_id')}
                className="px-4 py-3.5 cursor-pointer hover:text-[#0D5C75]"
              >
                <div className="flex items-center gap-1">
                  <span>ID Tiket</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="px-4 py-3.5">Status</th>
              <th 
                onClick={() => handleSort('priority')}
                className="px-4 py-3.5 cursor-pointer hover:text-[#0D5C75]"
              >
                <div className="flex items-center gap-1">
                  <span>Prioritas</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="px-4 py-3.5">Subjek & Bidang</th>
              <th className="px-4 py-3.5">Pelapor & Lokasi</th>
              <th className="px-4 py-3.5">Target SLA</th>
              <th 
                onClick={() => handleSort('created_at')}
                className="px-4 py-3.5 cursor-pointer hover:text-[#0D5C75]"
              >
                <div className="flex items-center gap-1">
                  <span>Tanggal</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="px-4 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E2E8F0]/60 text-[13px]">
            {sortedTickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#94A3B8]">
                  <Inbox size={28} className="mx-auto mb-2 text-[#CBD5E1]" />
                  <p className="font-semibold">Tidak ada tiket yang cocok dengan filter</p>
                </td>
              </tr>
            ) : (
              sortedTickets.map((ticket) => {
                const parsed = parseTicketDetails(ticket.description, ticket.category, ticket.attachments);
                return (
                  <tr
                    key={ticket.ticket_id}
                    onClick={() => onTicketClick(ticket)}
                    className="hover:bg-[#EAF4F8]/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[#0D5C75] whitespace-nowrap">
                      #{ticket.ticket_id}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={ticket.status} />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <PriorityBadge priority={ticket.priority} />
                    </td>

                    <td className="px-4 py-3 min-w-[200px] max-w-[280px]">
                      <p className="font-bold text-[#0F172A] truncate group-hover:text-[#0D5C75] transition-colors">
                        {ticket.subject}
                      </p>
                      <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                        {parsed.departmentAndTopic || ticket.category}
                      </p>
                    </td>

                    <td className="px-4 py-3 min-w-[170px] max-w-[240px]">
                      <p className="font-semibold text-[#0F172A] truncate">{ticket.requester_name || 'Pelapor'}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {ticket.office_name && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#0D5C75] border border-[#CBD5E1]/60">
                            <Building2 size={10} className="text-[#0D5C75] shrink-0" />
                            <span>{ticket.office_name.replace(' 40000', '').replace(' 16000', '').replace(' 40500', '')}</span>
                          </span>
                        )}
                        {(ticket.region_code || ticket.region_name) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAF4F8] text-[#199FB1] border border-[#199FB1]/30">
                            <MapPin size={10} className="text-[#199FB1] shrink-0" />
                            <span>{ticket.region_code || ticket.region_id}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">{parsed.location || 'Unit Kantor'}</p>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <SlaCountdown
                        slaTarget={ticket.sla_due_at || ticket.created_at}
                        isClosed={ticket.status === 'closed'}
                        compact
                      />
                    </td>

                    <td className="px-4 py-3 text-[12px] text-[#64748B] whitespace-nowrap">
                      {new Date(ticket.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {ticket.status === 'closed' && canChangeStatus && onStatusChange && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(ticket, 'in_progress');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-[#EFF6FF] border border-[#BAE6FD] text-[#0284C7] hover:bg-[#0284C7] hover:text-white transition-all shadow-2xs cursor-pointer"
                            title="Buka kembali tiket ini dan kembalikan ke antrean aktif"
                          >
                            <RotateCcw size={12} />
                            <span>Buka Kembali</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onTicketClick(ticket); }}
                          className="p-1.5 rounded-[8px] text-[#64748B] hover:text-[#0D5C75] hover:bg-white transition-all shadow-2xs cursor-pointer"
                          title="Buka Detail Tiket"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-[12px] text-[#64748B]">
        <span>Menampilkan {sortedTickets.length} tiket</span>
        <span>PRISMA POS Workstation</span>
      </div>
    </div>
  );
};

export default SageTableView;
