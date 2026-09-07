import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  X, 
  Copy, 
  Check, 
  MessageSquare, 
  GitBranch, 
  Info, 
  Lock, 
  Send, 
  Paperclip, 
  ChevronDown, 
  User, 
  MapPin, 
  Building2,
  Clock, 
  AlertCircle,
  CheckCircle2,
  Trash2,
  Archive,
  RotateCcw
} from 'lucide-react';
import { Ticket, ThreadMessage, TicketStatus, TicketPriority } from '../../types';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { SlaCountdown } from '../features/SlaCountdown';
import { parseTicketDetails, parseThreadMessage } from '../../utils/ticketFormatter';
import { AttachmentGallery } from '../common/AttachmentGallery';
import { apiService } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { soundService } from '../../utils/sound';
import { realtimeService } from '../../services/realtime';

interface SageTicketDrawerProps {
  ticket: Ticket | null;
  onClose: () => void;
  onStatusChange: (ticket: Ticket, newStatus: TicketStatus) => void;
  onTicketUpdated?: () => void;
}

const validTransitions: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['waiting', 'closed'],
  waiting: ['in_progress', 'closed'],
  closed: ['open'],
};

const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Menunggu',
  closed: 'Selesai',
};

export const SageTicketDrawer: React.FC<SageTicketDrawerProps> = ({
  ticket,
  onClose,
  onStatusChange,
  onTicketUpdated
}) => {
  const { user, hasPermission } = useAuth();
  const { success, error: toastError, info } = useToast();

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
  const canTriage = !isPelapor && Boolean(
    user?.role === 'ADMIN' || 
    user?.role === 'PETUGAS_UPT' || 
    user?.role === 'ADMIN_PUSAT' || 
    user?.role === 'OPERATOR' ||
    hasPermission('ticket.triage') ||
    hasPermission('ticket.assign')
  );
  
  const [activeTab, setActiveTab] = useState<'diskusi' | 'triase' | 'info'>('diskusi');
  const [isInternal, setIsInternal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [threads, setThreads] = useState<ThreadMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  const prevThreadCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // Triage state
  const [selectedUpt, setSelectedUpt] = useState(ticket?.assigned_upt || '');
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>(ticket?.priority || 'Medium');
  const [isSavingTriage, setIsSavingTriage] = useState(false);

  useEffect(() => {
    if (ticket?.ticket_id) {
      setSelectedUpt(ticket.assigned_upt || '');
      setSelectedPriority(ticket.priority || 'Medium');
      isInitialLoadRef.current = true;
      prevThreadCountRef.current = 0;
      fetchThreads(ticket.ticket_id, false);
    }
  }, [ticket?.ticket_id]);

  // Ultra-fast Sub-50ms WebSocket Realtime Listener
  useEffect(() => {
    if (!ticket?.ticket_id) return;

    const unsub = realtimeService.onNewMessage((newMsg) => {
      if (newMsg && newMsg.ticket_id === ticket.ticket_id) {
        setThreads((prev) => {
          if (prev.some(t => t.thread_id === newMsg.thread_id || (t.message === newMsg.message && t.sender_id === newMsg.sender_id))) {
            return prev;
          }
          return [...prev, newMsg];
        });
      }
    });

    // Fallback background polling every 3.5 seconds
    const interval = setInterval(() => {
      fetchThreads(ticket.ticket_id, false);
    }, 3500);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [ticket?.ticket_id, user?.email]);

  // ESC keyboard handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const fetchThreads = async (ticketId: string, showLoading = false) => {
    if (showLoading && threads.length === 0) setLoadingThreads(true);
    try {
      const res = await apiService.getTicketDetail(ticketId);
      if (res.status === 'success' && res.data) {
        const newThreads = Array.isArray(res.data.threads) ? res.data.threads : [];
        
        if (!isInitialLoadRef.current && newThreads.length > prevThreadCountRef.current) {
          const latestMsg = newThreads[newThreads.length - 1];
          if (latestMsg) {
            const isFromSelf = 
              latestMsg.sender_id === user?.user_id || 
              (user?.name && (latestMsg.sender_name || '').toLowerCase().includes(user.name.toLowerCase()));
            
            if (!isFromSelf) {
              soundService.playIncomingMessageSound();
              soundService.notifyBrowser(`Pesan Baru di #${ticketId}`, `${latestMsg.sender_name || 'Pelapor'}: ${(latestMsg.message || '').slice(0, 60)}`);
              info(`Pesan baru dari ${latestMsg.sender_name || 'Pelapor'}`);
            }
          }
        }

        prevThreadCountRef.current = newThreads.length;
        isInitialLoadRef.current = false;
        setThreads(newThreads);
      }
    } catch (err) {
      console.warn('Failed to load threads:', err);
    } finally {
      if (showLoading) setLoadingThreads(false);
    }
  };

  const handleCopy = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticket_id);
    setCopied(true);
    info(`ID Tiket #${ticket.ticket_id} disalin.`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyText.trim() || isSending) return;

    const outgoingMessage = replyText.trim();
    const isNote = !isPelapor && isInternal;
    setIsSending(true);
    setReplyText('');

    // Instant Optimistic UI update
    const tempThread: ThreadMessage = {
      thread_id: `TH-TEMP-${Date.now()}`,
      ticket_id: ticket.ticket_id,
      sender_id: user?.user_id || 'USR-OP',
      sender_name: user?.name || 'Operator',
      sender_role: (user?.role as any) || 'operator',
      message: outgoingMessage,
      visibility: isNote ? 'internal' : 'public',
      created_at: new Date().toISOString()
    };

    setThreads((prev) => [...prev, tempThread]);
    prevThreadCountRef.current += 1;
    soundService.playSentMessageSound();

    // Broadcast instantly to all other tabs and devices via WebSocket
    realtimeService.broadcastChatMessage(tempThread);

    try {
      const res = await apiService.addThreadMessage({
        ticket_id: ticket.ticket_id,
        message: outgoingMessage,
        visibility: isNote ? 'internal' : 'public'
      });

      if (res.status === 'success') {
        success(isNote ? 'Catatan internal berhasil disimpan.' : 'Tanggapan berhasil dikirimkan.');
        await fetchThreads(ticket.ticket_id, false);
      }
    } catch (err: any) {
      toastError(err.message || 'Gagal mengirim pesan');
      fetchThreads(ticket.ticket_id, false);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;

    setIsSavingTriage(true);
    try {
      const res = await apiService.updateTicketStatus({
        ticket_id: ticket.ticket_id,
        status: ticket.status,
        assigned_upt: selectedUpt,
        priority: selectedPriority
      });

      if (res.status === 'success') {
        success('Disposisi UPT dan prioritas berhasil diperbarui!');
        if (onTicketUpdated) onTicketUpdated();
      } else {
        toastError(res.message || 'Gagal memperbarui disposisi');
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi gangguan saat menyimpan triase');
    } finally {
      setIsSavingTriage(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const parsedTicket = ticket 
    ? parseTicketDetails(ticket.description, ticket.category, ticket.attachments) 
    : { cleanDescription: '', location: '', departmentAndTopic: '', attachments: [] };

  const formatThreadTime = (isoString?: string) => {
    if (!isoString) return 'Baru saja';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Baru saja';
      return `${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Baru saja';
    }
  };

  const nextStatuses = ticket ? validTransitions[ticket.status] || [] : [];

  return (
    <AnimatePresence>
      {ticket && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[500px] bg-white shadow-[0_20px_48px_rgba(15,23,42,0.18)] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[13px] font-bold text-[#0D5C75] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
                  #{ticket.ticket_id}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded text-[#94A3B8] hover:text-[#0D5C75] hover:bg-[#EAF4F8] transition-all cursor-pointer"
                  title="Salin ID Tiket"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-[8px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="px-5 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-2 flex-shrink-0 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {ticket.status === 'closed' ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                      <CheckCircle2 size={13} /> Tiket Selesai (Otomatis Masuk Arsip)
                    </span>
                    {canChangeStatus && (
                      <button
                        type="button"
                        onClick={() => onStatusChange(ticket, 'in_progress')}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-[6px] text-[11px] font-bold bg-[#EFF6FF] border border-[#BAE6FD] text-[#0284C7] hover:bg-[#0284C7] hover:text-white transition-all cursor-pointer shadow-2xs"
                        title="Buka kembali tiket ini ke antrean kerja aktif"
                      >
                        <RotateCcw size={12} />
                        <span>Buka Kembali Tiket</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-[#64748B]">Status:</span>
                    {canChangeStatus ? (
                      <>
                        <span className="text-[11px] font-semibold text-[#64748B]">Ubah ke:</span>
                        {nextStatuses.map((st) => (
                          <button
                            key={st}
                            onClick={() => onStatusChange(ticket, st)}
                            className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold bg-white border border-[#E2E8F0] text-[#0D5C75] hover:bg-[#0D5C75] hover:text-white transition-all cursor-pointer"
                          >
                            → {statusLabels[st]}
                          </button>
                        ))}
                      </>
                    ) : (
                      <StatusBadge status={ticket.status} />
                    )}
                  </>
                )}
              </div>

              <SlaCountdown
                slaTarget={ticket.sla_due_at || ticket.created_at}
                isClosed={ticket.status === 'closed'}
                compact
              />
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-[#E2E8F0] px-5 flex-shrink-0 bg-white">
              {[
                { id: 'diskusi', label: 'Diskusi & Balasan', icon: MessageSquare },
                ...(canTriage ? [{ id: 'triase', label: 'Triase & Delegasi', icon: GitBranch }] : []),
                { id: 'info', label: 'Info & SLA', icon: Info },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-1.5 py-3 px-3 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${
                    activeTab === id
                      ? 'border-[#0D5C75] text-[#0D5C75]'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
              
              {/* TAB 1: DISKUSI & BALASAN */}
              {activeTab === 'diskusi' && (
                <div className="space-y-4">
                  {/* Initial Problem Statement Box */}
                  <div className="p-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B]">
                      <span>Laporan Awal: {ticket.requester_name || 'Pelapor'}</span>
                      <span>{new Date(ticket.created_at).toLocaleDateString('id-ID')}</span>
                    </div>

                    {/* Office and Region Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap py-0.5">
                      {ticket.office_name && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-[#F1F5F9] text-[#0D5C75] border border-[#CBD5E1]">
                          <Building2 size={12} className="text-[#0D5C75] shrink-0" />
                          <span>{ticket.office_name}</span>
                        </span>
                      )}
                      {(ticket.region_name || ticket.region_code || ticket.region_id) && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-[#EAF4F8] text-[#199FB1] border border-[#199FB1]/30">
                          <MapPin size={12} className="text-[#199FB1] shrink-0" />
                          <span>{ticket.region_name || ticket.region_code || ticket.region_id}</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-[13px] font-bold text-[#0F172A]">{ticket.subject}</h4>
                    <p className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {parsedTicket.cleanDescription || ticket.description}
                    </p>
                    {parsedTicket.attachments.length > 0 && (
                      <div className="pt-2">
                        <AttachmentGallery attachments={parsedTicket.attachments} />
                      </div>
                    )}
                  </div>

                  {/* Thread messages */}
                  <div className="space-y-3 pt-2">
                    {threads.length === 0 ? (
                      <p className="text-xs text-[#94A3B8] text-center py-4">Belum ada riwayat tanggapan tambahan</p>
                    ) : (
                      threads.map((msg) => {
                        const isInternalMsg = msg.visibility === 'internal';
                        const parsedTh = parseThreadMessage(msg.message);

                        return (
                          <div
                            key={msg.thread_id}
                            className={`flex gap-3 ${isInternalMsg ? 'pl-2 border-l-2 border-[#D97706]' : ''}`}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-2xs"
                              style={{ backgroundColor: isInternalMsg ? '#D97706' : '#0D5C75' }}
                            >
                              {getInitials(msg.sender_name)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[13px] font-semibold text-[#0F172A]">{msg.sender_name || 'Petugas'}</span>
                                <span className="text-[11px] text-[#94A3B8]">{msg.sender_role}</span>
                                {isInternalMsg && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#D97706]">
                                    <Lock size={9} /> Internal
                                  </span>
                                )}
                                <span className="text-[11px] text-[#94A3B8] ml-auto flex-shrink-0">
                                  {formatThreadTime(msg.created_at)}
                                </span>
                              </div>

                              <div
                                className={`text-[13px] leading-relaxed p-3 rounded-[10px] whitespace-pre-wrap ${
                                  isInternalMsg ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F8FAFC] text-[#0F172A]'
                                }`}
                              >
                                {parsedTh.cleanText}
                                {parsedTh.attachments.length > 0 && (
                                  <div className="pt-2">
                                    <AttachmentGallery attachments={parsedTh.attachments} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: TRIASE & DELEGASI */}
              {activeTab === 'triase' && (
                <form onSubmit={handleSaveTriage} className="space-y-4">
                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                    <h4 className="text-[13px] font-bold text-[#0F172A]">Delegasikan Unit Penanggung Jawab</h4>
                    
                    <div>
                      <label className="block text-[12px] font-semibold text-[#64748B] mb-1">Pilih Unit UPT</label>
                      <select
                        value={selectedUpt}
                        onChange={(e) => setSelectedUpt(e.target.value)}
                        className="w-full h-10 px-3 rounded-[8px] border border-[#E2E8F0] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30"
                      >
                        <option value="">-- Pilih Unit Terkait --</option>
                        <option value="UPT Pengendalian Operasi & Transportasi">UPT Pengendalian Operasi & Transportasi</option>
                        <option value="UPT Sarana & Prasarana (CGS)">UPT Sarana & Prasarana (CGS)</option>
                        <option value="UPT Postal Security & Keamanan">UPT Postal Security & Keamanan</option>
                        <option value="UPT Quality Control & Audit SLA">UPT Quality Control & Audit SLA</option>
                        <option value="UPT TI & Sistem Informasi">UPT TI & Sistem Informasi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-semibold text-[#64748B] mb-1">Tingkat Prioritas</label>
                      <select
                        value={selectedPriority}
                        onChange={(e) => setSelectedPriority(e.target.value as TicketPriority)}
                        className="w-full h-10 px-3 rounded-[8px] border border-[#E2E8F0] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30"
                      >
                        <option value="Low">Low (Rendah)</option>
                        <option value="Medium">Medium (Sedang)</option>
                        <option value="High">High (Tinggi)</option>
                        <option value="Urgent">Urgent (Darurat)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingTriage}
                      className="w-full h-10 rounded-[8px] bg-[#0D5C75] hover:bg-[#083342] text-white text-[13px] font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingTriage ? 'Menyimpan...' : 'Perbarui Disposisi Tiket'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: INFO & SLA */}
              {activeTab === 'info' && (
                <div className="space-y-3 text-[13px]">
                  <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
                    <h4 className="text-[13px] font-bold text-[#0F172A] mb-2">Informasi Detail Tiket</h4>
                    
                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#64748B]">Pelapor:</span>
                      <span className="font-semibold text-[#0F172A]">{ticket.requester_name || 'Pelapor'}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#64748B]">Email:</span>
                      <span className="font-mono text-[#0D5C75]">{ticket.requester_email}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#64748B]">Kategori:</span>
                      <span className="font-semibold text-[#0F172A]">{ticket.category}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#64748B]">Wilayah Regional:</span>
                      <span className="font-semibold text-[#0D5C75]">
                        {ticket.region_name ? `${ticket.region_name} (${ticket.region_code || ticket.region_id})` : ticket.region_id || '-'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#64748B]">Kantor Cabang:</span>
                      <span className="font-semibold text-[#0D5C75]">
                        {ticket.office_name ? `${ticket.office_name} (${ticket.office_code || ticket.office_id})` : ticket.office_id || '-'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#64748B]">Lokasi Penempatan:</span>
                      <span className="font-semibold text-[#0F172A]">{parsedTicket.location || 'Semua Cabang'}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                      <span className="text-[#64748B]">Unit Bertugas:</span>
                      <span className="font-semibold text-[#0F172A]">{ticket.assigned_upt || 'Menunggu Penugasan'}</span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-[#64748B]">Dibuat Pada:</span>
                      <span className="text-[#0F172A]">{new Date(ticket.created_at).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Reply Box (Always Available on Discussion Tab) */}
            {activeTab === 'diskusi' && (
              <form onSubmit={handleSendReply} className="p-4 border-t border-[#E2E8F0] bg-white flex-shrink-0 space-y-2.5">
                <div className="flex items-center justify-between">
                  {/* Internal Note Toggle */}
                  {!isPelapor ? (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded text-[#D97706] focus:ring-[#D97706]"
                      />
                      <span className={`text-[12px] font-bold inline-flex items-center gap-1.5 ${isInternal ? 'text-[#D97706]' : 'text-[#64748B]'}`}>
                        <Lock size={12} className="shrink-0" />
                        <span>Catatan Internal (Hanya Staf/UPT)</span>
                      </span>
                    </label>
                  ) : (
                    <span className="text-[12px] font-medium text-[#64748B]">Tanggapan tiket akan diteruskan ke Petugas UPT Pusat</span>
                  )}

                  <span className="text-[10px] text-[#94A3B8]">Tekan Kirim</span>
                </div>

                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    required
                    placeholder={isInternal ? "Ketik catatan internal investigasi/teknisi..." : "Ketik balasan untuk pelapor..."}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className={`flex-1 p-2.5 rounded-[10px] border text-[13px] focus:outline-none transition-all resize-none ${
                      isInternal 
                        ? 'bg-[#FEF3C7]/40 border-[#D97706] text-[#92400E] placeholder-[#B45309]' 
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:ring-2 focus:ring-[#199FB1]/30'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isSending || !replyText.trim()}
                    className={`px-4 rounded-[10px] text-white text-[13px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer flex-shrink-0 ${
                      isInternal ? 'bg-[#D97706] hover:bg-[#B45309]' : 'bg-[#0D5C75] hover:bg-[#083342]'
                    }`}
                  >
                    <Send size={15} />
                    <span className="hidden sm:inline">Kirim</span>
                  </button>
                </div>
              </form>
            )}

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SageTicketDrawer;
