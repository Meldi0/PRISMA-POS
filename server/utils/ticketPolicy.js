import { HttpError, choice, text } from './security.js';
import { can, isStaff } from './access.js';

export const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const SLA_HOURS = { Low: 72, Medium: 24, High: 8, Urgent: 4 };
export const TRANSITIONS = {
  open: ['in_progress', 'waiting', 'resolved'],
  in_progress: ['waiting', 'resolved'],
  waiting: ['in_progress', 'resolved'],
  resolved: ['in_progress', 'closed'],
  closed: [],
};

export function validateTransition(user, ticket, status, note) {
  choice(status, STATUSES, 'Status tiket');
  if (!isStaff(user)) throw new HttpError(403, 'Perubahan status hanya tersedia untuk petugas helpdesk.');
  const permission = status === 'resolved' ? 'ticket.resolve' : status === 'closed' ? 'ticket.close' : 'ticket.change_status';
  if (!can(user, permission)) throw new HttpError(403, 'Anda tidak memiliki izin untuk perubahan status ini.');
  if (status === ticket.status) return;
  if (!TRANSITIONS[ticket.status]?.includes(status)) throw new HttpError(409, ticket.status === 'closed'
    ? 'Tiket sudah ditutup. Gunakan pengajuan buka kembali dan proses persetujuannya.'
    : 'Urutan status tidak valid. Mulai penanganan, berikan solusi, lalu tutup tiket.');
  if (['waiting', 'resolved', 'closed'].includes(status)) text(note, 'Catatan tindak lanjut', { min: 10, max: 10000 });
}

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
export function validateAttachments(files = []) {
  if (!Array.isArray(files) || files.length > MAX_FILES) throw new HttpError(400, 'Lampiran maksimal 5 berkas.');
  let total = 0;
  return files.map(file => {
    const name = text(file?.name, 'Nama berkas', { max: 200 }).replace(/[\\/\x00-\x1f]/g, '_');
    if (typeof file?.dataUrl !== 'string') throw new HttpError(400, 'Data lampiran tidak valid.');
    const match = /^data:(image\/(?:jpeg|png)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(file.dataUrl);
    if (!match) throw new HttpError(400, 'Lampiran harus berupa JPG, PNG, atau PDF.');
    const bytes = Buffer.from(match[2], 'base64');
    total += bytes.length;
    if (!bytes.length || bytes.length > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES) throw new HttpError(400, 'Total seluruh lampiran maksimal 10 MB.');
    const validMagic = match[1] === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
      : match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!validMagic) throw new HttpError(400, 'Isi berkas tidak cocok dengan tipe lampiran.');
    return { name, type: match[1], size: `${(bytes.length / 1024).toFixed(1)} KB`, dataUrl: file.dataUrl };
  });
}
