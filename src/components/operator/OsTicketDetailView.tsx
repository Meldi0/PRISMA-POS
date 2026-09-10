import React, { useState, useEffect, useRef } from 'react';
import { Ticket, ThreadMessage, TicketStatus, TicketPriority } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { soundService } from '../../utils/sound';
import { parseTicketDetails, parseThreadMessage } from '../../utils/ticketFormatter';
import { AttachmentGallery } from '../common/AttachmentGallery';
import { 
  ArrowLeft, 
  Send, 
  Lock, 
  Globe, 
  CheckCircle2, 
  Clock, 
  Tag, 
  Mail, 
  Building2, 
  User, 
  ShieldCheck, 
  AlertTriangle,
  Flame,
  Calendar,
  MessageSquare,
  FileText,
  RefreshCw,
  Edit3,
  Check,
  AlertCircle,
  Phone
} from 'lucide-react';

interface OsTicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
  onTicketUpdated: () => void;
}

export const OsTicketDetailView: React.FC<OsTicketDetailViewProps> = ({
  ticketId,
  onBack,
  onTicketUpdated
}) => {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [threads, setThreads] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Action States
  const [activeActionTab, setActiveActionTab] = useState<'reply' | 'internal_note'>('reply');
  const [replyText, setReplyText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const prevThreadCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // Status & Assignment quick form
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('open');
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>('Medium');
  const [selectedUpt, setSelectedUpt] = useState<string>('');

  const uptList = [
    'UPT TI & Jaringan',
    'UPT Sarana & Prasarana',
    'UPT Pelayanan & Sistem Informasi',
    'UPT Keuangan & Logistik'
  ];

  const loadTicketData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await apiService.getTicketDetail(ticketId);
      if (res.status === 'success' && res.data) {
        setTicket(res.data.ticket);
        const newThreads = res.data.threads || [];

        if (!isInitialLoadRef.current && newThreads.length > prevThreadCountRef.current) {
          const latest = newThreads[newThreads.length - 1];
          const isFromSelf = latest.sender_id === user?.user_id || latest.sender_name?.toLowerCase().includes(user?.name?.toLowerCase() || '###');
          if (!isFromSelf) {
            soundService.playIncomingMessageSound();
            soundService.notifyBrowser(`Pesan Baru di #${ticketId}`, `${latest.sender_name}: ${latest.message.slice(0, 60)}`);
          }
        }

        prevThreadCountRef.current = newThreads.length;
        isInitialLoadRef.current = false;
        setThreads(newThreads);
        setSelectedStatus(res.data.ticket.status);
        setSelectedPriority(res.data.ticket.priority);
        setSelectedUpt(res.data.ticket.assigned_upt || '');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    isInitialLoadRef.current = true;
    prevThreadCountRef.current = 0;
    loadTicketData(false);

    // Auto-polling every 3 seconds for active ticket view
    const interval = setInterval(() => {
      loadTicketData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [ticketId]);

  // OPTIMISTIC POST REPLY (Instant UI update)
  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const messageContent = replyText.trim();
    const tempThread: ThreadMessage = {
      thread_id: `TH-TEMP-${Date.now()}`,
      ticket_id: ticket.ticket_id,
      sender_id: user?.user_id || 'USR-OP',
      sender_name: user?.name || 'Helpdesk Operator',
      sender_role: user?.role || 'operator',
      message: messageContent,
      visibility: 'public',
      created_at: new Date().toISOString()
    };

    // 1. Optimistic instant update (0ms delay)
    setThreads(prev => [...prev, tempThread]);
    prevThreadCountRef.current += 1;
    setReplyText('');
    soundService.playSentMessageSound();
    setNoticeMsg({ type: 'success', text: 'Balasan resmi berhasil dikirim dan tersimpan di database Aiven MySQL!' });

    try {
      await apiService.addThreadMessage({
        ticket_id: ticket.ticket_id,
        message: messageContent,
        visibility: 'public'
      });
      await loadTicketData(true);
      onTicketUpdated();
    } catch (err: any) {
      setNoticeMsg({ type: 'error', text: 'Gagal mengirim balasan ke server.' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNoticeMsg(null), 3500);
    }
  };

  // OPTIMISTIC POST INTERNAL NOTE (Instant UI update)
  const handlePostInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !internalNoteText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const messageContent = internalNoteText.trim();
    const tempThread: ThreadMessage = {
      thread_id: `TH-TEMP-${Date.now()}`,
      ticket_id: ticket.ticket_id,
      sender_id: user?.user_id || 'USR-OP',
      sender_name: user?.name || 'Helpdesk Operator',
      sender_role: user?.role || 'operator',
      message: messageContent,
      visibility: 'internal',
      created_at: new Date().toISOString()
    };

    // 1. Optimistic instant update
    setThreads(prev => [...prev, tempThread]);
    setInternalNoteText('');
    setNoticeMsg({ type: 'success', text: 'Catatan internal privat berhasil disimpan ke database Aiven MySQL (Khusus Staf & UPT).' });
    setIsSubmitting(true);

    try {
      await apiService.addThreadMessage({
        ticket_id: ticket.ticket_id,
        message: messageContent,
        visibility: 'internal'
      });
      await loadTicketData(true);
      onTicketUpdated();
    } catch (err: any) {
      setNoticeMsg({ type: 'error', text: 'Gagal menyimpan catatan internal.' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNoticeMsg(null), 3500);
    }
  };

  // OPTIMISTIC UPDATE TRIAGE & STATUS (Instant UI update)
  const handleQuickUpdateTriage = async () => {
    if (!ticket) return;

    // 1. Optimistic state change
    setTicket(prev => prev ? {
      ...prev,
      status: selectedStatus,
      priority: selectedPriority,
      assigned_upt: selectedUpt,
      updated_at: new Date().toISOString()
    } : null);

    setNoticeMsg({ 
      type: 'success', 
      text: `Status berhasil diubah ke [${selectedStatus.toUpperCase()}], Prioritas [${selectedPriority}], dan tersimpan ke database Aiven MySQL!` 
    });
    setIsSubmitting(true);

    try {
      await apiService.updateTicketStatus({
        ticket_id: ticket.ticket_id,
        status: selectedStatus,
        priority: selectedPriority,
        assigned_upt: selectedUpt
      });
      await loadTicketData(true);
      onTicketUpdated();
    } catch (err: any) {
      setNoticeMsg({ type: 'error', text: 'Gagal memperbarui status ke server.' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNoticeMsg(null), 4000);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-slate-400 space-y-3 bg-slate-900 border border-slate-800 rounded-3xl">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-300">Memuat detail tiket #{ticketId}...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <p className="text-slate-200 text-sm font-bold">Tiket #{ticketId} tidak ditemukan.</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
        >
          Kembali ke Antrean
        </button>
      </div>
    );
  }

  const getStatusBadge = (st: TicketStatus) => {
    switch (st) {
      case 'open':
        return <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">Open (Terbuka)</span>;
      case 'in_progress':
        return <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">In Progress (Dikerjakan)</span>;
      case 'waiting':
        return <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">Waiting (Menunggu Respon)</span>;
      case 'closed':
        return <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">Closed (Selesai)</span>;
    }
  };

  const getPriorityBadge = (pr: TicketPriority) => {
    switch (pr) {
      case 'Urgent':
        return <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-rose-400" /> Urgent (4 Jam SLA)</span>;
      case 'High':
        return <span className="px-3 py-1 rounded-lg text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> High (8 Jam SLA)</span>;
      case 'Medium':
        return <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">Medium (24 Jam)</span>;
      default:
        return <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300">Low (48 Jam)</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Header Toolbar (osTicket Top Navigation Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>← Kembali ke Daftar Antrean</span>
          </button>

          <div className="h-5 w-px bg-slate-700 hidden sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-black text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-3 py-1 rounded-lg shadow-sm">
              #{ticket.ticket_id}
            </span>
            {getStatusBadge(ticket.status)}
            {getPriorityBadge(ticket.priority)}
          </div>
        </div>

        <button
          onClick={() => loadTicketData()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Floating Notification */}
      {noticeMsg && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
          noticeMsg.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
        }`}>
          {noticeMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{noticeMsg.text}</span>
        </div>
      )}

      {/* 2. Main Ticket Info & Triase Card (osTicket Structured Info Box) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {/* Subject Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
            Subjek / Ringkasan Permasalahan
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {ticket.subject}
          </h1>
        </div>

        {/* 2-Column osTicket Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs">
          {/* Left Column: Ticket Status & SLA */}
          <div className="p-6 space-y-3.5">
            <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider text-[11px] pb-2 border-b border-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Status & Target Waktu Layanan (SLA)</span>
            </h3>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Status Tiket:</span>
              <span className="col-span-2">{getStatusBadge(ticket.status)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Kategori Layanan:</span>
              <span className="col-span-2 text-slate-200 font-bold text-sm">{ticket.category}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Tingkat Prioritas:</span>
              <span className="col-span-2">{getPriorityBadge(ticket.priority)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Target Batas SLA:</span>
              <span className="col-span-2 font-mono text-cyan-300 font-bold">
                {new Date(ticket.sla_due_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Tanggal Dibuat:</span>
              <span className="col-span-2 text-slate-300">
                {new Date(ticket.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          </div>

          {/* Right Column: Requester & Assignment */}
          <div className="p-6 space-y-3.5">
            <h3 className="font-bold text-slate-300 text-xs uppercase tracking-wider text-[11px] pb-2 border-b border-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>Informasi Mitra Agen & Penugasan</span>
            </h3>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Pelapor & No. Agen:</span>
              <span className="col-span-2 text-slate-100 font-bold text-sm">
                {ticket.requester_name || 'Mitra Agen Pos'}
                {ticket.requester_nip && (
                  <span className="ml-2 font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                    No. Agen: {ticket.requester_nip}
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Kantor Pos Pembina:</span>
              <span className="col-span-2 text-cyan-300 font-bold">
                {ticket.office_name || ticket.office_id || 'KCU Bandung'} ({ticket.region_name || ticket.region_code || 'Regional 3'})
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Email Pelapor:</span>
              <span className="col-span-2 font-mono text-indigo-300 font-bold text-xs truncate">{ticket.requester_email}</span>
            </div>

            {ticket.requester_phone && (
              <div className="grid grid-cols-3 gap-2 items-center py-0.5">
                <span className="text-slate-400 font-medium">WhatsApp / HP:</span>
                <span className="col-span-2 font-mono text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                  <Phone size={12} className="text-emerald-400 shrink-0" />
                  <a href={`https://wa.me/${ticket.requester_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {ticket.requester_phone}
                  </a>
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Saluran Masuk:</span>
              <span className="col-span-2 text-slate-200 font-bold uppercase tracking-wider">{ticket.channel}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Unit UPT Ditugaskan:</span>
              <span className="col-span-2 font-bold text-amber-300 text-sm flex items-center gap-1.5">
                {ticket.assigned_upt ? (
                  <>
                    <ShieldCheck size={16} className="text-amber-400 shrink-0" />
                    <span>{ticket.assigned_upt}</span>
                  </>
                ) : (
                  '— Belum ditugaskan —'
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center py-0.5">
              <span className="text-slate-400 font-medium">Operator PIC:</span>
              <span className="col-span-2 text-slate-300 font-semibold">{ticket.assigned_operator || 'Helpdesk Lead'}</span>
            </div>
          </div>
        </div>

        {/* 3. High-Contrast Quick Triage Control Bar */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            {/* Status Dropdown */}
            <div>
              <label className="block text-slate-400 font-bold mb-1">1. Ubah Status Tiket:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="open">Open (Terbuka / Baru)</option>
                <option value="in_progress">In Progress (Sedang Dikerjakan UPT)</option>
                <option value="waiting">Waiting (Menunggu Respon Pelapor)</option>
                <option value="closed">Closed (Selesai)</option>
              </select>
            </div>

            {/* Priority Dropdown */}
            <div>
              <label className="block text-slate-400 font-bold mb-1">2. Tingkat Prioritas SLA:</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="Low">Low (48 Jam SLA)</option>
                <option value="Medium">Medium (24 Jam SLA)</option>
                <option value="High">High (8 Jam SLA)</option>
                <option value="Urgent">Urgent (4 Jam SLA)</option>
              </select>
            </div>

            {/* UPT Assignment Dropdown */}
            <div>
              <label className="block text-slate-400 font-bold mb-1">3. Tugaskan ke Unit UPT:</label>
              <select
                value={selectedUpt}
                onChange={(e) => setSelectedUpt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-indigo-300 font-bold text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Belum Ditugaskan --</option>
                {uptList.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleQuickUpdateTriage}
              disabled={isSubmitting}
              className="w-full lg:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan ke Database...' : 'Simpan Perubahan Triase'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Ticket Conversation Thread History (osTicket Classic Feed) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>Riwayat Percakapan & Catatan Internal ({threads.length})</span>
          </h2>
        </div>

        <div className="space-y-4">
          {threads.map((t) => {
            const isInternal = t.visibility === 'internal';
            const isSystem = t.message.startsWith('[Sistem]');
            const isCustomer = t.sender_role === 'pengguna_umum';

            // System Event Log
            if (isSystem) {
              return (
                <div key={t.thread_id} className="text-center my-2">
                  <span className="inline-block text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-4 py-1 rounded-full shadow-2xs">
                    {t.message}
                  </span>
                </div>
              );
            }

            // Internal Note (osTicket Classic Yellow/Amber Box)
            if (isInternal) {
              const parsedInternal = parseThreadMessage(t.message);
              return (
                <div
                  key={t.thread_id}
                  className="rounded-3xl bg-amber-950/40 border-2 border-amber-500/50 p-5 text-xs space-y-2 shadow-lg"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/30 text-amber-300">
                    <span className="font-bold flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs tracking-wide">CATATAN INTERNAL KHUSUS STAF (Tidak dapat dilihat oleh Pelapor)</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Oleh: <strong className="text-amber-200">{t.sender_name || 'Staff'}</strong> • {new Date(t.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-amber-100 whitespace-pre-wrap leading-relaxed pt-1 text-xs sm:text-sm">
                    {parsedInternal.cleanText}
                  </p>
                  {parsedInternal.attachments.length > 0 && (
                    <div className="pt-2">
                      <AttachmentGallery attachments={parsedInternal.attachments} isDarkTheme={true} />
                    </div>
                  )}
                </div>
              );
            }

            // Public Message (Customer or Staff Response)
            const parsedPublic = parseThreadMessage(t.message);
            return (
              <div
                key={t.thread_id}
                className={`rounded-3xl p-5 text-xs sm:text-sm space-y-2 border shadow-md ${
                  isCustomer
                    ? 'bg-slate-900 border-slate-800 text-slate-200'
                    : 'bg-indigo-950/50 border-indigo-500/40 text-indigo-100'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm ${
                      isCustomer ? 'bg-slate-700 text-slate-200' : 'bg-indigo-600 text-white'
                    }`}>
                      {isCustomer ? 'C' : 'S'}
                    </div>
                    <div>
                      <span className="font-bold text-white block">{t.sender_name || 'Pelapor'}</span>
                      <span className={`text-[10px] uppercase font-bold ${
                        isCustomer ? 'text-slate-400' : 'text-indigo-300'
                      }`}>
                        {isCustomer ? 'Pelapor (Publik)' : 'Petugas Helpdesk / UPT'}
                      </span>
                    </div>
                  </div>

                  <span className="text-slate-400 text-xs">
                    {new Date(t.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                <p className="whitespace-pre-wrap leading-relaxed text-slate-200 pt-1 text-xs sm:text-sm">
                  {parsedPublic.cleanText}
                </p>

                {parsedPublic.attachments.length > 0 && (
                  <div className="pt-2">
                    <AttachmentGallery attachments={parsedPublic.attachments} isDarkTheme={true} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. osTicket Classic Dual-Tab Reply Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Form Tabs Switcher */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950">
          <button
            type="button"
            onClick={() => setActiveActionTab('reply')}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeActionTab === 'reply'
                ? 'border-indigo-500 text-white bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>Balas ke Pelapor (Publik)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveActionTab('internal_note')}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeActionTab === 'internal_note'
                ? 'border-amber-500 text-amber-300 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-amber-300'
            }`}
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Tulis Catatan Internal (Privat)</span>
          </button>
        </div>

        {/* Tab 1: Post Public Reply Form */}
        {activeActionTab === 'reply' && (
          <form onSubmit={handlePostReply} className="p-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Balasan ini akan <strong>terkirim dan dapat dibaca langsung oleh pelapor</strong> ({ticket.requester_email}).</span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Tulis balasan resmi helpdesk kepada pelapor tiket ini..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !replyText.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Mengirimkan Balasan...' : 'Kirim Balasan Resmi'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Post Internal Note Form (osTicket Yellow Theme) */}
        {activeActionTab === 'internal_note' && (
          <form onSubmit={handlePostInternalNote} className="p-6 space-y-4 bg-amber-950/10">
            <div className="flex items-center justify-between text-xs text-amber-300">
              <span className="flex items-center gap-1.5 font-bold">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Catatan internal ini HANYA dapat dilihat oleh tim Operator & UPT (Pelapor TIDAK BISA melihatnya).</span>
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Tulis catatan teknis rahasia, instruksi perbaikan teknisi UPT, atau hasil koordinasi lapangan..."
              value={internalNoteText}
              onChange={(e) => setInternalNoteText(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-amber-500/40 text-xs sm:text-sm text-amber-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmitting || !internalNoteText.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'Menyimpan Catatan...' : 'Simpan Catatan Internal'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
