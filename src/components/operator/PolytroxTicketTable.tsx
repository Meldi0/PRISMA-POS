import React from 'react';
import { Ticket, TicketStatus } from '../../types';
import { MoreVertical, ArrowUpDown, Flame, AlertTriangle, Globe, Mail, ChevronRight } from 'lucide-react';

interface PolytroxTicketTableProps {
  tickets: Ticket[];
  selectedTicketId: string | null;
  onSelectTicket: (id: string) => void;
  activeFilter: string;
  onFilterChange: (f: string) => void;
  counts: {
    all: number;
    open: number;
    in_progress: number;
    urgent: number;
    waiting: number;
    closed: number;
  };
}

export const PolytroxTicketTable: React.FC<PolytroxTicketTableProps> = ({
  tickets,
  selectedTicketId,
  onSelectTicket,
  activeFilter,
  onFilterChange,
  counts
}) => {
  const filterTabs = [
    { id: 'all', label: 'Semua Tiket', count: counts.all },
    { id: 'open', label: 'Open (Baru)', count: counts.open },
    { id: 'urgent', label: 'Urgent SLA', count: counts.urgent },
    { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { id: 'waiting', label: 'Waiting', count: counts.waiting },
    { id: 'closed', label: 'Closed', count: counts.closed }
  ];

  const getStatusBadge = (st: TicketStatus, isSelected: boolean) => {
    if (isSelected) {
      return (
        <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-white text-[#E75A38] shadow-sm uppercase tracking-wide">
          {st.replace('_', ' ')}
        </span>
      );
    }

    switch (st) {
      case 'open':
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-sky-500 text-white shadow-xs uppercase tracking-wide">Open</span>;
      case 'in_progress':
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-indigo-500 text-white shadow-xs uppercase tracking-wide">In Progress</span>;
      case 'waiting':
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500 text-white shadow-xs uppercase tracking-wide">Waiting</span>;
      case 'closed':
        return <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white shadow-xs uppercase tracking-wide">Closed</span>;
    }
  };

  const getPriorityText = (pr: string, isSelected: boolean) => {
    if (isSelected) {
      return <span className="font-bold text-white flex items-center gap-1">{pr === 'Urgent' && <Flame className="w-3.5 h-3.5" />}{pr} priority</span>;
    }
    if (pr === 'Urgent') {
      return <span className="font-bold text-[#E75A38] flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> Urgent (4 Jam)</span>;
    }
    if (pr === 'High') {
      return <span className="font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> High (8 Jam)</span>;
    }
    return <span className="text-[#6E6660] font-medium">{pr} delivery</span>;
  };

  return (
    <div className="space-y-3">
      {/* Title & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <h2 className="text-xl font-black text-[#2D2622] tracking-tight">
          Antrean Tiket (Tickets)
        </h2>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterChange(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === tab.id
                  ? 'bg-[#E75A38] text-white shadow-sm'
                  : 'bg-white text-[#8C847E] hover:text-[#2D2622] hover:bg-[#F5EFE9] border border-[#F0E8E1]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`ml-1.5 text-[10px] opacity-80`}>({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="space-y-2">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-5 py-2 text-[11px] font-bold text-[#8C847E] uppercase tracking-wider">
          <div className="col-span-3 flex items-center gap-1">
            <span>Ticket Code</span>
          </div>
          <div className="col-span-3 flex items-center gap-1">
            <span>Priority</span>
            <ArrowUpDown className="w-3 h-3" />
          </div>
          <div className="col-span-2">
            <span>Kategori</span>
          </div>
          <div className="col-span-2">
            <span>Pelapor / UPT</span>
          </div>
          <div className="col-span-2 text-right">
            <span>Status</span>
          </div>
        </div>

        {/* Table Rows */}
        {tickets.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-[#F0E8E1] text-center text-[#8C847E] shadow-card-soft">
            <p className="font-bold text-sm">Tidak ada tiket dalam antrean ini.</p>
            <p className="text-xs mt-1">Ubah filter status atau segarkan data.</p>
          </div>
        ) : (
          tickets.map(ticket => {
            const isSelected = selectedTicketId === ticket.ticket_id;
            return (
              <div
                key={ticket.ticket_id}
                onClick={() => onSelectTicket(ticket.ticket_id)}
                className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? 'active-row-highlight scale-[1.01]'
                    : 'bg-white hover:bg-[#FDFBF9] text-[#2D2622] border border-[#F0E8E1] shadow-card-soft hover:shadow-md'
                }`}
              >
                {/* 1. Ticket Code */}
                <div className="col-span-3 font-mono font-bold text-xs truncate flex items-center gap-2">
                  {ticket.channel === 'email' ? (
                    <Mail className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#E75A38]'}`} />
                  ) : (
                    <Globe className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#E75A38]'}`} />
                  )}
                  <span className="truncate">{ticket.ticket_id}</span>
                </div>

                {/* 2. Priority */}
                <div className="col-span-3 text-xs">
                  {getPriorityText(ticket.priority, isSelected)}
                </div>

                {/* 3. Category */}
                <div className={`col-span-2 text-xs truncate font-medium ${isSelected ? 'text-white/90' : 'text-[#6E6660]'}`}>
                  {ticket.category}
                </div>

                {/* 4. Requester / UPT */}
                <div className={`col-span-2 text-xs truncate ${isSelected ? 'text-white/90' : 'text-[#6E6660]'}`}>
                  <span className="font-semibold">{ticket.assigned_upt || ticket.requester_email.split('@')[0]}</span>
                </div>

                {/* 5. Status & Menu */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {getStatusBadge(ticket.status, isSelected)}
                  <MoreVertical className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white/80' : 'text-[#A89F99]'}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
