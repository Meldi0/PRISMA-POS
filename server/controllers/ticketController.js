import { pool } from '../config/db.js';
import { buildDataScopeFilter } from '../utils/permissions.js';
import { 
  sendTicketCreatedAlert, 
  sendTicketStatusAlert, 
  sendTicketReopenAlert, 
  sendNewReplyAlert 
} from '../utils/telegram.js';

export function isUptUnitMatch(userUnit, ticketUnit) {
  if (!userUnit || !ticketUnit) return false;
  const u = userUnit.toLowerCase().trim();
  const t = ticketUnit.toLowerCase().trim();
  if (u === t) return true;
  if ((u.includes('ti') || u.includes('it') || u.includes('jaringan') || u.includes('sistem')) &&
      (t.includes('ti') || t.includes('it') || t.includes('jaringan') || t.includes('sistem'))) {
    return true;
  }
  if ((u.includes('sarpras') || u.includes('sarana') || u.includes('cgs')) &&
      (t.includes('sarpras') || t.includes('sarana') || t.includes('cgs'))) {
    return true;
  }
  if ((u.includes('sec') || u.includes('keamanan') || u.includes('security')) &&
      (t.includes('sec') || t.includes('keamanan') || t.includes('security'))) {
    return true;
  }
  if ((u.includes('qc') || u.includes('quality')) &&
      (t.includes('qc') || t.includes('quality'))) {
    return true;
  }
  return u.includes(t) || t.includes(u);
}

