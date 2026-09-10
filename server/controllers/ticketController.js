import { pool } from '../config/db.js';
import { buildDataScopeFilter } from '../utils/permissions.js';
import { can, isStaff, canAccessTicket, scopeFor } from '../utils/access.js';
import { HttpError, id, text, choice, integer, transaction, audit, endpoint } from '../utils/security.js';
import { STATUSES, PRIORITIES, SLA_HOURS, validateTransition, validateAttachments } from '../utils/ticketPolicy.js';
import { sendTicketCreatedAlert, sendTicketStatusAlert, sendTicketReopenAlert, sendNewReplyAlert } from '../utils/telegram.js';

const SERVICE_UNITS = {
  'Pengendalian Operasi': 'UPT Pengendalian Operasi & Transportasi',
  'Corporate General Services (CGS)': 'UPT Sarana & Prasarana (CGS)',
  'Postal Security': 'UPT Postal Security & Keamanan',
  'Quality Control': 'UPT Quality Control & Audit SLA',
  'TI & Sistem Informasi': 'UPT TI & Sistem Informasi',
};
const notify = (work) => { Promise.resolve().then(work).catch(error => console.warn('[Notification]', error.code || 'delivery_failed')); };
const format = (ticket) => ({ ...ticket, is_archived: Boolean(ticket.is_archived) });
const keyFrom = (req) => req.headers['idempotency-key'] ? text(req.headers['idempotency-key'], 'Kode permintaan', { min: 16, max: 64 }) : null;
function requirePermission(user, permission) {
  if (!can(user, permission)) throw new HttpError(403, 'Anda tidak memiliki izin untuk tindakan ini.');
}
async function accessible(db, user, ticketId, lock = false) {
  const [[ticket]] = await db.query('SELECT * FROM tickets WHERE ticket_id = ?' + (lock ? ' FOR UPDATE' : ''), [ticketId]);
  if (!ticket || !canAccessTicket(user, ticket)) throw new HttpError(404, 'Tiket tidak ditemukan atau tidak tersedia dalam cakupan akses Anda.');
  return ticket;
}
async function addMessage(db, user, ticketId, message, visibility = 'public', requestKey = null) {
  const thread = { thread_id: id('TH'), ticket_id: ticketId, sender_id: user.user_id, sender_name: user.name, sender_role: user.role, message, visibility };
  await db.query(`INSERT INTO threads (thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [...Object.values(thread), requestKey]);
  return thread;
}
function queryFilter(req) {
  const scope = buildDataScopeFilter(req.user, 't');
  const conditions = [scope.clause];
  const params = [...scope.params];
  for (const [name, values] of [['status', STATUSES], ['priority', PRIORITIES]]) {
    if (req.query[name] && req.query[name] !== 'all') {
      conditions.push('t.' + name + ' = ?');
      params.push(choice(req.query[name], values, name));
    }
  }
  for (const name of ['category', 'assigned_upt']) {
    if (req.query[name] && req.query[name] !== 'all') { conditions.push('t.' + name + ' = ?'); params.push(text(req.query[name], 'Filter', { max: 150 })); }
  }
  if (req.query.archived === 'true') conditions.push('t.is_archived = 1');
  if (req.query.archived === 'false') conditions.push('t.is_archived = 0');
  if (req.query.mine === 'true') { conditions.push('t.requester_id = ?'); params.push(req.user.user_id); }
  if (req.query.requester_email) { conditions.push('LOWER(t.requester_email) = ?'); params.push(String(req.query.requester_email).toLowerCase()); }
  if (req.query.search) {
    const search = '%' + text(req.query.search, 'Pencarian', { max: 200 }) + '%';
    conditions.push('(t.ticket_id LIKE ? OR t.subject LIKE ? OR t.requester_name LIKE ? OR t.requester_email LIKE ?)');
    params.push(search, search, search, search);
  }
  return { sql: conditions.join(' AND '), params };
}
export const getTickets = endpoint(async (req, res) => {
  const page = integer(req.query.page, 1, 1000000);
  const limit = integer(req.query.limit, 25, 100);
  const filter = queryFilter(req);
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM tickets t WHERE ' + filter.sql, filter.params);
  const [rows] = await pool.query(`SELECT t.ticket_id, t.subject, t.category, t.department, t.topic, t.location, t.region_id, t.office_id,
    t.description, t.priority, t.status, t.channel, t.requester_id, t.requester_name, t.requester_email, t.requester_nip,
    t.assigned_upt, t.assigned_operator, t.sla_due_at, t.resolved_at, t.closed_at, t.is_archived, t.reopen_status, t.version, t.created_at, t.updated_at,
    JSON_LENGTH(t.attachments) AS attachment_count, r.name AS region_name, r.code AS region_code, o.name AS office_name, o.code AS office_code
    FROM tickets t LEFT JOIN regions r ON r.region_id = t.region_id LEFT JOIN offices o ON o.office_id = t.office_id
    WHERE ${filter.sql} ORDER BY t.created_at DESC, t.ticket_id DESC LIMIT ? OFFSET ?`, [...filter.params, limit, (page - 1) * limit]);
  res.json({ status: 'success', data: { tickets: rows.map(format), total: count.total, page, limit, total_pages: Math.ceil(count.total / limit) } });
});
export const getTicketSummary = endpoint(async (req, res) => {
  const filter = queryFilter(req);
  const [[summary]] = await pool.query(`SELECT COUNT(*) AS total, COALESCE(SUM(status = 'open'),0) AS open,
    COALESCE(SUM(status = 'in_progress'),0) AS in_progress, COALESCE(SUM(status = 'waiting'),0) AS waiting,
    COALESCE(SUM(status = 'resolved'),0) AS resolved, COALESCE(SUM(status = 'closed'),0) AS closed,
    COALESCE(SUM(status NOT IN ('resolved','closed') AND sla_due_at < NOW()),0) AS overdue,
    COALESCE(SUM(reopen_status = 'PENDING'),0) AS reopen_pending FROM tickets t WHERE ${filter.sql}`, filter.params);
  res.json({ status: 'success', data: summary });
});
export const getTicketDetail = endpoint(async (req, res) => {
  const ticket = await accessible(pool, req.user, req.params.id);
  const [[meta]] = await pool.query('SELECT r.name AS region_name, r.code AS region_code, o.name AS office_name, o.code AS office_code FROM offices o JOIN regions r ON r.region_id = o.region_id WHERE o.office_id = ?', [ticket.office_id]);
  const internal = isStaff(req.user) && can(req.user, 'ticket.reply');
  const [threads] = await pool.query('SELECT thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility, created_at FROM threads WHERE ticket_id = ?' + (internal ? '' : " AND visibility = 'public'") + ' ORDER BY created_at ASC, thread_id ASC', [ticket.ticket_id]);
  res.json({ status: 'success', data: { ticket: format({ ...ticket, ...meta }), threads } });
});
export const trackTicket = getTicketDetail;

export const createTicket = endpoint(async (req, res) => {
  requirePermission(req.user, 'ticket.create');
  const subject = text(req.body.subject, 'Judul kendala', { min: 5, max: 255 });
  const description = text(req.body.description, 'Rincian kendala', { min: 20, max: 10000 });
  const department = choice(req.body.department || req.body.category, Object.keys(SERVICE_UNITS), 'Bidang layanan');
  const topic = text(req.body.topic, 'Topik kendala', { max: 150 });
  const location = text(req.body.location, 'Lokasi', { max: 150 });
  const priority = choice(req.body.priority || 'Medium', PRIORITIES, 'Prioritas');
  const attachments = validateAttachments(req.body.attachments);
  const requestKey = keyFrom(req);
  const result = await transaction(pool, async db => {
    // Always use account identity, never requester fields supplied by the client.
    const [[office]] = await db.query('SELECT o.office_id, o.region_id FROM users u JOIN offices o ON o.office_id = u.office_id AND o.region_id = u.region_id WHERE u.user_id = ? FOR UPDATE', [req.user.user_id]);
    if (!office) throw new HttpError(400, 'Identitas kantor akun belum lengkap. Minta administrator melengkapi regional dan kantor sebelum membuat tiket.');
    if (requestKey) {
      const [[existing]] = await db.query('SELECT * FROM tickets WHERE requester_id = ? AND idempotency_key = ?', [req.user.user_id, requestKey]);
      if (existing) return { ticket: existing, duplicate: true };
    }
    const ticketId = id('TICK');
    await db.query(`INSERT INTO tickets (ticket_id, subject, category, department, topic, location, description, priority, status, channel,
      requester_id, requester_name, requester_email, requester_nip, region_id, office_id, assigned_upt, sla_due_at, attachments, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'web', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ticketId, subject, department, department, topic, location, description, priority, req.user.user_id, req.user.name, req.user.email, req.user.nip || null, office.region_id, office.office_id, SERVICE_UNITS[department], new Date(Date.now() + SLA_HOURS[priority] * 3600000), JSON.stringify(attachments), requestKey]);
    await addMessage(db, req.user, ticketId, description);
    await audit(db, req.user, 'CREATE_TICKET', ticketId, 'Pengajuan tiket ' + subject, ticketId);
    const [[ticket]] = await db.query('SELECT * FROM tickets WHERE ticket_id = ?', [ticketId]);
    return { ticket, duplicate: false };
  });
  if (!result.duplicate) notify(() => sendTicketCreatedAlert(result.ticket, {}));
  res.status(result.duplicate ? 200 : 201).json({ status: 'success', message: 'Tiket berhasil dibuat.', data: format(result.ticket) });
});

