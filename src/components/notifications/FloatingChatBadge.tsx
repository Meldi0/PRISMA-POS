import React, { useState, useEffect } from 'react';
import { MessageSquare, X, ArrowRight, Sparkles, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { realtimeService, ChatNotification } from '../../services/realtime';
import { parseThreadMessage } from '../../utils/ticketFormatter';

interface FloatingChatBadgeProps {
  onOpenTicket: (ticketId: string) => void;
}

export const FloatingChatBadge: React.FC<FloatingChatBadgeProps> = ({ onOpenTicket }) => {
  const [activePopup, setActivePopup] = useState<ChatNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsub = realtimeService.onNotificationsChange((notifs) => {
      const unread = notifs.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    });
    return () => unsub();
  }, []);

  // Listen to new chat events to show the popup preview
  useEffect(() => {
    const handler = (e: any) => {
      const notif: ChatNotification = e.detail;
      if (notif) {
        setActivePopup(notif);
        // Auto dismiss preview popup after 8 seconds
        setTimeout(() => {
          setActivePopup(current => (current?.id === notif.id ? null : current));
        }, 8000);
      }
    };

    window.addEventListener('poso_realtime_chat', handler);
    return () => window.removeEventListener('poso_realtime_chat', handler);
  }, []);

  const handleOpenActiveChat = () => {
    if (activePopup) {
      realtimeService.markAsRead(activePopup.id);
      onOpenTicket(activePopup.ticket_id);
      setActivePopup(null);
    } else {
      const all = realtimeService.getNotifications();
      if (all.length > 0) {
        const latest = all[0];
        realtimeService.markAsRead(latest.id);
        onOpenTicket(latest.ticket_id);
      }
    }
  };

  // Only render floating chat badge when there is at least 1 unread message or an active popup preview
  if (unreadCount === 0 && !activePopup) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none select-none">
      
      {/* 1. Floating Chat Preview Card Popup (WhatsApp/Telegram style) */}
      <AnimatePresence>
        {activePopup && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.85 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={handleOpenActiveChat}
            className="pointer-events-auto w-80 sm:w-92 bg-white rounded-[20px] p-4 shadow-[0_20px_50px_rgba(15,23,42,0.24)] border border-[#0D5C75]/25 cursor-pointer hover:border-[#0D5C75] hover:shadow-[0_24px_60px_rgba(13,92,117,0.3)] transition-all group overflow-hidden relative"
          >
            {/* Top Accent Gradient Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#083342] via-[#0D5C75] to-[#199FB1]" />

            <div className="flex items-start justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="w-8.5 h-8.5 rounded-full bg-[#0D5C75] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <MessageSquare size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[13px] font-bold text-[#0F172A] leading-tight">
                      {activePopup.sender_name}
                    </h4>
                    <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" title="Online" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-[#0D5C75]">
                    #{activePopup.ticket_id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup(null);
                }}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F1F5F9] transition-colors"
                title="Tutup"
              >
                <X size={15} />
              </button>
            </div>

            {/* Message Snippet */}
            {(() => {
              const parsed = parseThreadMessage(activePopup.message);
              const displaySnippet = parsed.cleanText || (parsed.attachments.length > 0 ? `Mengirimkan ${parsed.attachments.length} berkas/lampiran` : activePopup.message);
              return (
                <p className="text-[12px] text-[#334155] font-medium leading-relaxed my-2.5 line-clamp-2 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#F1F5F9]">
                  "{displaySnippet}"
                </p>
              );
            })()}

            {/* Action Row */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[10px] text-[#94A3B8] font-semibold">Baru saja</span>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#0D5C75] group-hover:text-[#199FB1] transition-colors">
                <span>Balas Pesan</span>
                <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Floating Circular Chat Icon Button (Only visible when unreadCount > 0) */}
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleOpenActiveChat}
            className="pointer-events-auto relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#083342] via-[#0D5C75] to-[#199FB1] text-white flex items-center justify-center shadow-[0_12px_32px_rgba(13,92,117,0.45)] hover:shadow-[0_16px_40px_rgba(13,92,117,0.6)] transition-all cursor-pointer group border-2 border-white"
            title={`${unreadCount} Pesan Baru Masuk - Klik untuk Balas`}
          >
            <MessageSquare size={24} className="group-hover:rotate-6 transition-transform" />

            {/* Pulse glow wave */}
            <span className="absolute inset-0 rounded-full bg-[#199FB1] animate-ping opacity-40" />

            {/* Red Badge Counter (e.g. 1, 2) like WhatsApp/Telegram */}
            <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full bg-[#EF4444] text-[11px] font-extrabold text-white shadow-md ring-2 ring-white animate-bounce-short">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
