import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function isTelegramConfigured() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  const isEnabled = process.env.TELEGRAM_NOTIF_ENABLED !== 'false';

  return Boolean(
    isEnabled &&
    token &&
    chatId &&
    !token.includes('YOUR_') &&
    !token.includes('bot_token_here') &&
    !chatId.includes('chat_id_here')
  );
}

export function getTelegramConfig() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  const isEnabled = process.env.TELEGRAM_NOTIF_ENABLED !== 'false';
  const isConfigured = isTelegramConfigured();

  // Mask token for safe UI display (e.g. 7123***:AAFx***)
  let maskedToken = '';
  if (token) {
    if (token.length > 10) {
      maskedToken = `${token.slice(0, 6)}...${token.slice(-4)}`;
    } else {
      maskedToken = '***';
    }
  }

  return {
    enabled: isEnabled,
    configured: isConfigured,
    maskedToken,
    chatId: chatId || null,
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:5173'
  };
}

/**
 * Mengambil informasi bot dari API resmi Telegram (getMe)
 */
export async function getBotInfo() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        id: data.result.id,
        is_bot: data.result.is_bot,
        firstName: data.result.first_name,
        username: data.result.username,
        canJoinGroups: data.result.can_join_groups
      };
    }
    return null;
  } catch (err) {
    console.warn('[Telegram Gateway] getBotInfo failed:', err.message);
    return null;
  }
}

/**
 * Helper validasi URL inline keyboard untuk Telegram
 * Telegram Bot API menolak URL inline keyboard jika hostname adalah localhost / 127.0.0.1
 */
function sanitizeReplyMarkup(replyMarkup) {
  if (!replyMarkup || !Array.isArray(replyMarkup.inline_keyboard)) return null;

  const isValidUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
      if (!parsed.hostname.includes('.')) return false;
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'tg:';
    } catch {
      return false;
    }
  };

  const filteredKeyboard = replyMarkup.inline_keyboard
    .map(row => row.filter(btn => !btn.url || isValidUrl(btn.url)))
    .filter(row => row.length > 0);

  return filteredKeyboard.length > 0 ? { inline_keyboard: filteredKeyboard } : null;
}

/**
 * Mengirim pesan HTTP POST ke API resmi Telegram
 */