export async function getTickets(req, res) {
  try {
    const user = req.user;
    const {
      status,
      priority,
      category,
      assigned_upt,
      search,
      page = 1,
      limit = 50,
      requester_email
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let conditions = ['1=1'];
    let params = [];

    // 1. DATA SCOPE FILTERING (GLOBAL, REGIONAL, OFFICE, OWN)
    if (user) {
      const scopeFilter = buildDataScopeFilter(user, 'tickets');
      conditions.push(scopeFilter.clause);
      params.push(...scopeFilter.params);

      // Legacy support for UPT unit matching if user is legacy UPT
      if (user.role === 'upt' && user.upt_unit) {
        const unit = user.upt_unit.toLowerCase().trim();
        conditions.push('(LOWER(assigned_upt) LIKE ? OR LOWER(assigned_upt) LIKE ? OR LOWER(requester_email) = ?)');
        params.push(`%${unit}%`, `%${unit.split(' ')[0]}%`, user.email.toLowerCase().trim());
      }
    } else if (requester_email) {
      conditions.push('LOWER(requester_email) = ?');
      params.push(requester_email.toLowerCase().trim());
    }

    // 2. Query Parameter Filters
    if (status && status !== 'all') {
      conditions.push('LOWER(status) = ?');
      params.push(status.toLowerCase().trim());
    }
    if (priority && priority !== 'all') {
      conditions.push('LOWER(priority) = ?');
      params.push(priority.toLowerCase().trim());
    }
    if (category && category !== 'all') {
      conditions.push('LOWER(category) = ?');
      params.push(category.toLowerCase().trim());
    }
    if (assigned_upt && assigned_upt !== 'all') {
      conditions.push('LOWER(assigned_upt) = ?');
      params.push(assigned_upt.toLowerCase().trim());
    }
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(ticket_id) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(description) LIKE ? OR LOWER(requester_email) LIKE ? OR LOWER(requester_name) LIKE ?)');
      params.push(q, q, q, q, q);
    }

    const whereClause = conditions.join(' AND ');

    // Count Total
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM tickets WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Fetch Paginated Records with Region and Office details
    const [rows] = await pool.query(
      `SELECT 
        tickets.*,
        r.name AS region_name,
        r.code AS region_code,
        o.name AS office_name,
        o.code AS office_code,
        o.type AS office_type
      FROM tickets
      LEFT JOIN regions r ON tickets.region_id = r.region_id
      LEFT JOIN offices o ON tickets.office_id = o.office_id
      WHERE ${whereClause} 
      ORDER BY tickets.created_at DESC 
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const formattedRows = rows.map(t => ({
      ...t,
      is_archived: Boolean(t.is_archived)
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        tickets: formattedRows,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error in getTickets:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memuat daftar tiket.'
    });
  }
}

export async function getTicketDetail(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [ticketRows] = await pool.query(
      `SELECT 
        t.*,
        r.name AS region_name,
        r.code AS region_code,
        o.name AS office_name,
        o.code AS office_code,
        o.type AS office_type
      FROM tickets t
      LEFT JOIN regions r ON t.region_id = r.region_id
      LEFT JOIN offices o ON t.office_id = o.office_id
      WHERE t.ticket_id = ? 
      LIMIT 1`,
      [id]
    );

    if (ticketRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Tiket tidak ditemukan di sistem POSO.'
      });
    }

    const ticket = ticketRows[0];

    // Data Scope Authorization Check
    if (user) {
      const role = user.role;
      const isPrivileged = role === 'ADMIN' || role === 'PETUGAS_UPT' || role === 'ADMIN_PUSAT' || role === 'OPERATOR';

      if (!isPrivileged) {
        // UPT_LUAR: allowed if own ticket OR same office
        const isOwn = (ticket.requester_email && user.email && ticket.requester_email.toLowerCase() === user.email.toLowerCase()) ||
                      (ticket.requester_name && user.name && ticket.requester_name.toLowerCase() === user.name.toLowerCase());
        const isSameOffice = user.office_id && ticket.office_id && user.office_id === ticket.office_id;

        if (!isOwn && !isSameOffice) {
          return res.status(403).json({
            status: 'error',
            code: 403,
            message: 'Akses ditolak. Anda tidak memiliki wewenang untuk mengakses tiket di luar kantor/unit penugasan Anda.'
          });
        }
      }
    }

    // Fetch threads
    const isStaff = user && (user.role === 'ADMIN' || user.role === 'PETUGAS_UPT' || user.role === 'ADMIN_PUSAT' || user.role === 'OPERATOR');
    let threadQuery = 'SELECT * FROM threads WHERE ticket_id = ?';
    const threadParams = [id];

    if (!isStaff) {
      threadQuery += " AND visibility = 'public'";
    }
    threadQuery += ' ORDER BY created_at ASC';

    const [threadRows] = await pool.query(threadQuery, threadParams);

    return res.status(200).json({
      status: 'success',
      data: {
        ticket: {
          ...ticket,
          is_archived: Boolean(ticket.is_archived)
        },
        threads: threadRows
      }
    });
  } catch (err) {
    console.error('Error in getTicketDetail:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memuat rincian tiket.'
    });
  }
}

export async function trackTicket(req, res) {
  try {
    const { id } = req.params;
    const { email } = req.query;

    const [ticketRows] = await pool.query(
      `SELECT 
        t.*,
        r.name AS region_name,
        r.code AS region_code,
        o.name AS office_name,
        o.code AS office_code,
        o.type AS office_type
      FROM tickets t
      LEFT JOIN regions r ON t.region_id = r.region_id
      LEFT JOIN offices o ON t.office_id = o.office_id
      WHERE t.ticket_id = ? 
      LIMIT 1`,
      [id.trim()]
    );

    if (ticketRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Nomor ID tiket tidak ditemukan di sistem POSO.'
      });
    }

    const ticket = ticketRows[0];

    if (email && email.trim()) {
      if (ticket.requester_email.toLowerCase() !== email.toLowerCase().trim()) {
        return res.status(403).json({
          status: 'error',
          code: 403,
          message: 'Alamat email tidak cocok dengan email pelapor tiket ini.'
        });
      }
    }

    const [threads] = await pool.query(
      "SELECT * FROM threads WHERE ticket_id = ? AND visibility = 'public' ORDER BY created_at ASC",
      [ticket.ticket_id]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        ticket: {
          ...ticket,
          is_archived: Boolean(ticket.is_archived)
        },
        threads
      }
    });
  } catch (err) {
    console.error('Error in trackTicket:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal melacak tiket.'
    });
  }
}

export async function createTicket(req, res) {
  try {
    const user = req.user;
    const {
      subject,
      category,
      department,
      topic,
      location,
      description,
      priority = 'Medium',
      channel = 'web',
      requester_name,
      requester_email,
      requester_phone,
      requester_nip,
      assigned_upt,
      region_id,
      office_id,
      attachments = []
    } = req.body;

    const finalCategory = category || department || 'OPERASIONAL';

    if (!subject || !finalCategory || !description) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Subjek, kategori/departemen, dan deskripsi keluhan wajib diisi.'
      });
    }

    const email = (user ? user.email : requester_email || '').toLowerCase().trim();
    const name = user ? user.name : requester_name || 'Pelapor Dinas';
    const phone = requester_phone || (user ? user.phone_number : null);
    const nip = requester_nip || (user ? user.nip : null);

    if (!email) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Email pelapor wajib disertakan.'
      });
    }

    // Otomatisasi data regional dan kantor: prioritaskan identitas akun dinas yang sedang login
    let finalRegionId = null;
    let finalOfficeId = null;

    if (user) {
      finalRegionId = user.region_id || null;
      finalOfficeId = user.office_id || null;

      // Jika di session belum lengkap, query database akun secara langsung
      if (!finalRegionId || !finalOfficeId) {
        const [uRows] = await pool.query('SELECT region_id, office_id FROM users WHERE user_id = ?', [user.user_id]);
        if (uRows.length > 0) {
          finalRegionId = finalRegionId || uRows[0].region_id;
          finalOfficeId = finalOfficeId || uRows[0].office_id;
        }
      }
    }

    // Fallback hanya berlaku jika publik tanpa login atau akun belum diset kantornya
    if (!finalRegionId) finalRegionId = region_id || 'REG-03';
    if (!finalOfficeId) finalOfficeId = office_id || 'OFC-KCU-BDG';

    // Generate Ticket ID
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
      (today.getMonth() + 1).toString().padStart(2, '0') + 
      today.getDate().toString().padStart(2, '0');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `TICK-${dateStr}-${randomPart}`;

    // SLA Calculation
    let slaHours = 24;
    if (priority === 'Urgent') slaHours = 4;
    else if (priority === 'High') slaHours = 8;
    else if (priority === 'Medium') slaHours = 24;
    else if (priority === 'Low') slaHours = 72;

    const slaDueAt = new Date(Date.now() + slaHours * 3600000);

    await pool.query(`
      INSERT INTO tickets (
        ticket_id, subject, category, department, topic, location,
        description, priority, status, channel, requester_name, requester_email,
        requester_phone, requester_nip, assigned_upt, region_id, office_id, sla_due_at, attachments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ticketId, subject.trim(), finalCategory.trim(), department || null, topic || null,
      location || null, description, priority, channel, name, email, phone,
      nip || null, assigned_upt || null, finalRegionId, finalOfficeId, slaDueAt,
      JSON.stringify(attachments)
    ]);

    // Insert Initial Thread
    const threadId = `TH-${Date.now().toString().slice(-6)}`;
    await pool.query(`
      INSERT INTO threads (
        thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility
      ) VALUES (?, ?, ?, ?, ?, ?, 'public')
    `, [
      threadId, ticketId, user ? user.user_id : 'PUBLIC', name,
      user ? user.role : 'PELAPOR', description
    ]);

    // Audit Log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, ticket_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'CREATE_TICKET', 'TICKET', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, ticketId, user ? user.user_id : 'PUBLIC',
        name, user ? user.role : 'PELAPOR', ticketId,
        `Pembuatan tiket baru #${ticketId} prioritas ${priority}`,
        `Pengajuan tiket baru oleh ${email}`
      ]);
    } catch (e) {}

    const [newTicket] = await pool.query('SELECT * FROM tickets WHERE ticket_id = ?', [ticketId]);

    const ticketData = {
      ...newTicket[0],
      ticket_id: ticketId,
      is_archived: Boolean(newTicket[0].is_archived)
    };

    // Kirim notifikasi Telegram secara asynchronous non-blocking
    try {
      pool.query(
        `SELECT o.name AS office_name, o.code AS office_code, r.name AS region_name 
         FROM offices o 
         LEFT JOIN regions r ON o.region_id = r.region_id 
         WHERE o.office_id = ? LIMIT 1`,
        [finalOfficeId]
      ).then(([officeDetails]) => {
        const meta = officeDetails && officeDetails[0] ? officeDetails[0] : {};
        sendTicketCreatedAlert(ticketData, meta).catch(err => {
          console.warn('[Telegram Alert Error]', err.message);
        });
      }).catch(err => {
        console.warn('[Telegram Meta Fetch Error]', err.message);
      });
    } catch (e) {}

    return res.status(201).json({
      status: 'success',
      code: 201,
      message: 'Tiket berhasil dibuat dan diterbitkan.',
      data: {
        ...ticketData,
        ticket: ticketData,
        ticket_id: ticketId
      }
    });
  } catch (err) {
    console.error('Error in createTicket:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal membuat tiket.'
    });
  }
}

