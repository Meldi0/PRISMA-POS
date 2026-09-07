import { pool } from '../config/db.js';
import { buildDataScopeFilter } from '../utils/permissions.js';

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

    // Auto-inherit region & office from logged-in user if available
    const finalRegionId = region_id || (user ? user.region_id : 'REG-03');
    const finalOfficeId = office_id || (user ? user.office_id : 'OFC-KCU-BDG');

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