export async function sendTelegramMessage(text, { replyMarkup = null, parseMode = 'HTML' } = {}) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!token || !chatId) {
    console.log('[Telegram Gateway] Notification skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing).');
    return { ok: false, reason: 'unconfigured' };
  }

  if (process.env.TELEGRAM_NOTIF_ENABLED === 'false') {
    console.log('[Telegram Gateway] Notification skipped (TELEGRAM_NOTIF_ENABLED is false).');
    return { ok: false, reason: 'disabled' };
  }

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
      disable_web_page_preview: true
    };

    const cleanMarkup = sanitizeReplyMarkup(replyMarkup);
    if (cleanMarkup) {
      payload.reply_markup = cleanMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!result.ok) {
      console.warn('[Telegram Gateway] Failed to send message:', result.description);
    }
    return result;
  } catch (err) {
    console.error('[Telegram Gateway] Error sending message:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Escape HTML characters helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format Priority Badge
 */
function getPriorityBadge(priority) {
  const p = (priority || '').toUpperCase();
  if (p === 'URGENT') return '🚨 <b>URGENT</b>';
  if (p === 'HIGH') return '⚠️ <b>TINGGI (HIGH)</b>';
  if (p === 'MEDIUM') return '🟡 <b>SEDANG (MEDIUM)</b>';
  return '🟢 <b>RENDAH (LOW)</b>';
}

/**
 * Helper base URL
 */
function getBaseUrl() {
  return process.env.APP_BASE_URL || 'http://localhost:5173';
}

/**
 * Kirim Notifikasi Tiket Baru Diterbitkan
 */
export async function sendTicketCreatedAlert(ticket, meta = {}) {
  if (!isTelegramConfigured()) return;

  const baseUrl = getBaseUrl();
  const ticketUrl = `${baseUrl}/track?id=${encodeURIComponent(ticket.ticket_id)}`;
  const priorityBadge = getPriorityBadge(ticket.priority);
  
  const officeDisplay = meta.office_name 
    ? `${escapeHtml(meta.office_name)} (${escapeHtml(meta.office_code || '')})`
    : escapeHtml(ticket.office_id || '-');

  const regionDisplay = meta.region_name || ticket.region_id || '-';
  const category = escapeHtml(ticket.category || ticket.department || 'Layanan Pos');
  const subject = escapeHtml(ticket.subject || 'Laporan Masalah');
  const reporter = escapeHtml(ticket.requester_name || 'Staf Dinas');
  const reporterDetail = ticket.requester_nip ? `NIP: ${escapeHtml(ticket.requester_nip)}` : escapeHtml(ticket.requester_email || '');
  
  let desc = ticket.description ? ticket.description.trim() : '';
  if (desc.length > 250) {
    desc = desc.slice(0, 250) + '...';
  }

  const message = [
    `📦 <b>[PRISMA POS] TIKET BANTUAN BARU</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷️ <b>Nomor Tiket</b>: <code>#${escapeHtml(ticket.ticket_id)}</code>`,
    `⚠️ <b>Prioritas</b>: ${priorityBadge}`,
    `🏢 <b>Unit Kerja</b>: ${officeDisplay}`,
    `📍 <b>Regional</b>: ${escapeHtml(regionDisplay)}`,
    `📂 <b>Kategori</b>: ${category}`,
    `👤 <b>Pelapor</b>: ${reporter} (${reporterDetail})`,
    `📌 <b>Subjek</b>: <b>${subject}</b>`,
    ``,
    `📝 <b>Uraian Kendala</b>:`,
    `<i>"${escapeHtml(desc)}"</i>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⏰ <i>Sistem Otomasi Helpdesk PT Pos Indonesia</i>`
  ].join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🔍 Lacak / Buka Tiket', url: ticketUrl }
      ]
    ]
  };

  return sendTelegramMessage(message, { replyMarkup, parseMode: 'HTML' });
}

/**
 * Kirim Notifikasi Pembaruan Status Tiket
 */
export async function sendTicketStatusAlert(ticket, oldStatus, newStatus, actorName = 'Petugas UPT', note = '') {
  if (!isTelegramConfigured()) return;

  const baseUrl = getBaseUrl();
  const ticketUrl = `${baseUrl}/track?id=${encodeURIComponent(ticket.ticket_id)}`;

  const statusMap = {
    open: '🟢 Open (Baru)',
    in_progress: '🟡 In Progress (Sedang Diproses)',
    waiting: '🟠 Waiting (Menunggu Tanggapan/Vendor)',
    closed: '🔵 Closed (Selesai & Ditutup)'
  };

  const oldLabel = statusMap[oldStatus] || oldStatus;
  const newLabel = statusMap[newStatus] || newStatus;

  const messageLines = [
    `🔄 <b>[PRISMA POS] STATUS TIKET DIPERBARUI</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷️ <b>Nomor Tiket</b>: <code>#${escapeHtml(ticket.ticket_id)}</code>`,
    `📌 <b>Subjek</b>: ${escapeHtml(ticket.subject || '')}`,
    `🏢 <b>Kantor</b>: ${escapeHtml(ticket.office_name || ticket.office_id || '-')}`,
    `📊 <b>Progres</b>: <s>${escapeHtml(oldLabel)}</s> ➜ <b>${escapeHtml(newLabel)}</b>`,
    `👤 <b>Penangan</b>: ${escapeHtml(actorName)}`
  ];

  if (note && note.trim()) {
    messageLines.push(``);
    messageLines.push(`💬 <b>Catatan</b>: <i>"${escapeHtml(note.trim())}"</i>`);
  }

  messageLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  messageLines.push(`⏰ <i>Update status resmi helpdesk PRISMA POS</i>`);

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🔗 Cek Progres Tiket', url: ticketUrl }
      ]
    ]
  };

  return sendTelegramMessage(messageLines.join('\n'), { replyMarkup, parseMode: 'HTML' });
}