export const updateTicketStatus = endpoint(async (req, res) => {
  const user = req.user;
  const body = req.body;
  if (!isStaff(user)) throw new HttpError(403, 'Hanya petugas helpdesk yang dapat memperbarui tiket.');
  const result = await transaction(pool, async db => {
    const ticket = await accessible(db, user, req.params.id, true);
    if (body.version !== undefined && body.version !== ticket.version) throw new HttpError(409, 'Tiket telah diperbarui petugas lain. Muat ulang sebelum menyimpan.');
    const changes = [];
    const params = [];
    const note = text(body.note, 'Catatan', { min: 1, max: 10000, optional: true });
    const newStatus = body.status || ticket.status;
    if (body.status) {
      validateTransition(user, ticket, body.status, note);
      if (body.status !== ticket.status) {
        changes.push('status = ?', 'is_archived = ?', 'closed_at = ?', 'resolved_at = ?');
        params.push(body.status, body.status === 'closed' ? 1 : 0, body.status === 'closed' ? new Date() : null, body.status === 'resolved' ? new Date() : body.status === 'closed' ? ticket.resolved_at : null);
      }
    }
    if (body.is_archived !== undefined && Boolean(body.is_archived) !== (newStatus === 'closed')) throw new HttpError(400, 'Arsip mengikuti status ditutup. Gunakan proses penyelesaian atau buka kembali tiket.');
    if (body.priority !== undefined && body.priority !== ticket.priority) {
      requirePermission(user, 'ticket.change_priority');
      if (['resolved', 'closed'].includes(ticket.status)) throw new HttpError(409, 'Prioritas tiket selesai tidak dapat diubah.');
      const priority = choice(body.priority, PRIORITIES, 'Prioritas');
      changes.push('priority = ?', 'sla_due_at = ?');
      // Recalculate against creation, never reset an elapsed SLA by lowering urgency.
      params.push(priority, new Date(new Date(ticket.created_at).getTime() + SLA_HOURS[priority] * 3600000));
    }
    if (body.assigned_upt !== undefined) {
      requirePermission(user, 'ticket.assign');
      changes.push('assigned_upt = ?');
      params.push(choice(body.assigned_upt, Object.values(SERVICE_UNITS), 'Unit penanganan'));
    }
    if (body.assigned_operator !== undefined) {
      requirePermission(user, 'ticket.assign');
      let operator = null;
      if (body.assigned_operator) {
        [[operator]] = await db.query("SELECT * FROM users WHERE user_id = ? AND account_status = 'ACTIVE' AND is_active = 1", [body.assigned_operator]);
        const scope = operator && scopeFor(operator);
        if (!operator || !isStaff(operator) || (scope === 'OFFICE' && operator.office_id !== ticket.office_id) || (scope === 'REGIONAL' && operator.region_id !== ticket.region_id) || scope === 'OWN') throw new HttpError(400, 'Pilih operator aktif dengan cakupan kerja yang sesuai.');
      }
      changes.push('assigned_operator = ?'); params.push(operator?.user_id || null);
    }
    if (!changes.length && !note) throw new HttpError(400, 'Tidak ada perubahan yang perlu disimpan.');
    if (!changes.length && note) requirePermission(user, 'ticket.reply');
    if (changes.length) await db.query('UPDATE tickets SET ' + changes.join(', ') + ', version = version + 1, updated_at = NOW() WHERE ticket_id = ?', [...params, ticket.ticket_id]);
    if (note) await addMessage(db, user, ticket.ticket_id, note, ['waiting','resolved','closed'].includes(newStatus) ? 'public' : 'internal');
    await audit(db, user, body.status && body.status !== ticket.status ? 'STATUS_CHANGE' : 'UPDATE_TICKET', ticket.ticket_id,
      JSON.stringify({ from: ticket.status, to: newStatus, operator: body.assigned_operator, priority: body.priority }), ticket.ticket_id);
    const [[updated]] = await db.query('SELECT * FROM tickets WHERE ticket_id = ?', [ticket.ticket_id]);
    return { previous: ticket, ticket: updated };
  });
  if (result.previous.status !== result.ticket.status) notify(() => sendTicketStatusAlert(result.ticket, result.previous.status, result.ticket.status, user.name, body.note));
  res.json({ status: 'success', message: 'Perubahan tiket disimpan.', data: format(result.ticket) });
});

