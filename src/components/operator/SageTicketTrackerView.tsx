import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Ticket, ThreadMessage } from '../../types';
import { apiService } from '../../services/api';
import { soundService } from '../../utils/sound';
import { 
  Search, 
  Clock, 
  Send, 
  User, 
  Headphones, 
  Calendar, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  MapPin, 
  FileText, 
  Copy, 
  Check, 
  Layers, 
  Compass, 
  Info,
  Lock,
  Sparkles
} from 'lucide-react';
import { parseTicketDetails, parseThreadMessage } from '../../utils/ticketFormatter';
import { AttachmentGallery } from '../common/AttachmentGallery';

interface SageTicketTrackerViewProps {
  recentTickets?: Ticket[];
}

export const SageTicketTrackerView: React.FC<SageTicketTrackerViewProps> = ({ recentTickets = [] }) => {
  const [ticketId, setTicketId] = useState('');
  const [email, setEmail] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [threads, setThreads] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const prevThreadCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // Auto load first ticket if available
  useEffect(() => {
    if (recentTickets && recentTickets.length > 0 && !ticket) {
      const firstT = recentTickets[0];
      setTicketId(firstT.ticket_id);
      isInitialLoadRef.current = true;
      prevThreadCountRef.current = 0;
      fetchTicket(firstT.ticket_id, undefined, true);
    }
  }, [recentTickets]);

  // Fast auto-polling every 3 seconds
  useEffect(() => {
    if (!ticket?.ticket_id) return;
    const interval = setInterval(() => {
      fetchTicket(ticket.ticket_id, email, false);
    }, 3000);
    return () => clearInterval(interval);
  }, [ticket?.ticket_id, email]);

  const fetchTicket = async (id: string, mail?: string, showLoading = false) => {
    if (!id.trim()) return;
    if (showLoading) setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiService.trackTicket(id, mail);
      if (res.status === 'success' && res.data) {
        setTicket(res.data.ticket);
        const newThreads = res.data.threads || [];

        if (!isInitialLoadRef.current && newThreads.length > prevThreadCountRef.current) {
          const latest = newThreads[newThreads.length - 1];
          soundService.playIncomingMessageSound();
          soundService.notifyBrowser(`Pesan Baru di #${id}`, `${latest.sender_name}: ${latest.message.slice(0, 60)}`);
        }

        prevThreadCountRef.current = newThreads.length;
        isInitialLoadRef.current = false;
        setThreads(newThreads);
      } else {
        if (showLoading) {
          setTicket(null);
          setErrorMsg(res.message || 'Tiket tidak ditemukan dalam sistem.');
        }
      }
    } catch (err: any) {
      if (showLoading) {
        setTicket(null);
        setErrorMsg(err.message || 'Terjadi gangguan saat memuat data tiket.');
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) {
      isInitialLoadRef.current = true;
      prevThreadCountRef.current = 0;
      fetchTicket(ticketId, email, true);
    }
  };

  const handleQuickSelect = (t: Ticket) => {
    setTicketId(t.ticket_id);
    isInitialLoadRef.current = true;
    prevThreadCountRef.current = 0;
    fetchTicket(t.ticket_id, undefined, true);
  };

  const handleCopyTicketId = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticket_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyMessage.trim() || isSendingReply) return;

    const outgoing = replyMessage.trim();
    const isNote = isInternalNote;
    setIsSendingReply(true);
    setReplyMessage('');

    // Instant Optimistic Update (0ms delay)
    const tempThread: ThreadMessage = {
      thread_id: `TH-TEMP-${Date.now()}`,
      ticket_id: ticket.ticket_id,
      sender_id: 'USR-STAFF',
      sender_name: 'Staf Helpdesk',
      sender_role: 'operator',
      message: outgoing,
      visibility: isNote ? 'internal' : 'public',
      created_at: new Date().toISOString()
    };

    setThreads((prev) => [...prev, tempThread]);
    prevThreadCountRef.current += 1;
    soundService.playSentMessageSound();

    try {
      const res = await apiService.addThreadMessage({
        ticket_id: ticket.ticket_id,
        message: outgoing,
        visibility: isNote ? 'internal' : 'public'
      });

      if (res.status === 'success') {
        await fetchTicket(ticket.ticket_id, email, false);
      }
    } finally {
      setIsSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Laporan Masuk (Baru)
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Sedang Diproses UPT
          </span>
        );
      case 'waiting':
        return (
          <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Menunggu Tanggapan
          </span>
        );
      case 'closed':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Tuntas / Selesai
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{status}</span>;
    }
  };

  const getStepStatus = (stepIdx: number, currentStatus: string) => {
    if (currentStatus === 'closed') return 'done';
    if (stepIdx === 0) return 'done';
    if (stepIdx === 1 && (currentStatus === 'in_progress' || currentStatus === 'waiting')) return 'done';
    if (stepIdx === 2 && currentStatus === 'in_progress') return 'active';
    if (stepIdx === 2 && currentStatus === 'waiting') return 'active';
    return 'pending';
  };

  const formatThreadTime = (isoString?: string) => {
    if (!isoString) return 'Baru saja';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Baru saja';
      return `${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • ${d.toLocaleDateString('id-ID')}`;
    } catch {
      return 'Baru saja';
    }
  };

  const parsedTicket = ticket 
    ? parseTicketDetails(ticket.description || '', ticket.category, ticket.attachments) 
    : { cleanDescription: '', location: '', departmentAndTopic: '', attachments: [] };

  const followUpThreads = threads.filter((th, index) => {
    if (!th || typeof th.message !== 'string') return false;
    if (index === 0 && parsedTicket.cleanDescription && th.message.trim() === parsedTicket.cleanDescription.trim()) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 text-[#0F172A] font-sans selection:bg-[#002B49] selection:text-white">
      
      {/* HEADER & QUICK SEARCH CARD */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#002B49]" />
              <span>Pelacakan Status Tiket Terpadu</span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">
              Cek perkembangan penanganan, rincian teknis, dan riwayat komunikasi tiket langsung dari dashboard
            </p>
          </div>

          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-sky-50 text-[#002B49] border border-sky-200">
            Tampilan Internal & Publik
          </span>
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div className="sm:col-span-3 relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              placeholder="Ketik atau tempel ID Tiket (Contoh: TICK-20260901-5319)..."
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-mono text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-[#002B49] hover:bg-[#001D33] text-white text-xs sm:text-sm font-bold transition-all shadow-sm shadow-[#002B49]/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>{isLoading ? 'Mencari...' : 'Lacak Tiket'}</span>
          </button>
        </form>

        {/* Quick Click Recent Ticket Chips */}
        {recentTickets.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-[#64748B] block">Pilih Cepat Tiket Terbaru:</span>
            <div className="flex flex-wrap gap-2">
              {recentTickets.slice(0, 6).map((t) => (
                <button
                  key={t.ticket_id}
                  type="button"
                  onClick={() => handleQuickSelect(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    ticket?.ticket_id === t.ticket_id
                      ? 'bg-[#002B49] text-white border-[#002B49] shadow-xs'
                      : 'bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border-[#E2E8F0]'
                  }`}
                >
                  <span>#{t.ticket_id}</span>
                  <span className="text-[10px] font-sans opacity-75 truncate max-w-[100px]">({t.subject})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ERROR NOTIFICATION */}
      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 shadow-2xs"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {/* =================================================================================================
          HASIL PELACAKAN TIKET (EMBEDDED INSIDE DASHBOARD)
      ================================================================================================= */}
      {ticket && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* 1. KARTU HEADER & STATUS ROADMAP */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] shadow-sm space-y-6">
            
            {/* Baris Atas */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-sm font-bold text-[#002B49]">
                  <span>#{ticket.ticket_id}</span>
                  <button
                    type="button"
                    onClick={handleCopyTicketId}
                    title="Salin ID Tiket"
                    className="p-1 rounded-md text-slate-400 hover:text-[#002B49] transition-colors"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {getStatusBadge(ticket.status)}
              </div>

              <div className="text-xs text-[#64748B] font-medium flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Diajukan: {new Date(ticket.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Subjek Laporan */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">Subjek Kendala:</span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-snug">
                {ticket.subject}
              </h2>
            </div>

            {/* ROADMAP STEPPER 4 TAHAP */}
            <div className="space-y-2.5 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                Tahapan Penanganan Tiket:
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { step: 1, title: 'Laporan Masuk', desc: 'Tercatat di sistem PRISMA POS' },
                  { step: 2, title: 'Triase Operator', desc: 'Verifikasi & disposisi UPT' },
                  { step: 3, title: 'Pengerjaan UPT', desc: ticket.assigned_upt || 'Unit teknis terkait' },
                  { step: 4, title: 'Tuntas & Selesai', desc: 'Kendala terselesaikan' }
                ].map((s, idx) => {
                  const st = getStepStatus(idx, ticket.status);
                  return (
                    <div 
                      key={idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        st === 'done'
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : st === 'active'
                          ? 'bg-sky-50/70 border-sky-300 text-[#002B49] shadow-xs'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          st === 'done'
                            ? 'bg-emerald-600 text-white'
                            : st === 'active'
                            ? 'bg-[#002B49] text-white animate-pulse'
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {st === 'done' ? <Check className="w-3 h-3" /> : s.step}
                        </div>
                        <span className="font-bold text-xs">{s.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal leading-tight pl-7">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* METADATA CARDS (GRID 4 KOLOM BERSIH & RAPI) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              
              {/* 1. Kategori / Topik */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                  <Layers className="w-3.5 h-3.5 text-[#002B49]" />
                  <span>Department & Topik</span>
                </div>
                <p className="text-xs font-bold text-[#0F172A] truncate" title={parsedTicket.departmentAndTopic}>
                  {parsedTicket.departmentAndTopic}
                </p>
              </div>

              {/* 2. Lokasi Kantor */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                  <MapPin className="w-3.5 h-3.5 text-[#002B49]" />
                  <span>Kantor Pos Pembina</span>
                </div>
                <p className="text-xs font-bold text-[#0F172A] truncate" title={parsedTicket.location}>
                  {parsedTicket.location}
                </p>
              </div>

              {/* 3. Unit Penugasan (UPT) */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                  <Building2 className="w-3.5 h-3.5 text-[#002B49]" />
                  <span>Disposisi UPT</span>
                </div>
                <p className="text-xs font-bold text-[#0F172A] truncate" title={ticket.assigned_upt || 'Menunggu Disposisi'}>
                  {ticket.assigned_upt || 'Menunggu Disposisi'}
                </p>
              </div>

              {/* 4. Prioritas & SLA */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                  <Clock className="w-3.5 h-3.5 text-[#002B49]" />
                  <span>Tingkat Prioritas</span>
                </div>
                <p className="text-xs font-bold text-[#0F172A]">
                  {ticket.priority} (SLA 24 Jam)
                </p>
              </div>

            </div>
          </div>

          {/* 2. KARTU RINCIAN KELUHAN DARI PELAPOR */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#002B49]" />
              <span>Deskripsi Keluhan Pelapor</span>
            </h3>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap font-normal">
              {parsedTicket.cleanDescription}
            </div>

            {/* Galeri Lampiran */}
            {parsedTicket.attachments.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-700 block mb-2">Berkas Lampiran Pendukung:</span>
                <AttachmentGallery attachments={parsedTicket.attachments} />
              </div>
            )}
          </div>

          {/* 3. KARTU RIWAYAT TANGGAPAN & TINDAK LANJUT */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#002B49]" />
                <span>Riwayat Tanggapan & Perkembangan</span>
              </h3>
              <span className="text-xs font-semibold text-[#64748B]">
                {followUpThreads.length} Tanggapan
              </span>
            </div>

            {/* Thread Messages List */}
            {followUpThreads.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center space-y-1">
                <Info className="w-6 h-6 text-[#94A3B8] mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-700">Belum ada tanggapan lanjutan pada tiket ini</p>
                <p className="text-[11px] text-[#64748B]">Ketik pesan balasan resmi atau catatan internal staf di bawah ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {followUpThreads.map((th) => {
                  const isInternal = th.visibility === 'internal';
                  const currentUser = apiService.getStoredUser();
                  const isPelapor = 
                    !isInternal && (
                      th.sender_role === 'pengguna_umum' || 
                      th.sender_id === 'USR-PUBLIC' ||
                      (ticket?.requester_name && th.sender_name?.toLowerCase() === ticket.requester_name.toLowerCase()) ||
                      (currentUser?.name && th.sender_name?.toLowerCase() === currentUser.name.toLowerCase())
                    );
                  const parsedTh = parseThreadMessage(th.message);
                  const pelaporDisplayName = (th.sender_name && th.sender_name !== 'User' && !th.sender_name.toLowerCase().includes('admin') && !th.sender_name.toLowerCase().includes('operator'))
                    ? th.sender_name
                    : (ticket?.requester_name || 'Pelapor');

                  return (
                    <motion.div
                      key={th.thread_id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl border text-sm leading-relaxed space-y-2 ${
                        isInternal
                          ? 'bg-amber-50/90 border-amber-200'
                          : isPelapor
                          ? 'bg-[#F8FAFC] border-[#E2E8F0]'
                          : 'bg-sky-50/60 border-sky-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isInternal
                              ? 'bg-amber-600 text-white'
                              : isPelapor 
                              ? 'bg-slate-200 text-slate-700' 
                              : 'bg-[#002B49] text-white'
                          }`}>
                            {isInternal ? <Lock className="w-3.5 h-3.5" /> : isPelapor ? <User className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                          </div>
                          <span className={`font-bold ${isInternal ? 'text-amber-900' : isPelapor ? 'text-slate-800' : 'text-[#002B49]'}`}>
                            {isInternal ? 'Catatan Internal Staf' : isPelapor ? `Tanggapan Pelapor (${pelaporDisplayName})` : (th.sender_name || 'Tim Petugas / Teknisi UPT')}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#94A3B8]">
                          {formatThreadTime(th.created_at)}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#0F172A] font-normal leading-relaxed pl-8">
                        {parsedTh.cleanText}
                      </p>

                      {parsedTh.attachments.length > 0 && (
                        <div className="pl-8 pt-1">
                          <AttachmentGallery attachments={parsedTh.attachments} />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Form Balasan / Catatan Internal */}
            <form onSubmit={handleSendReply} className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded border-[#CBD5E1] text-[#002B49] focus:ring-[#002B49]"
                  />
                  <span className="flex items-center gap-1 text-[#64748B]">
                    <Lock className="w-3 h-3 text-amber-600" />
                    Kirim sebagai Catatan Internal (Hanya dilihat Staf / Operator)
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  required
                  placeholder={isInternalNote ? "Tulis catatan internal untuk koordinasi staf..." : "Ketik pesan balasan resmi untuk pelapor..."}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002B49] transition-all"
                />
                <button
                  type="submit"
                  disabled={isSendingReply}
                  className="px-5 py-2.5 bg-[#002B49] hover:bg-[#001D33] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm shadow-[#002B49]/20 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingReply ? 'Mengirim...' : 'Kirim Pesan'}</span>
                </button>
              </div>
            </form>

          </div>

        </motion.div>
      )}

    </div>
  );
};
