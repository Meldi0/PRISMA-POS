import React, { useState, useEffect } from 'react';
import { Ticket, ThreadMessage, TicketStatus, TicketPriority } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { parseTicketDetails, parseThreadMessage } from '../../utils/ticketFormatter';
import { AttachmentGallery } from '../common/AttachmentGallery';
import { 
  FileText, 
  Send, 
  Lock, 
  Globe, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Building2, 
  User, 
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Save
} from 'lucide-react';

interface PolytroxInspectorProps {
  ticketId: string | null;
  onTicketUpdated: () => void;
}

export const PolytroxInspector: React.FC<PolytroxInspectorProps> = ({
  ticketId,
  onTicketUpdated
}) => {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [threads, setThreads] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Triage state
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('open');
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>('Medium');
  const [selectedUpt, setSelectedUpt] = useState<string>('');

  // Reply / Note modal / drawer state
  const [showReplyDrawer, setShowReplyDrawer] = useState(false);
  const [activeReplyTab, setActiveReplyTab] = useState<'reply' | 'internal_note'>('reply');
  const [replyText, setReplyText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const uptList = [
    'UPT TI & Jaringan',
    'UPT Sarana & Prasarana',
    'UPT Pelayanan & Sistem Informasi',
    'UPT Keuangan & Logistik'
  ];

  const loadTicket = async () => {
    if (!ticketId) return;
    setIsLoading(true);
    try {
      const res = await apiService.getTicketDetail(ticketId);
      if (res.status === 'success' && res.data) {
        setTicket(res.data.ticket);
        setThreads(res.data.threads);
        setSelectedStatus(res.data.ticket.status);
        setSelectedPriority(res.data.ticket.priority);
        setSelectedUpt(res.data.ticket.assigned_upt || '');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  const handleSaveTriage = async () => {
    if (!ticket) return;
    setIsSubmitting(true);
    // Optimistic
    setTicket(prev => prev ? {
      ...prev,
      status: selectedStatus,
      priority: selectedPriority,
      assigned_upt: selectedUpt
    } : null);

    setNotice(`Perubahan status ke [${selectedStatus.toUpperCase()}] & UPT berhasil disimpan!`);
    try {
      await apiService.updateTicketStatus({
        ticket_id: ticket.ticket_id,
        status: selectedStatus,
        priority: selectedPriority,
        assigned_upt: selectedUpt
      });
      await loadTicket();
      onTicketUpdated();
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const content = replyText.trim();
    setReplyText('');
    setNotice('Balasan resmi berhasil dikirim ke pelapor.');
    try {
      await apiService.addThreadMessage({
        ticket_id: ticket.ticket_id,
        message: content,
        visibility: 'public'
      });
      await loadTicket();
      onTicketUpdated();
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const handlePostInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !internalNoteText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const content = internalNoteText.trim();
    setInternalNoteText('');
    setNotice('Catatan internal privat tersimpan (Khusus Staf & UPT).');
    try {
      await apiService.addThreadMessage({
        ticket_id: ticket.ticket_id,
        message: content,
        visibility: 'internal'
      });
      await loadTicket();
      onTicketUpdated();
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  if (!ticketId) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-[#F0E8E1] shadow-card-soft text-center text-[#8C847E] space-y-3">
        <Sparkles className="w-8 h-8 text-[#E75A38] mx-auto opacity-70" />
        <h3 className="font-extrabold text-[#2D2622] text-sm">Pilih Tiket</h3>
        <p className="text-xs">Klik salah satu tiket di tabel untuk melihat detail dan melakukan tindakan triase.</p>
      </div>
    );
  }

  if (isLoading && !ticket) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-[#F0E8E1] shadow-card-soft text-center text-[#8C847E]">
        <div className="w-8 h-8 border-2 border-[#E75A38] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs font-semibold">Memuat data tiket...</p>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-4">
      {/* Right Card Container */}
      <div className="bg-white rounded-3xl p-5 border border-[#F0E8E1] shadow-card-soft space-y-4">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-[#2D2622] tracking-tight">
            Detail Tiket & Lampiran
          </h3>
          <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#E75A38]/10 text-[#E75A38]">
            #{ticket.ticket_id}
          </span>
        </div>

        {/* Carousel / Item Preview Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#FAF5F0] p-3 rounded-2xl border border-[#F0E8E1] text-center space-y-1.5">
            <div className="w-10 h-10 rounded-xl bg-white text-[#E75A38] shadow-xs flex items-center justify-center mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-xs font-extrabold text-[#2D2622] truncate">{ticket.category}</div>
            <div className="text-[10px] text-[#8C847E]">Kategori Layanan</div>
          </div>

          <div className="bg-[#FAF5F0] p-3 rounded-2xl border border-[#F0E8E1] text-center space-y-1.5">
            <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 shadow-xs flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-xs font-extrabold text-[#2D2622] truncate">{ticket.priority}</div>
            <div className="text-[10px] text-[#8C847E]">Target SLA</div>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Key-Value Breakdown (Polytrox Style) */}
        <div className="space-y-2.5 text-xs pt-1 border-t border-[#F5EFE9]">
          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="text-[#8C847E] font-medium">Ticket Code</span>
            <span className="font-mono font-extrabold text-[#2D2622]">{ticket.ticket_id}</span>
          </div>

          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="text-[#8C847E] font-medium">Priority</span>
            <span className="font-bold text-[#E75A38]">{ticket.priority} Delivery</span>
          </div>

          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="text-[#8C847E] font-medium">Pelapor (From)</span>
            <span className="font-mono text-[#2D2622] font-semibold truncate max-w-[150px]">{ticket.requester_email}</span>
          </div>

          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="text-[#8C847E] font-medium">Target SLA Due</span>
            <span className="font-mono font-bold text-slate-700">
              {new Date(ticket.sla_due_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </span>
          </div>
        </div>

        {/* Subjek & Deskripsi */}
        {(() => {
          const parsedTicket = parseTicketDetails(ticket.description, ticket.category);
          return (
            <div className="p-3.5 rounded-2xl bg-[#FAF5F0] border border-[#F0E8E1] space-y-1">
              <span className="text-[10px] font-extrabold text-[#8C847E] uppercase tracking-wider block">Subjek Keluhan</span>
              <p className="text-xs font-bold text-[#2D2622] leading-snug">{ticket.subject}</p>
              <p className="text-[11px] text-[#6E6660] pt-1 whitespace-pre-wrap">{parsedTicket.cleanDescription || ticket.description}</p>
              {parsedTicket.attachments.length > 0 && (
                <div className="pt-2">
                  <AttachmentGallery attachments={parsedTicket.attachments} />
                </div>
              )}
            </div>
          );
        })()}

        {/* Triase Form Box (Recommended Action Box) */}
        <div className="bg-[#FAF5F0] p-4 rounded-2xl border border-[#F0E8E1] space-y-3">
          <div className="text-xs font-black text-[#2D2622]">
            Tindakan Triase & UPT
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-[#8C847E] mb-1">Status Tiket:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#E0D5CC] text-xs font-bold text-[#2D2622] focus:outline-none focus:border-[#E75A38]"
              >
                <option value="open">Open (Baru)</option>
                <option value="in_progress">In Progress (Dikerjakan UPT)</option>
                <option value="waiting">Waiting (Menunggu Respon)</option>
                <option value="closed">Closed (Selesai)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#8C847E] mb-1">Unit Teknis UPT:</label>
              <select
                value={selectedUpt}
                onChange={(e) => setSelectedUpt(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#E0D5CC] text-xs font-bold text-[#2D2622] focus:outline-none focus:border-[#E75A38]"
              >
                <option value="">-- Pilih Unit UPT --</option>
                {uptList.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Big Terracotta Action Button (Signature element in reference design!) */}
          <button
            type="button"
            onClick={handleSaveTriage}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-2xl bg-[#E75A38] hover:bg-[#D84623] text-white text-xs font-extrabold shadow-terracotta transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={14} />
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Triase'}</span>
          </button>
        </div>

        {/* Thread History & Reply Trigger Button */}
        <button
          type="button"
          onClick={() => setShowReplyDrawer(true)}
          className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-[#FAF5F0] border border-[#E0D5CC] text-[#2D2622] text-xs font-bold flex items-center justify-between shadow-card-soft transition-all"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#E75A38]" />
            <span>Percakapan & Catatan ({threads.length})</span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#8C847E]" />
        </button>
      </div>

      {/* Reply & Internal Note Drawer / Modal */}
      {showReplyDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-[#F0E8E1] shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#F5EFE9]">
              <div>
                <h3 className="text-base font-black text-[#2D2622]">
                  Thread Percakapan #{ticket.ticket_id}
                </h3>
                <p className="text-xs text-[#8C847E]">{ticket.subject}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReplyDrawer(false)}
                className="w-8 h-8 rounded-full bg-[#FAF5F0] hover:bg-[#F0E8E1] text-[#8C847E] font-bold text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Thread Feed List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-60 text-xs">
              {threads.map((t) => {
                const isInternal = t.visibility === 'internal';
                const isCustomer = t.sender_role === 'pengguna_umum';
                const parsedMsg = parseThreadMessage(t.message);

                if (isInternal) {
                  return (
                    <div key={t.thread_id} className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-700">
                        <span className="inline-flex items-center gap-1">
                          <Lock size={11} />
                          <span>CATATAN INTERNAL ({t.sender_name})</span>
                        </span>
                        <span>{new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{parsedMsg.cleanText}</p>
                      {parsedMsg.attachments.length > 0 && (
                        <div className="pt-1.5">
                          <AttachmentGallery attachments={parsedMsg.attachments} />
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={t.thread_id} className={`p-3 rounded-2xl space-y-1 ${
                    isCustomer ? 'bg-[#FAF5F0] border border-[#F0E8E1]' : 'bg-[#FFF2EE] border border-[#F5D5CB]'
                  }`}>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className={isCustomer ? 'text-[#8C847E]' : 'text-[#E75A38]'}>
                        {t.sender_name} ({isCustomer ? 'Pelapor' : 'Staff'})
                      </span>
                      <span className="text-[#A89F99]">
                        {new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#2D2622] whitespace-pre-wrap">{parsedMsg.cleanText}</p>
                    {parsedMsg.attachments.length > 0 && (
                      <div className="pt-1.5">
                        <AttachmentGallery attachments={parsedMsg.attachments} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dual Tabs */}
            <div className="flex items-center gap-2 border-b border-[#F5EFE9] pt-2">
              <button
                type="button"
                onClick={() => setActiveReplyTab('reply')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all inline-flex items-center gap-1.5 ${
                  activeReplyTab === 'reply'
                    ? 'border-[#E75A38] text-[#E75A38]'
                    : 'border-transparent text-[#8C847E]'
                }`}
              >
                <MessageSquare size={13} />
                <span>Balas Pelapor (Publik)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReplyTab('internal_note')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all inline-flex items-center gap-1.5 ${
                  activeReplyTab === 'internal_note'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-[#8C847E]'
                }`}
              >
                <Lock size={13} />
                <span>Catatan Internal (Privat)</span>
              </button>
            </div>

            {/* Input Form */}
            {activeReplyTab === 'reply' ? (
              <form onSubmit={handlePostReply} className="space-y-3">
                <textarea
                  required
                  rows={3}
                  placeholder="Tulis balasan resmi kepada pelapor..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-[#FAF5F0] border border-[#E0D5CC] text-xs text-[#2D2622] focus:outline-none focus:border-[#E75A38]"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !replyText.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[#E75A38] hover:bg-[#D84623] text-white text-xs font-bold shadow-terracotta disabled:opacity-50"
                  >
                    Kirim Balasan
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePostInternalNote} className="space-y-3 bg-amber-50/50 p-3 rounded-2xl border border-amber-100">
                <textarea
                  required
                  rows={3}
                  placeholder="Tulis instruksi perbaikan untuk UPT / staf..."
                  value={internalNoteText}
                  onChange={(e) => setInternalNoteText(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-white border border-amber-300 text-xs text-amber-950 focus:outline-none focus:border-amber-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !internalNoteText.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Lock size={13} />
                    <span>Simpan Catatan Privat</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