export const addThreadMessage = endpoint(async (req, res) => {
  const message = text(req.body.message, 'Pesan', { max: 10000 });
  const visibility = choice(req.body.visibility || 'public', ['public','internal'], 'Jenis pesan');
  const user = req.user;
  if (visibility === 'internal' && (!isStaff(user) || !can(user, 'ticket.reply'))) throw new HttpError(403, 'Catatan internal hanya tersedia untuk petugas berwenang.');
  if (!(can(user, 'ticket.reply') || can(user, 'ticket.reply_own'))) throw new HttpError(403, 'Anda tidak memiliki izin mengirim pesan.');
  const requestKey = keyFrom(req);
  const result = await transaction(pool, async db => {
    const ticket = await accessible(db, user, req.params.id, true);
    if (ticket.status === 'closed') throw new HttpError(409, 'Tiket sudah ditutup. Ajukan buka kembali untuk melanjutkan percakapan.');
    if (requestKey) {
      const [[existing]] = await db.query('SELECT * FROM threads WHERE ticket_id = ? AND sender_id = ? AND idempotency_key = ?', [ticket.ticket_id, user.user_id, requestKey]);
      if (existing) return { thread: existing, ticket, duplicate: true };
    }
    const thread = await addMessage(db, user, ticket.ticket_id, message, visibility, requestKey);
    await db.query('UPDATE tickets SET updated_at = NOW(), version = version + 1 WHERE ticket_id = ?', [ticket.ticket_id]);
    await audit(db, user, 'THREAD_REPLY', thread.thread_id, 'Pesan ' + visibility + ' ditambahkan', ticket.ticket_id);
    return { ticket, thread, duplicate: false };
  });
  if (!result.duplicate && visibility === 'public') notify(() => sendNewReplyAlert(result.ticket, user.name, user.role, message, 'public'));
  res.status(result.duplicate ? 200 : 201).json({ status: 'success', message: 'Pesan terkirim.', data: result.thread });
});

