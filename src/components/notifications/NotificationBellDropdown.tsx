import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, MessageSquare, Clock, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { realtimeService, ChatNotification } from '../../services/realtime';
import { parseThreadMessage } from '../../utils/ticketFormatter';

interface NotificationBellDropdownProps {
  onSelectTicket?: (ticketId: string) => void;
}

export const NotificationBellDropdown: React.FC<NotificationBellDropdownProps> = ({ onSelectTicket }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = realtimeService.onNotificationsChange((notifs) => {
      setNotifications([...notifs]);
    });
    return () => unsub();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = (n: ChatNotification) => {
    realtimeService.markAsRead(n.id);
    setIsOpen(false);
    if (onSelectTicket) {
      onSelectTicket(n.ticket_id);
    }
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    realtimeService.markAllAsRead();
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Baru saja';
      if (diffMin < 60) return `${diffMin}m lalu`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}j lalu`;
      return `${Math.floor(diffHour / 24)}h lalu`;
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(p => !p)}
        className="relative flex items-center justify-center w-9.5 h-9.5 rounded-[10px] border border-[#E2E8F0] text-[#64748B] hover:text-[#0D5C75] bg-white hover:bg-[#F1F5F9] transition-all cursor-pointer shadow-xs active:scale-95"
        title="Notifikasi Pesan & Aktivitas"
      >
        <Bell size={16} className={unreadCount > 0 ? 'text-[#0D5C75] animate-bounce-short' : ''} />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-black text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[16px] bg-white border border-[#E2E8F0] shadow-[0_16px_36px_rgba(15,23,42,0.14)] z-50 overflow-hidden flex flex-col max-h-[480px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#0F172A]">Notifikasi Pesan</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] text-[11px] font-extrabold">
                    {unreadCount} baru
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#0D5C75] hover:text-[#083342] transition-colors cursor-pointer"
                >
                  <CheckCheck size={13} />
                  <span>Tandai dibaca</span>
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1 divide-y divide-[#F1F5F9] custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-10 px-4 text-center text-[#94A3B8] space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto text-[#94A3B8]">
                    <Bell size={18} />
                  </div>
                  <p className="text-xs font-semibold">Belum ada notifikasi pesan baru.</p>
                  <p className="text-[11px] text-[#CBD5E1]">Pesan atau tiket baru akan muncul di sini secara real-time.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-[#F8FAFC] group ${
                      !n.is_read ? 'bg-[#EFF6FF]/50' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#EAF4F8] text-[#0D5C75] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs group-hover:bg-[#0D5C75] group-hover:text-white transition-colors shadow-2xs">
                      <MessageSquare size={14} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] font-bold text-[#0F172A] truncate">
                          {n.sender_name}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] flex-shrink-0 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(n.created_at)}
                        </span>
                      </div>

                      {(() => {
                        const parsed = parseThreadMessage(n.message);
                        const displaySnippet = parsed.cleanText || (parsed.attachments.length > 0 ? `Mengirimkan ${parsed.attachments.length} berkas/lampiran` : n.message);
                        return (
                          <p className="text-[11px] text-[#475569] line-clamp-2 leading-relaxed font-medium">
                            "{displaySnippet}"
                          </p>
                        );
                      })()}

                      <div className="flex items-center justify-between pt-0.5">
                        <span className="font-mono text-[10px] font-bold text-[#0D5C75]">
                          #{n.ticket_id}
                        </span>
                        <span className="text-[10px] font-bold text-[#199FB1] flex items-center gap-0.5 group-hover:underline">
                          Buka Chat <ExternalLink size={10} />
                        </span>
                      </div>
                    </div>

                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#0D5C75] flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-[#F1F5F9] bg-[#F8FAFC] text-center">
                <button
                  type="button"
                  onClick={() => realtimeService.clearNotifications()}
                  className="text-[11px] text-[#94A3B8] hover:text-[#EF4444] font-semibold transition-colors cursor-pointer"
                >
                  Bersihkan Riwayat Notifikasi
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