export async function updateTicketStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, note, assigned_upt, assigned_operator, priority, is_archived } = req.body;
    const user = req.user;

    const [ticketRows] = await pool.query('SELECT * FROM tickets WHERE ticket_id = ? LIMIT 1', [id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'Tiket tidak ditemukan.' });
    }

    const ticket = ticketRows[0];

    // UPT_LUAR is strictly prohibited from modifying ticket status or closing tickets!
    if (user && (user.role === 'UPT_LUAR' || user.role === 'PELAPOR' || user.role === 'pengguna_umum')) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Akses ditolak. Pengguna UPT Luar tidak memiliki wewenang untuk mengubah status atau menutup tiket. Penutupan dan perubahan status tiket hanya dapat dilakukan oleh Petugas UPT Pusat atau Admin.'
      });
    }

    const updates = [];
    const params = [];

    if (status && status !== ticket.status) {
      updates.push('status = ?');
      params.push(status);

      if (status === 'closed') {
        updates.push('closed_at = NOW()');
        updates.push('is_archived = 1');
      } else {
        updates.push('closed_at = NULL');
        updates.push('is_archived = 0');
      }
    }

    if (is_archived !== undefined) {
      updates.push('is_archived = ?');
      params.push(is_archived ? 1 : 0);
    }

    if (assigned_upt !== undefined) {
      updates.push('assigned_upt = ?');
      params.push(assigned_upt);
    }

    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length === 0 && !note) {
      return res.status(400).json({ status: 'error', code: 400, message: 'Tidak ada data pembaruan yang dikirim.' });
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(id);
      await pool.query(`UPDATE tickets SET ${updates.join(', ')} WHERE ticket_id = ?`, params);
    }

    // Add note as thread message if provided
    if (note && note.trim()) {
      const threadId = `TH-${Date.now().toString().slice(-6)}`;
      const visibility = (status === 'closed' || status === 'waiting') ? 'public' : 'internal';
      await pool.query(`
        INSERT INTO threads (thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        threadId, id, user ? user.user_id : 'STAFF', user ? user.name : 'Petugas Helpdesk',
        user ? user.role : 'PETUGAS_UPT', note.trim(), visibility
      ]);
    }

    // Audit Log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, ticket_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'STATUS_CHANGE', 'TICKET', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, id, user ? user.user_id : 'STAFF',
        user ? user.name : 'Petugas', user ? user.role : 'PETUGAS_UPT', id,
        `Status: ${ticket.status} -> ${status || ticket.status}${assigned_operator ? `, Operator: ${assigned_operator}` : ''}`,
        `Pembaruan tiket oleh ${user ? user.name : 'Petugas'}`
      ]);
    } catch (e) {}

    const [updatedTicket] = await pool.query('SELECT * FROM tickets WHERE ticket_id = ?', [id]);

    // Kirim notifikasi Telegram jika status berubah
    if (status && status !== ticket.status) {
      try {
        const ticketInfo = {
          ...(updatedTicket[0] || ticket),
          office_name: ticket.office_name || ticket.office_id
        };
        sendTicketStatusAlert(ticketInfo, ticket.status, status, user ? user.name : 'Petugas UPT', note).catch(err => {
          console.warn('[Telegram Status Alert Error]', err.message);
        });
      } catch (e) {}
    }

    return res.status(200).json({
      status: 'success',
      message: 'Status tiket berhasil diperbarui.',
      data: {
        ticket: {
          ...updatedTicket[0],
          is_archived: Boolean(updatedTicket[0].is_archived)
        }
      }
    });
  } catch (err) {
    console.error('Error in updateTicketStatus:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal memperbarui status tiket.' });
  }
}

export async function addThreadMessage(req, res) {
  try {
    const { id } = req.params;
    const { message, visibility = 'public' } = req.body;
    const user = req.user;

    if (!message || !message.trim()) {
      return res.status(400).json({ status: 'error', code: 400, message: 'Isi pesan tidak boleh kosong.' });
    }

    const [ticketRows] = await pool.query('SELECT * FROM tickets WHERE ticket_id = ? LIMIT 1', [id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'Tiket tidak ditemukan.' });
    }

    const ticket = ticketRows[0];

    // Pembatasan Chat: Jika tiket closed, pelapor tidak dapat mengirim pesan baru
    const isStaff = user && (user.role === 'ADMIN' || user.role === 'ADMIN_PUSAT' || user.role === 'PETUGAS_UPT' || user.role === 'OPERATOR');
    if (ticket.status === 'closed' && !isStaff) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Tiket ini telah ditutup (Closed). Percakapan telah dinonaktifkan. Silakan ajukan opsi "Ajukan Buka Kembali Tiket" jika kendala masih berlanjut.'
      });
    }

    // Pelapor / UPT_LUAR checks: can only reply to own ticket or same office, and cannot post internal notes
    let finalVisibility = visibility;
    const isPelapor = user && (user.role === 'UPT_LUAR' || user.role === 'PELAPOR' || user.role === 'pengguna_umum');
    if (isPelapor) {
      const isOwn = (ticket.requester_email && user.email && ticket.requester_email.toLowerCase() === user.email.toLowerCase()) ||
                    (ticket.requester_name && user.name && ticket.requester_name.toLowerCase() === user.name.toLowerCase());
      const isSameOffice = user.office_id && ticket.office_id && user.office_id === ticket.office_id;

      if (!isOwn && !isSameOffice) {
        return res.status(403).json({ status: 'error', code: 403, message: 'Anda hanya dapat membalas tiket milik sendiri atau unit kantor Anda.' });
      }
      finalVisibility = 'public';
    }

    const senderRole = user ? user.role : 'UPT_LUAR';
    const senderName = user ? user.name : 'Pelapor Layanan';
    const senderId = user ? user.user_id : 'PUBLIC';
    const threadId = `TH-${Date.now().toString().slice(-6)}`;

    await pool.query(`
      INSERT INTO threads (thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [threadId, id, senderId, senderName, senderRole, message.trim(), finalVisibility]);

    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE ticket_id = ?', [id]);

    // Audit Log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, ticket_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'THREAD_REPLY', 'THREAD', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, id, senderId, senderName, senderRole, threadId,
        `Tanggapan baru (${visibility})`,
        `Pesan baru dikirimkan pada tiket #${id}`
      ]);
    } catch (e) {}

    const [newThread] = await pool.query('SELECT * FROM threads WHERE thread_id = ?', [threadId]);

    // Kirim notifikasi Telegram untuk balasan publik
    if (finalVisibility === 'public') {
      try {
        sendNewReplyAlert(ticket, senderName, senderRole, message.trim(), 'public').catch(err => {
          console.warn('[Telegram Thread Alert Error]', err.message);
        });
      } catch (e) {}
    }

    return res.status(201).json({
      status: 'success',
      message: 'Pesan balasan berhasil terkirim.',
      data: newThread[0]
    });
  } catch (err) {
    console.error('Error in addThreadMessage:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal mengirim pesan.' });
  }
}