export const requestTicketReopen = endpoint(async (req, res) => {
  const reason = text(req.body.reason, 'Alasan buka kembali', { min: 10, max: 2000 });
  if (!(can(req.user, 'ticket.reply_own') || can(req.user, 'ticket.reopen'))) throw new HttpError(403, 'Anda tidak memiliki izin mengajukan buka kembali.');
  const result = await transaction(pool, async db => {
    const ticket = await accessible(db, req.user, req.params.id, true);
    if (ticket.status !== 'closed') throw new HttpError(409, 'Permohonan buka kembali hanya untuk tiket yang sudah ditutup.');
    const [[pending]] = await db.query("SELECT request_id FROM ticket_reopen_requests WHERE ticket_id = ? AND status = 'PENDING'", [ticket.ticket_id]);
    if (pending) throw new HttpError(409, 'Permohonan tiket ini sedang ditinjau. Tunggu keputusan petugas.');
    const requestId = id('ROP');
    await db.query(`INSERT INTO ticket_reopen_requests (request_id, ticket_id, requester_id, requester_name, requester_email, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`, [requestId, ticket.ticket_id, req.user.user_id, req.user.name, req.user.email, reason]);
    await db.query("UPDATE tickets SET reopen_status = 'PENDING', version = version + 1, updated_at = NOW() WHERE ticket_id = ?", [ticket.ticket_id]);
    await addMessage(db, req.user, ticket.ticket_id, 'Permohonan buka kembali: ' + reason);
    await audit(db, req.user, 'REOPEN_REQUESTED', ticket.ticket_id, reason, ticket.ticket_id);
    return { ticket, requestId };
  });
  notify(() => sendTicketReopenAlert(result.ticket, req.user.name, reason));
  res.json({ status: 'success', message: 'Permohonan dikirim. Petugas akan meninjau alasan Anda.', data: { request_id: result.requestId, status: 'PENDING' } });
});
export const reviewTicketReopen = endpoint(async (req, res) => {
  requirePermission(req.user, 'ticket.reopen');
  if (!isStaff(req.user)) throw new HttpError(403, 'Hanya petugas helpdesk dapat meninjau permohonan.');
  const action = choice(req.body.action, ['APPROVE','REJECT'], 'Keputusan');
  const note = text(req.body.note, 'Catatan keputusan', { min: 10, max: 2000 });
  const result = await transaction(pool, async db => {
    const ticket = await accessible(db, req.user, req.params.id, true);
    const [[request]] = await db.query("SELECT * FROM ticket_reopen_requests WHERE ticket_id = ? AND status = 'PENDING' FOR UPDATE", [ticket.ticket_id]);
    if (!request || ticket.status !== 'closed') throw new HttpError(409, 'Tidak ada permohonan aktif yang dapat diproses.');
    const reopenStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await db.query('UPDATE ticket_reopen_requests SET status = ?, reviewed_by = ?, reviewer_name = ?, review_note = ?, reviewed_at = NOW() WHERE request_id = ?', [reopenStatus, req.user.user_id, req.user.name, note, request.request_id]);
    if (action === 'APPROVE') {
      await db.query("UPDATE tickets SET status = 'open', is_archived = 0, closed_at = NULL, resolved_at = NULL, reopen_status = ?, version = version + 1, updated_at = NOW() WHERE ticket_id = ?", [reopenStatus, ticket.ticket_id]);
    } else await db.query('UPDATE tickets SET reopen_status = ?, version = version + 1, updated_at = NOW() WHERE ticket_id = ?', [reopenStatus, ticket.ticket_id]);
    await addMessage(db, req.user, ticket.ticket_id, (action === 'APPROVE' ? 'Tiket dibuka kembali. ' : 'Permohonan buka kembali ditolak. ') + note);
    await audit(db, req.user, 'REOPEN_' + reopenStatus, ticket.ticket_id, note, ticket.ticket_id);
    return { ticket, reopenStatus };
  });
  notify(() => sendTicketStatusAlert(result.ticket, 'closed', action === 'APPROVE' ? 'open' : 'closed', req.user.name, note));
  res.json({ status: 'success', message: 'Keputusan permohonan disimpan.', data: { status: action === 'APPROVE' ? 'open' : 'closed', reopen_status: result.reopenStatus } });
});
export const getTicketReopenRequests = endpoint(async (req, res) => {
  await accessible(pool, req.user, req.params.id);
  const [rows] = await pool.query('SELECT * FROM ticket_reopen_requests WHERE ticket_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json({ status: 'success', data: rows });
});
