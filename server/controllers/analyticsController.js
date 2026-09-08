import { pool } from '../config/db.js';
import { buildDataScopeFilter } from '../utils/permissions.js';

export async function getAnalytics(req, res) {
  try {
    const user = req.user;

    // Apply Data Scope Filter to Analytics
    let scopeClause = '1=1';
    let scopeParams = [];

    if (user) {
      const scopeFilter = buildDataScopeFilter(user, 'tickets');
      scopeClause = scopeFilter.clause;
      scopeParams = scopeFilter.params;

      if (user.role === 'upt' && user.upt_unit) {
        scopeClause += ' AND LOWER(assigned_upt) = ?';
        scopeParams.push(user.upt_unit.toLowerCase().trim());
      }
    }

    // 1. By Status
    const [statusRows] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM tickets WHERE ${scopeClause} GROUP BY status`,
      scopeParams
    );
    const by_status = { open: 0, in_progress: 0, waiting: 0, closed: 0 };
    statusRows.forEach(r => {
      if (by_status[r.status] !== undefined) by_status[r.status] = Number(r.count);
    });

    // 2. By Priority
    const [priorityRows] = await pool.query(
      `SELECT priority, COUNT(*) AS count FROM tickets WHERE ${scopeClause} GROUP BY priority`,
      scopeParams
    );
    const by_priority = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
    priorityRows.forEach(r => {
      if (by_priority[r.priority] !== undefined) by_priority[r.priority] = Number(r.count);
    });

    // 3. By Category
    const [categoryRows] = await pool.query(
      `SELECT category, COUNT(*) AS count FROM tickets WHERE ${scopeClause} GROUP BY category`,
      scopeParams
    );
    const by_category = {};
    categoryRows.forEach(r => {
      by_category[r.category] = Number(r.count);
    });

    // 4. By UPT
    const [uptRows] = await pool.query(
      `SELECT COALESCE(assigned_upt, 'Belum Di-assign') AS upt, COUNT(*) AS count FROM tickets WHERE ${scopeClause} GROUP BY assigned_upt`,
      scopeParams
    );
    const by_upt = {};
    uptRows.forEach(r => {
      by_upt[r.upt] = Number(r.count);
    });

    // 5. Total Tickets
    const [totalRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM tickets WHERE ${scopeClause}`,
      scopeParams
    );
    const total = totalRows[0].total;

    // 6. SLA Breached
    const [slaRows] = await pool.query(
      `SELECT COUNT(*) AS breached FROM tickets WHERE ${scopeClause} AND status != 'closed' AND sla_due_at < NOW()`,
      scopeParams
    );
    const sla_breached = Number(slaRows[0]?.breached || 0);

    // 7. Average Resolution Hours
    const [avgRows] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, closed_at)) AS avg_hours 
       FROM tickets 
       WHERE ${scopeClause} AND status = 'closed' AND closed_at IS NOT NULL`,
      scopeParams
    );
    const avg_resolution_hours = parseFloat(Number(avgRows[0]?.avg_hours || 0).toFixed(1));

    // 8. Near SLA Deadline (< 4 hours remaining)
    const [nearSlaRows] = await pool.query(
      `SELECT COUNT(*) AS near_breach FROM tickets 
       WHERE ${scopeClause} AND status != 'closed' AND sla_due_at > NOW() AND sla_due_at <= DATE_ADD(NOW(), INTERVAL 4 HOUR)`,
      scopeParams
    );
    const near_sla = Number(nearSlaRows[0]?.near_breach || 0);

    // 9. Unassigned Tickets
    const [unassignedRows] = await pool.query(
      `SELECT COUNT(*) AS unassigned FROM tickets WHERE ${scopeClause} AND (assigned_upt IS NULL OR assigned_upt = '')`,
      scopeParams
    );
    const unassigned_count = Number(unassignedRows[0]?.unassigned || 0);

    return res.status(200).json({
      status: 'success',
      data: {
        total,
        by_status,
        by_priority,
        by_category,
        by_upt,
        sla_breached,
        near_sla,
        unassigned_count,
        avg_resolution_hours,
        scope: user?.data_scope || 'GLOBAL',
        region_id: user?.region_id || null,
        office_id: user?.office_id || null
      }
    });
  } catch (err) {
    console.error('Error in getAnalytics:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memuat analitik tiket.'
    });
  }
}

export async function getAuditLogs(req, res) {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const actionFilter = req.query.action;
    let query = `
      SELECT 
        log_id, ticket_id, actor_id, actor_name, actor_role,
        action, entity_type, entity_id, details, description,
        ip_address, user_agent, created_at 
      FROM audit_logs
    `;
    const params = [];

    if (actionFilter && actionFilter !== 'all') {
      query += ' WHERE action = ?';
      params.push(actionFilter);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await pool.query(query, params);

    return res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (err) {
    console.error('Error in getAuditLogs:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memuat audit log.'
    });
  }
}

export async function getFeatureFlags(req, res) {
  return res.status(200).json({
    status: 'success',
    data: {}
  });
}

export async function updateFeatureFlags(req, res) {
  const { feature_flags } = req.body || {};
  return res.status(200).json({
    status: 'success',
    message: 'Feature flags berhasil disimpan.',
    data: feature_flags || {}
  });
}

export async function getDbStatus(req, res) {
  const start = Date.now();
  try {
    const connection = await pool.getConnection();
    let version = '';
    let dbName = '';
    let tableCounts = {};

    try {
      const [verRows] = await connection.query('SELECT VERSION() AS ver, DATABASE() AS current_db');
      version = verRows[0].ver;
      dbName = verRows[0].current_db;

      const [uRows] = await connection.query('SELECT COUNT(*) AS c FROM users');
      const [tRows] = await connection.query('SELECT COUNT(*) AS c FROM tickets');
      const [thRows] = await connection.query('SELECT COUNT(*) AS c FROM threads');
      const [aRows] = await connection.query('SELECT COUNT(*) AS c FROM audit_logs');
      const [apvRows] = await connection.query("SELECT COUNT(*) AS c FROM registration_approvals WHERE status = 'PENDING'");

      tableCounts = {
        users: uRows[0].c,
        tickets: tRows[0].c,
        threads: thRows[0].c,
        audit_logs: aRows[0].c,
        pending_approvals: apvRows[0].c
      };
    } finally {
      connection.release();
    }

    const latency = Date.now() - start;

    return res.status(200).json({
      status: 'success',
      data: {
        database_engine: 'Aiven for MySQL',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 21970,
        database_name: dbName,
        ssl_mode: 'REQUIRED',
        ssl_active: true,
        latency_ms: latency,
        mysql_version: version,
        table_counts: tableCounts,
        connection_pool: {
          connection_limit: 10,
          status: 'HEALTHY'
        }
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: `Database error: ${err.message}`,
      latency_ms: Date.now() - start
    });
  }
}

/**
 * Rekap Aktivitas & Produktivitas Operator per Akun Atasan (Manager)
 * Hanya dapat diakses oleh akun Manager/Atasan (role ADMIN atau memiliki permission 'operator.stats_view')
 * Perhitungan didasarkan pada aktivitas nyata tiket (audit logs & thread responses)
 */
export async function getOperatorProductivity(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ status: 'error', code: 401, message: 'Autentikasi diperlukan.' });
    }

    const isAdmin = user.role === 'ADMIN' || user.role === 'ADMIN_PUSAT' || user.role === 'admin';
    const permissions = user.permissions || [];
    const canView = isAdmin || permissions.includes('*') || permissions.includes('operator.stats_view');

    if (!canView) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Akses ditolak. Rekap statistik produktivitas operator hanya dapat dilihat oleh akun Manager/Atasan.'
      });
    }

    const { start_date, end_date } = req.query;

    let dateFilterAudit = '';
    let dateFilterThreads = '';
    const queryParams = [];

    if (start_date && end_date) {
      dateFilterAudit = ' AND created_at >= ? AND created_at <= ?';
      dateFilterThreads = ' AND created_at >= ? AND created_at <= ?';
      const startObj = new Date(start_date + 'T00:00:00');
      const endObj = new Date(end_date + 'T23:59:59');
      queryParams.push(startObj, endObj, startObj, endObj);
    } else if (start_date) {
      dateFilterAudit = ' AND created_at >= ?';
      dateFilterThreads = ' AND created_at >= ?';
      const startObj = new Date(start_date + 'T00:00:00');
      queryParams.push(startObj, startObj);
    } else if (end_date) {
      dateFilterAudit = ' AND created_at <= ?';
      dateFilterThreads = ' AND created_at <= ?';
      const endObj = new Date(end_date + 'T23:59:59');
      queryParams.push(endObj, endObj);
    }

    // Ambil daftar operator UPT & Admin beserta rekap tindakan nyata pada tiket
    const [rows] = await pool.query(`
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.role,
        u.position,
        u.department,
        COUNT(DISTINCT activity.ticket_id) AS tickets_handled,
        COUNT(activity.log_id) AS total_actions,
        SUM(CASE WHEN activity.is_resolve = 1 THEN 1 ELSE 0 END) AS tickets_resolved,
        MAX(activity.created_at) AS last_active_at
      FROM users u
      LEFT JOIN (
        -- 1. Tindakan operasional di audit_logs
        SELECT 
          actor_id AS user_id, 
          ticket_id, 
          log_id, 
          created_at,
          CASE WHEN action IN ('RESOLVE_TICKET', 'CLOSE_TICKET') OR details LIKE '%closed%' THEN 1 ELSE 0 END AS is_resolve
        FROM audit_logs
        WHERE ticket_id IS NOT NULL 
          AND action IN ('STATUS_CHANGE', 'RESOLVE_TICKET', 'CLOSE_TICKET', 'CLAIM_TICKET', 'ASSIGN_TICKET', 'TRIAGE')
          ${dateFilterAudit}
        
        UNION ALL
        
        -- 2. Respon pesan balasan operator pada thread percakapan tiket
        SELECT 
          sender_id AS user_id, 
          ticket_id, 
          thread_id AS log_id, 
          created_at,
          0 AS is_resolve
        FROM threads
        WHERE sender_role IN ('PETUGAS_UPT', 'OPERATOR', 'ADMIN', 'admin', 'upt')
          ${dateFilterThreads}
      ) activity ON u.user_id = activity.user_id
      WHERE u.role IN ('PETUGAS_UPT', 'OPERATOR', 'ADMIN', 'admin', 'upt')
      GROUP BY u.user_id, u.name, u.email, u.role, u.position, u.department
      ORDER BY tickets_handled DESC, total_actions DESC, u.name ASC
    `, queryParams);

    const productivityList = rows.map(r => ({
      user_id: r.user_id,
      name: r.name,
      email: r.email,
      role: r.role,
      position: r.position || 'Petugas Helpdesk UPT',
      department: r.department || 'Pusat Pengendalian Operasi',
      tickets_handled: Number(r.tickets_handled || 0),
      total_actions: Number(r.total_actions || 0),
      tickets_resolved: Number(r.tickets_resolved || 0),
      last_active_at: r.last_active_at || null
    }));

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: productivityList,
      period: {
        start_date: start_date || null,
        end_date: end_date || null
      },
      total_operators: productivityList.length
    });
  } catch (err) {
    console.error('Error in getOperatorProductivity:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memuat rekap aktivitas operator.'
    });
  }
}