/**
 * Request Ticket Reopen (Pelapor mengajukan buka kembali tiket yang closed)
 */
export async function requestTicketReopen(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Alasan pengajuan buka kembali tiket wajib diisi.'
      });
    }

    const [ticketRows] = await pool.query('SELECT * FROM tickets WHERE ticket_id = ? LIMIT 1', [id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'Tiket tidak ditemukan.' });
    }

    const ticket = ticketRows[0];

    if (ticket.status !== 'closed') {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Permohonan buka kembali hanya berlaku untuk tiket yang berstatus Closed.'
      });
    }

    // Periksa apakah sudah ada permohonan pending
    const [existingPending] = await pool.query(
      "SELECT * FROM ticket_reopen_requests WHERE ticket_id = ? AND status = 'PENDING' LIMIT 1",
      [id]
    );

    if (existingPending.length > 0) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Tiket ini sudah memiliki permohonan buka kembali yang sedang menunggu persetujuan Operator UPT Pusat.'
      });
    }

    const requestId = `ROP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const requesterId = user ? user.user_id : 'PUBLIC';
    const requesterName = user ? user.name : ticket.requester_name;
    const requesterEmail = user ? user.email : ticket.requester_email;

    await pool.query(`
      INSERT INTO ticket_reopen_requests (
        request_id, ticket_id, requester_id, requester_name, requester_email, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW())
    `, [requestId, id, requesterId, requesterName, requesterEmail, reason.trim()]);

    // Update tickets reopen_status
    await pool.query("UPDATE tickets SET reopen_status = 'PENDING' WHERE ticket_id = ?", [id]);

    // Add thread notification
    const threadId = `TH-${Date.now().toString().slice(-6)}`;
    const reopenNotice = `📢 [PERMOHONAN REOPEN] Pelapor (${requesterName}) mengajukan permohonan buka kembali tiket ini dengan alasan: "${reason.trim()}". Menunggu peninjauan Operator UPT Pusat.`;
    await pool.query(`
      INSERT INTO threads (thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility)
      VALUES (?, ?, ?, ?, ?, ?, 'public')
    `, [threadId, id, requesterId, requesterName, user ? user.role : 'PELAPOR', reopenNotice]);

    // Audit Log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, ticket_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'REOPEN_REQUESTED', 'TICKET', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, id, requesterId, requesterName, user ? user.role : 'PELAPOR', id,
        `Pengajuan buka kembali tiket #${id}: ${reason.trim()}`,
        `Permohonan reopen tiket diajukan oleh ${requesterName}`
      ]);
    } catch (e) {}

    // Kirim alert Telegram untuk permohonan reopen
    try {
      sendTicketReopenAlert(ticket, requesterName, reason.trim()).catch(err => {
        console.warn('[Telegram Reopen Alert Error]', err.message);
      });
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Permohonan buka kembali tiket berhasil diajukan dan dikirimkan ke Operator UPT Pusat.',
      data: {
        request_id: requestId,
        ticket_id: id,
        status: 'PENDING'
      }
    });
  } catch (err) {
    console.error('Error in requestTicketReopen:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal mengajukan permohonan buka kembali tiket.' });
  }
}

