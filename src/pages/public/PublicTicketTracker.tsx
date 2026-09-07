import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { Ticket, ThreadMessage, TicketStatus } from '../../types';
import { 
  Search, 
  ArrowLeft, 
  ChevronRight, 
  Send, 
  Copy, 
  Check, 
  Info,
  Clock,
  User,
  Headphones,
  Bell,
  BellRing,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { StepperTimeline, Stage } from '../../components/features/StepperTimeline';
import { SlaCountdown } from '../../components/features/SlaCountdown';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import { parseTicketDetails, parseThreadMessage } from '../../utils/ticketFormatter';
import { AttachmentGallery } from '../../components/common/AttachmentGallery';
import { useToast } from '../../context/ToastContext';
import { soundService } from '../../utils/sound';
import { realtimeService } from '../../services/realtime';

export const PublicTicketTracker: React.FC = () => {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error, info } = useToast();

  const paramId = searchParams.get('id') || '';
  const paramEmail = searchParams.get('email') || '';

  const backDestination = isStaff ? '/dashboard' : user ? '/my-tickets' : '/login';
  const backLabel = isStaff 
    ? 'Dashboard Operator' 
    : user 
    ? 'Tiket Saya' 
    : 'Halaman Masuk';

  const [ticketId, setTicketId] = useState(paramId);
  const [email, setEmail] = useState(paramEmail);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [threads, setThreads] = useState<ThreadMessage[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  
  // Realtime Customer Notification States
  const [hasNotificationPermission, setHasNotificationPermission] = useState(true);
  const [liveResponseAlert, setLiveResponseAlert] = useState<{ sender: string; text: string } | null>(null);

  const prevThreadCountRef = useRef<number>(0);
  const prevTicketStatusRef = useRef<string>('');
  const isInitialLoadRef = useRef<boolean>(true);

  // Check browser notification permission status
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  const handleRequestNotificationPermission = async () => {
    const granted = await soundService.requestNotificationPermission();
    setHasNotificationPermission(granted);
    if (granted) {
      soundService.playIncomingMessageSound();
      success('Notifikasi browser berhasil diaktifkan.');
    } else {
      info('Notifikasi browser diblokir atau diabaikan.');
    }
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

  const statusLabelMap: Record<string, string> = {
    open: 'Terbuka (Open)',
    in_progress: 'Sedang Dikerjakan (In Progress)',
    waiting: 'Menunggu Balasan (Waiting)',
    closed: 'Selesai (Closed)'
  };

  const fetchTicket = async (id: string, mail?: string, showLoading = false) => {
    if (!id.trim()) return;
    if (showLoading) setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiService.trackTicket(id, mail);
      if (res.status === 'success' && res.data) {
        const currentTicket = res.data.ticket;
        const newThreads = Array.isArray(res.data.threads) ? res.data.threads : [];

        // Check if ticket status changed by staff
        if (!isInitialLoadRef.current && prevTicketStatusRef.current && currentTicket.status !== prevTicketStatusRef.current) {
          const newStatusLabel = statusLabelMap[currentTicket.status] || currentTicket.status;
          soundService.playIncomingMessageSound();
          soundService.notifyBrowser(
            `Pembaruan Status Tiket #${id}`,
            `Status tiket Anda telah diperbarui menjadi "${newStatusLabel}" oleh tim teknisi.`
          );
          info(`Status tiket diperbarui menjadi: ${newStatusLabel}`);
        }
        prevTicketStatusRef.current = currentTicket.status;
        setTicket(currentTicket);

        // Check if there are new incoming messages from operator/helpdesk/UPT
        if (!isInitialLoadRef.current && newThreads.length > prevThreadCountRef.current) {
          const latestMsg = newThreads[newThreads.length - 1];
          if (latestMsg) {
            const isFromSelf = 
              latestMsg.sender_role === 'pengguna_umum' || 
              latestMsg.sender_id === 'USR-PUBLIC' ||
              (currentTicket?.requester_name && (latestMsg.sender_name || '').toLowerCase().includes(currentTicket.requester_name.toLowerCase())) ||
              (user?.name && (latestMsg.sender_name || '').toLowerCase().includes(user.name.toLowerCase()));
            
            if (!isFromSelf) {
              const staffName = latestMsg.sender_name || 'Petugas UPT';
              const cleanMsg = parseThreadMessage(latestMsg.message).cleanText;
              soundService.playIncomingMessageSound();
              soundService.notifyBrowser(
                `Balasan Baru dari ${staffName} (#${id})`,
                cleanMsg.slice(0, 80)
              );
              info(`Tanggapan baru dari ${staffName}`);
              setLiveResponseAlert({
                sender: staffName,
                text: cleanMsg
              });
              setTimeout(() => setLiveResponseAlert(null), 9000);
            }
          }
        }

        prevThreadCountRef.current = newThreads.length;
        isInitialLoadRef.current = false;
        setThreads(newThreads);
      } else {
        if (showLoading) {
          setTicket(null);
          setErrorMsg(res.message || 'Tiket tidak ditemukan. Pastikan nomor ID tiket Anda sesuai.');
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

  useEffect(() => {
    if (paramId) {
      isInitialLoadRef.current = true;
      prevThreadCountRef.current = 0;
      prevTicketStatusRef.current = '';
      fetchTicket(paramId, paramEmail, true);
    }
  }, [paramId, paramEmail]);

  // Ultra-fast Sub-50ms WebSocket Realtime Listener for tracking page
  useEffect(() => {
    if (!ticket?.ticket_id) return;

    const unsub = realtimeService.onNewMessage((newMsg) => {
      if (newMsg && newMsg.ticket_id === ticket.ticket_id) {
        const isFromSelf = 
          newMsg.sender_role === 'pengguna_umum' || 
          newMsg.sender_id === 'USR-PUBLIC' ||
          (ticket?.requester_name && (newMsg.sender_name || '').toLowerCase().includes(ticket.requester_name.toLowerCase())) ||
          (user?.name && (newMsg.sender_name || '').toLowerCase().includes(user.name.toLowerCase()));

        if (!isFromSelf) {
          const staffName = newMsg.sender_name || 'Petugas UPT';
          const cleanMsg = parseThreadMessage(newMsg.message).cleanText;
          soundService.playIncomingMessageSound();
          soundService.notifyBrowser(
            `Tanggapan Baru dari ${staffName} (#${ticket.ticket_id})`,
            cleanMsg.slice(0, 80)
          );
          setLiveResponseAlert({
            sender: staffName,
            text: cleanMsg
          });
          setTimeout(() => setLiveResponseAlert(null), 9000);
        }

        setThreads((prev) => {
          if (prev.some(t => t.thread_id === newMsg.thread_id || (t.message === newMsg.message && t.sender_id === newMsg.sender_id))) {
            return prev;
          }
          return [...prev, newMsg];
        });
      }
    });

    const interval = setInterval(() => {
      fetchTicket(ticket.ticket_id, email, false);
    }, 3500);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [ticket?.ticket_id, email, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) {
      navigate(`/track?id=${encodeURIComponent(ticketId.trim())}${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ''}`, { replace: true });
      isInitialLoadRef.current = true;
      prevThreadCountRef.current = 0;
      prevTicketStatusRef.current = '';
      fetchTicket(ticketId, email, true);
    }
  };

  const handleCopyTicketId = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticket_id);
    setCopiedId(true);
    info(`ID Tiket #${ticket.ticket_id} disalin.`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSendCustomerReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyMessage.trim() || isSendingReply) return;

    const outgoingMsg = replyMessage.trim();
    setIsSendingReply(true);
    setReplyMessage('');

    const currentPelaporName = user?.name || ticket.requester_name || 'Pelapor';
    const currentPelaporEmail = user?.email || ticket.requester_email || '';

    // Instant Optimistic UI update (0ms delay)
    const tempThread: ThreadMessage = {
      thread_id: `TH-TEMP-${Date.now()}`,
      ticket_id: ticket.ticket_id,
      sender_id: user?.user_id || 'USR-PUBLIC',
      sender_name: currentPelaporName,
      sender_role: 'pengguna_umum',
      message: outgoingMsg,
      visibility: 'public',
      created_at: new Date().toISOString()
    };

    setThreads((prev) => [...prev, tempThread]);
    prevThreadCountRef.current = (prevThreadCountRef.current || 0) + 1;
    soundService.playSentMessageSound();

    // Broadcast instantly to all other tabs and devices via WebSocket
    realtimeService.broadcastChatMessage(tempThread);

    try {
      const res = await apiService.addThreadMessage({
        ticket_id: ticket.ticket_id,
        message: outgoingMsg,
        visibility: 'public',
        sender_id: user?.user_id || 'USR-PUBLIC',
        sender_name: currentPelaporName,
        sender_role: 'pengguna_umum',
        sender_email: currentPelaporEmail
      });

      if (res.status === 'success') {
        success('Tanggapan Anda berhasil dikirimkan.');
        await fetchTicket(ticket.ticket_id, email, false);
      }
    } catch (err) {
      console.warn('Reply error:', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Convert ticket status to 1-4 stage
  const getStageFromStatus = (st?: string): Stage => {
    switch (st) {
      case 'open': return 1;
      case 'in_progress': return 2;
      case 'waiting': return 3;
      case 'closed': return 4;
      default: return 1;
    }
  };

  const parsedTicket = ticket 
    ? parseTicketDetails(ticket.description || '', ticket.category, ticket.attachments) 
    : { cleanDescription: '', location: '', departmentAndTopic: '', attachments: [] };

  const currentStage = getStageFromStatus(ticket?.status);

  const stageTimestamps: Partial<Record<Stage, string>> = ticket ? {
    1: ticket.created_at,
    2: currentStage >= 2 ? ticket.created_at : undefined,
    3: currentStage >= 3 ? ticket.updated_at : undefined,
    4: ticket.status === 'closed' ? ticket.updated_at : undefined,
  } : {};

  // Genuine follow up messages (Safely filter out initial description duplicate and internal notes)
  const followUpThreads = threads.filter((th, index) => {
    if (!th || typeof th.message !== 'string') return false;
    if (th.visibility === 'internal') return false;
    if (index === 0 && parsedTicket.cleanDescription && th.message.trim() === parsedTicket.cleanDescription.trim()) {
      return false;
    }
    return true;
  });

  const isStaffSender = (th: ThreadMessage) => {
    const role = (th.sender_role || '').toLowerCase();
    const name = (th.sender_name || '').toLowerCase();
    const id = (th.sender_id || '').toLowerCase();
    
    if (role === 'admin' || role === 'operator' || role === 'upt') return true;
    if (id.includes('admin') || id === 'usr-op' || id.startsWith('usr-upt')) return true;
    if (name.includes('administrator') || name.includes('operator') || name.includes('teknisi') || name.includes('petugas')) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-[#0F172A] font-sans selection:bg-[#0D5C75] selection:text-white flex flex-col justify-between">
      
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 border-b border-[#E2E8F0]/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={backDestination} className="flex items-center gap-1.5 text-[#64748B] hover:text-[#0D5C75] transition-colors text-[13px] font-medium">
              <ArrowLeft size={15} /> {backLabel}
            </Link>
            <ChevronRight size={14} className="text-[#CBD5E1]" />
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-[5px] bg-slate-100 p-0.5 border border-slate-200 flex items-center justify-center">
                <img src="/prisma-pos-logo.png" alt="PRISMA POS Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-[13px] font-bold text-[#0D5C75]">PRISMA POS</span>
            </div>
          </div>

          {/* Browser Notification Prompt */}
          {!hasNotificationPermission && (
            <button
              type="button"
              onClick={handleRequestNotificationPermission}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] text-[11px] font-bold hover:bg-[#0D5C75]/20 transition-colors cursor-pointer"
              title="Aktifkan Notifikasi Desktop Browser"
            >
              <BellRing size={12} className="animate-pulse" />
              <span>Aktifkan Notifikasi</span>
            </button>
          )}
        </div>
      </header>

      {/* Real-time Incoming Live Notification Banner for Customer */}
      <AnimatePresence>
        {liveResponseAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] bg-gradient-to-r from-[#083342] to-[#0D5C75] text-white p-3.5 rounded-2xl shadow-2xl border border-white/20 flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={16} className="text-amber-300 animate-spin-slow" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-amber-300">
                  Tanggapan Baru dari {liveResponseAlert.sender}
                </span>
                <span className="text-[10px] text-white/70">Baru saja</span>
              </div>
              <p className="text-xs text-white/90 line-clamp-2 mt-0.5 font-medium">
                "{liveResponseAlert.text}"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
        {/* Search Bar Card */}
        <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-6">
          <h1 className="text-[22px] font-bold text-[#0F172A] mb-1">Lacak Status Tiket</h1>
          <p className="text-[14px] text-[#64748B] mb-4">Masukkan nomor ID tiket yang Anda terima saat pengajuan kendala</p>
          
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                required
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="Contoh: TICK-20260901-4521"
                className="w-full h-11 pl-9 pr-4 rounded-[10px] border border-[#E2E8F0] text-[14px] font-mono font-bold text-[#0D5C75] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="h-11 px-6 rounded-[10px] bg-[#0D5C75] text-white text-[14px] font-semibold hover:bg-[#083342] transition-colors flex-shrink-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Mencari...' : 'Cari Tiket'}
            </button>
          </form>

          <p className="text-[12px] text-[#94A3B8] mt-3">
            Atau pantau seluruh tiket yang pernah Anda ajukan:{' '}
            <Link to="/my-tickets" className="text-[#199FB1] hover:text-[#0D5C75] font-semibold">Tiket Saya →</Link>
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5"
          >
            <Info size={18} className="text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {/* Search Results */}
        {ticket && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Ticket Header & Stepper Card */}
            <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 font-mono text-[12px] text-[#64748B] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
                      <span>#{ticket.ticket_id}</span>
                      <button
                        onClick={handleCopyTicketId}
                        className="p-0.5 text-slate-400 hover:text-[#0D5C75] cursor-pointer"
                        title="Salin ID"
                      >
                        {copiedId ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>

                  <h2 className="text-[18px] font-bold text-[#0F172A] leading-snug">{ticket.subject}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[12px] text-[#64748B]">
                    <span className="font-semibold text-[#0D5C75] bg-[#EAF4F8] px-2 py-0.5 rounded-md">
                      {ticket.office_name || ticket.office_id || 'KCU Bandung'}
                    </span>
                    <span>•</span>
                    <span>{ticket.region_name || ticket.region_code || 'Regional 3'}</span>
                    <span>•</span>
                    <span>Pelapor: <strong className="text-slate-700">{ticket.requester_name}</strong></span>
                    {ticket.requester_nip && (
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        NOPEN: {ticket.requester_nip}
                      </span>
                    )}
                  </div>
                </div>

                <SlaCountdown
                  slaTarget={ticket.sla_due_at || ticket.created_at}
                  isClosed={ticket.status === 'closed'}
                />
              </div>

              {/* Stepper Timeline 4-Tahap */}
              <div className="py-5 border-t border-b border-[#F1F5F9] my-4">
                <StepperTimeline
                  currentStage={currentStage}
                  timestamps={stageTimestamps}
                  overSla={false}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="text-[12px] font-bold text-[#64748B] uppercase tracking-wide">Deskripsi Masalah</h3>
                <div className="p-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] sm:text-[14px] text-[#0F172A] leading-relaxed whitespace-pre-wrap">
                  {parsedTicket.cleanDescription || ticket.description}
                </div>

                {/* Attachments for initial description */}
                {parsedTicket.attachments.length > 0 && (
                  <div className="pt-2">
                    <AttachmentGallery attachments={parsedTicket.attachments} />
                  </div>
                )}
              </div>
            </div>

            {/* Conversation Thread Card */}
            <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-[#0F172A]">Riwayat Tanggapan & Perkembangan</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Realtime Aktif" />
                </div>
                <span className="text-[12px] font-semibold text-[#64748B]">{followUpThreads.length} tanggapan</span>
              </div>

              {followUpThreads.length === 0 ? (
                <div className="p-6 rounded-[12px] bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center space-y-1">
                  <Info size={22} className="text-[#94A3B8] mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-700">Belum ada balasan tambahan dari teknisi</p>
                  <p className="text-[11px] text-[#64748B]">Tiket Anda sudah berada di antrean UPT terkait dan akan segera ditindaklanjuti. Halaman ini akan otomatis berdering dan memunculkan notifikasi saat ada balasan baru.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followUpThreads.map((th) => {
                    const isStaff = isStaffSender(th);
                    const isPelapor = !isStaff;
                    const parsedTh = parseThreadMessage(th.message);
                    const staffDisplayName = th.sender_name || 'Tim Petugas / Teknisi UPT';
                    const pelaporDisplayName = (th.sender_name && th.sender_name !== 'User' && !isStaffSender(th))
                      ? th.sender_name
                      : (ticket?.requester_name || 'Pelapor');

                    return (
                      <div
                        key={th.thread_id}
                        className={`p-3.5 rounded-[12px] border text-xs sm:text-sm leading-relaxed space-y-1.5 ${
                          isPelapor ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#EAF4F8]/70 border-[#A5D1E1]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                              isPelapor ? 'bg-slate-200 text-slate-700' : 'bg-[#0D5C75] text-white'
                            }`}>
                              {isPelapor ? <User size={13} /> : <Headphones size={13} />}
                            </div>
                            <span className={isPelapor ? 'text-slate-800' : 'text-[#0D5C75]'}>
                              {isPelapor ? `Tanggapan Pelapor (${pelaporDisplayName})` : staffDisplayName}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#94A3B8] font-normal">
                            {formatThreadTime(th.created_at)}
                          </span>
                        </div>

                        <p className="text-[13px] text-[#0F172A] pl-8 whitespace-pre-wrap font-normal">
                          {parsedTh.cleanText}
                        </p>

                        {parsedTh.attachments.length > 0 && (
                          <div className="pl-8 pt-1">
                            <AttachmentGallery attachments={parsedTh.attachments} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply Form */}
              <form onSubmit={handleSendCustomerReply} className="pt-2 flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ketik tanggapan atau informasi tambahan untuk teknisi..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="flex-1 h-10 px-3.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyMessage.trim()}
                  className="h-10 px-5 rounded-[10px] bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer flex-shrink-0"
                >
                  <Send size={14} />
                  <span>{isSendingReply ? 'Mengirim...' : 'Kirim'}</span>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-4 text-center text-xs text-[#94A3B8]">
        PRISMA POS — Pos Resolution & Integrated Service Management Application © 2026
      </footer>
    </div>
  );
};

export default PublicTicketTracker;