/**
 * Kirim Notifikasi Permohonan Buka Kembali Tiket (Reopen)
 */
export async function sendTicketReopenAlert(ticket, requesterName, reason) {
  if (!isTelegramConfigured()) return;

  const baseUrl = getBaseUrl();
  const ticketUrl = `${baseUrl}/track?id=${encodeURIComponent(ticket.ticket_id)}`;

  const message = [
    `⚠️ <b>[PRISMA POS] PERMOHONAN BUKA KEMBALI TIKET</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷️ <b>Nomor Tiket</b>: <code>#${escapeHtml(ticket.ticket_id)}</code>`,
    `📌 <b>Subjek</b>: ${escapeHtml(ticket.subject || '')}`,
    `👤 <b>Pemohon</b>: ${escapeHtml(requesterName || 'Staf Cabang')}`,
    `🏢 <b>Kantor</b>: ${escapeHtml(ticket.office_name || ticket.office_id || '-')}`,
    ``,
    `📝 <b>Alasan Pembukaan Kembali</b>:`,
    `<i>"${escapeHtml(reason || 'Kendala serupa masih berulang.')}"</i>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚡ <i>Mohon petugas UPT meninjau di Workstation</i>`
  ].join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🛠️ Tinjau Permohonan', url: ticketUrl }
      ]
    ]
  };

  return sendTelegramMessage(message, { replyMarkup, parseMode: 'HTML' });
}

/**
 * Kirim Notifikasi Balasan Diskusi Baru
 */
export async function sendNewReplyAlert(ticket, senderName, senderRole, messageText, visibility = 'public') {
  if (!isTelegramConfigured()) return;
  if (visibility !== 'public') return; // Do not leak private internal notes to telegram channel

  const baseUrl = getBaseUrl();
  const ticketUrl = `${baseUrl}/track?id=${encodeURIComponent(ticket.ticket_id)}`;

  let shortText = messageText ? messageText.trim() : '';
  if (shortText.length > 200) {
    shortText = shortText.slice(0, 200) + '...';
  }

  const roleLabel = senderRole === 'UPT_LUAR' ? 'Staf Cabang (Pelapor)' : 'Petugas Helpdesk UPT';

  const message = [
    `💬 <b>[PRISMA POS] BALASAN TIKET BARU</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷️ <b>Nomor Tiket</b>: <code>#${escapeHtml(ticket.ticket_id)}</code>`,
    `👤 <b>Dari</b>: ${escapeHtml(senderName)} (<i>${roleLabel}</i>)`,
    ``,
    `🗨️ <b>Pesan</b>:`,
    `<i>"${escapeHtml(shortText)}"</i>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`
  ].join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '💬 Balas di Percakapan', url: ticketUrl }
      ]
    ]
  };

  return sendTelegramMessage(message, { replyMarkup, parseMode: 'HTML' });
}

/**
 * Kirim Pesan Uji Coba Diagnostik (Test Ping)
 */
export async function sendTestMessage(operatorName = 'Administrator') {
  const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const baseUrl = getBaseUrl();

  const message = [
    `🚀 <b>[PRISMA POS] UJI KONEKSI TELEGRAM BOT GATEWAY</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ Status: <b>BERHASIL TERHUBUNG</b>`,
    `🕒 Waktu Uji: <code>${timestamp} WIB</code>`,
    `👤 Penguji: <b>${escapeHtml(operatorName)}</b>`,
    `🏢 Sistem: PRISMA POS v2.5 (PT Pos Indonesia)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Bot gateway kini siap menerima notifikasi tiket darurat, perubahan status penanganan, dan permohonan buka tiket.`
  ].join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🌐 Buka Dashboard POSO', url: baseUrl }
      ]
    ]
  };

  return sendTelegramMessage(message, { replyMarkup, parseMode: 'HTML' });
}