/**
 * Review Ticket Reopen (Operator UPT / Pusat menyetujui atau menolak permohonan)
 */
export async function reviewTicketReopen(req, res) {
  try {
    const { id } = req.params;
    const { action, note } = req.body;
    const user = req.user;

    const isStaff = user && (user.role === 'ADMIN' || user.role === 'ADMIN_PUSAT' || user.role === 'PETUGAS_UPT' || user.role === 'OPERATOR');
    if (!isStaff) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Akses ditolak. Hanya Operator UPT Pusat atau Administrator yang berwenang meninjau permohonan buka kembali tiket.'
      });
    }

    if (!action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return res.status(400).json({ status: 'error', code: 400, message: 'Tindakan verifikasi harus APPROVE atau REJECT.' });
    }

    const [ticketRows] = await pool.query('SELECT * FROM tickets WHERE ticket_id = ? LIMIT 1', [id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'Tiket tidak ditemukan.' });
    }

    const [pendingRequests] = await pool.query(
      "SELECT * FROM ticket_reopen_requests WHERE ticket_id = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1",
      [id]
    );

    const targetRequest = pendingRequests[0];
    const requestId = targetRequest ? targetRequest.request_id : null;

    if (action === 'APPROVE') {
      // 1. Setujui Reopen: Ubah status tiket menjadi open, kosongkan closed_at, buka kunci chat
      await pool.query(
        "UPDATE tickets SET status = 'open', closed_at = NULL, is_archived = 0, reopen_status = 'APPROVED', updated_at = NOW() WHERE ticket_id = ?",
        [id]
      );

      if (requestId) {
        await pool.query(
          "UPDATE ticket_reopen_requests SET status = 'APPROVED', reviewed_by = ?, reviewer_name = ?, review_note = ?, reviewed_at = NOW() WHERE request_id = ?",
          [user.user_id, user.name, note || 'Permohonan disetujui', requestId]
        );
      }

      // Thread message
      const threadId = `TH-${Date.now().toString().slice(-6)}`;
      const approveMessage = `✅ [TIKET DIBUKA KEMBALI] Permohonan buka kembali tiket telah DISETUJUI oleh Petugas UPT (${user.name}). Tiket kini berstatus OPEN dan percakapan kembali aktif. Catatan: "${note || 'Kendala akan ditindaklanjuti kembali.'}"`;
      await pool.query(`
        INSERT INTO threads (thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility)
        VALUES (?, ?, ?, ?, ?, ?, 'public')
      `, [threadId, id, user.user_id, user.name, user.role, approveMessage]);

      // Audit Log
      try {
        await pool.query(`
          INSERT INTO audit_logs (log_id, ticket_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
          VALUES (?, ?, ?, ?, 'REOPEN_APPROVED', 'TICKET', ?, ?, ?)
        `, [
          `LOG-${Date.now().toString().slice(-6)}`, id, user.user_id, user.name, user.role, id,
          `Tiket #${id} dibuka kembali (Reopen Approved) oleh ${user.name}`,
          `Persetujuan permohonan buka kembali tiket`
        ]);
      } catch (e) {}

      // Kirim notifikasi Telegram atas hasil review reopen
    try {
      const newStatusLabel = action === 'APPROVE' ? 'open (Reopen Disetujui)' : 'closed (Reopen Ditolak)';
      sendTicketStatusAlert(ticket, 'closed', newStatusLabel, user.name, note || (action === 'APPROVE' ? 'Permohonan buka kembali disetujui' : 'Permohonan buka kembali ditolak')).catch(err => {
        console.warn('[Telegram Reopen Review Alert Error]', err.message);
      });
    } catch (e) {}

    return res.status(200).json({
        status: 'success',
        message: 'Permohonan buka kembali tiket berhasil disetujui. Tiket kini berstatus Open dan percakapan kembali aktif.',
        data: { ticket_id: id, status: 'open', reopen_status: 'APPROVED' }
      });
    } else {
      // 2. Tolak Reopen: Status tiket tetap closed, chat tetap terkunci
      await pool.query(
        "UPDATE tickets SET reopen_status = 'REJECTED', updated_at = NOW() WHERE ticket_id = ?",
        [id]
      );

      if (requestId) {
        await pool.query(
          "UPDATE ticket_reopen_requests SET status = 'REJECTED', reviewed_by = ?, reviewer_name = ?, review_note = ?, reviewed_at = NOW() WHERE request_id = ?",
          [user.user_id, user.name, note || 'Permohonan ditolak oleh operator', requestId]
        );
      }

      // Thread message
      const threadId = `TH-${Date.now().toString().slice(-6)}`;
      const rejectMessage = `❌ [PERMOHONAN REOPEN DITOLAK] Permohonan pembukaan kembali tiket DITOLAK oleh Petugas UPT (${user.name}). Tiket tetap berstatus CLOSED. Alasan penolakan: "${note || 'Masalah telah diselesaikan sesuai SOP dan tidak memerlukan penanganan lanjutan.'}"`;
      await pool.query(`
        INSERT INTO threads (thread_id, ticket_id, sender_id, sender_name, sender_role, message, visibility)
        VALUES (?, ?, ?, ?, ?, ?, 'public')
      `, [threadId, id, user.user_id, user.name, user.role, rejectMessage]);

      // Audit Log
      try {
        await pool.query(`
          INSERT INTO audit_logs (log_id, ticket_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
          VALUES (?, ?, ?, ?, 'REOPEN_REJECTED', 'TICKET', ?, ?, ?)
        `, [
          `LOG-${Date.now().toString().slice(-6)}`, id, user.user_id, user.name, user.role, id,
          `Permohonan reopen tiket #${id} ditolak oleh ${user.name}: ${note || ''}`,
          `Penolakan permohonan buka kembali tiket`
        ]);
      } catch (e) {}

      return res.status(200).json({
        status: 'success',
        message: 'Permohonan buka kembali tiket telah ditolak. Tiket tetap berstatus Closed.',
        data: { ticket_id: id, status: 'closed', reopen_status: 'REJECTED' }
      });
    }
  } catch (err) {
    console.error('Error in reviewTicketReopen:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal meninjau permohonan reopen tiket.' });
  }
}

/**
 * Get Reopen Requests for a Ticket
 */
export async function getTicketReopenRequests(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM ticket_reopen_requests WHERE ticket_id = ? ORDER BY created_at DESC',
      [id]
    );

    return res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (err) {
    console.error('Error in getTicketReopenRequests:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal memuat riwayat permohonan reopen.' });
  }
}
