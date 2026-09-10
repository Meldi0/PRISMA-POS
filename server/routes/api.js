import express from 'express';
import { authenticate, requireAuth, requireRole, requirePermission } from '../middleware/authMiddleware.js';
import * as authController from '../controllers/authController.js';
import * as ticketController from '../controllers/ticketController.js';
import * as userController from '../controllers/userController.js';
import * as approvalController from '../controllers/approvalController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import * as dbConfigController from '../controllers/dbConfigController.js';
import { pool } from '../config/db.js';
import { rateLimit } from '../middleware/securityMiddleware.js';

const router = express.Router();

// Apply auth parser middleware to all routes
router.use(authenticate);

// -------------------------------------------------------------------------------------------------
// 1. SYSTEM & HEALTH CHECK
// -------------------------------------------------------------------------------------------------
router.get('/health', async (req, res) => {
  const start = Date.now();
  try {
    const [rows] = await pool.query('SELECT 1 + 2 AS three, DATABASE() AS db');
    res.status(200).json({
      status: 'success',
      message: 'POSO Backend API & Aiven MySQL Active',
      database: rows[0].db,
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed: ' + err.message,
      latency_ms: Date.now() - start
    });
  }
});

// -------------------------------------------------------------------------------------------------
// 2. MASTER DATA ORGANISASI & ROLES
// -------------------------------------------------------------------------------------------------
router.get('/regions', userController.getRegions);
router.get('/offices', userController.getOffices);
router.get('/roles', requireAuth, userController.getRoles);
router.get('/operators', requireAuth, requireRole(['ADMIN','PETUGAS_UPT']), userController.getOperators);

// -------------------------------------------------------------------------------------------------
// 3. AUTHENTICATION & MFA
// -------------------------------------------------------------------------------------------------
router.use('/auth', rateLimit('auth', 60));
router.post('/auth/login', rateLimit('login', 20), authController.login);
router.post('/auth/mfa/verify', authController.verifyMfa);
router.post('/auth/verify-mfa', authController.verifyMfa);
router.post('/auth/mfa/resend', authController.resendMfaOtp);
router.post('/auth/resend-mfa', authController.resendMfaOtp);
router.post('/auth/register', rateLimit('registration', 5, 3600), authController.register);
router.post('/auth/logout', requireAuth, authController.logout);
router.post('/auth/password', requireAuth, authController.changePassword);
router.get('/auth/me', requireAuth, authController.getProfile);
router.post('/auth/mfa/setup', requireAuth, authController.setupMfa);
router.post('/auth/mfa/confirm', requireAuth, authController.confirmMfa);

// -------------------------------------------------------------------------------------------------
// 4. TICKETS & THREADS
// -------------------------------------------------------------------------------------------------
router.use('/tickets', requireAuth);
router.get('/tickets', requirePermission(['ticket.view', 'ticket.view_own']), ticketController.getTickets);
router.post('/tickets', requirePermission('ticket.create'), rateLimit('create-ticket', 30, 3600), ticketController.createTicket);
router.get('/tickets/summary', requirePermission(['ticket.view', 'ticket.view_own']), ticketController.getTicketSummary);
router.get('/tickets/track/:id', ticketController.trackTicket);
router.get('/tickets/:id', ticketController.getTicketDetail);
router.patch('/tickets/:id/status', ticketController.updateTicketStatus);
router.post('/tickets/:id/threads', rateLimit('ticket-reply', 60, 900), ticketController.addThreadMessage);
router.post('/tickets/:id/request-reopen', ticketController.requestTicketReopen);
router.post('/tickets/:id/reopen-review', requirePermission('ticket.reopen'), ticketController.reviewTicketReopen);
router.get('/tickets/:id/reopen-requests', ticketController.getTicketReopenRequests);

// -------------------------------------------------------------------------------------------------
// 5. USER REGISTRATION APPROVAL (Admin Pusat)
// -------------------------------------------------------------------------------------------------
// User/permission mutations are administrator operations; delegated view permissions remain read-only.
router.use('/admin', (req, res, next) => req.method === 'GET' ? next() : requireRole('ADMIN')(req, res, next));
router.get('/admin/approvals', requireAuth, requirePermission(['approval.view', 'user.approve']), approvalController.getApprovals);
router.post('/admin/approvals/:id/approve', requireAuth, requirePermission(['approval.manage', 'user.approve']), approvalController.approveRegistration);
router.post('/admin/approvals/:id/reject', requireAuth, requirePermission(['approval.manage', 'user.reject']), approvalController.rejectRegistration);

// -------------------------------------------------------------------------------------------------
// 6. USER MANAGEMENT & GRANULAR ACCESS CONTROL
// -------------------------------------------------------------------------------------------------
router.get('/admin/users', requireAuth, requirePermission('user.view'), userController.getUsers);
router.post('/admin/users', requireAuth, requirePermission('user.create'), userController.createUser);
router.patch('/admin/users/:id', requireAuth, requirePermission(['user.update', 'user.edit', 'user.assign_role']), userController.updateUserRole);
router.delete('/admin/users/:id', requireAuth, requireRole(['ADMIN', 'ADMIN_PUSAT', 'admin']), userController.deleteUser);

// Permission Overrides
router.get('/admin/users/:id/permissions', requireAuth, requirePermission('permission.view'), userController.getUserPermissions);
router.put('/admin/users/:id/permissions', requireAuth, requirePermission('permission.manage'), userController.updateUserPermissions);

// User Account Status Controls
router.post('/admin/users/:id/suspend', requireAuth, requirePermission(['user.deactivate', 'user.suspend']), userController.suspendUser);
router.post('/admin/users/:id/activate', requireAuth, requirePermission(['user.update', 'user.activate']), userController.activateUser);
router.post('/admin/users/:id/reset-mfa', requireAuth, requirePermission(['user.update', 'mfa.reset']), userController.resetUserMfa);

// -------------------------------------------------------------------------------------------------
// 7. AUDIT LOGS, FEATURE CONFIG & DB MONITOR
// -------------------------------------------------------------------------------------------------
router.get('/admin/audit-logs', requireAuth, requirePermission(['audit.view', 'audit_log.view']), analyticsController.getAuditLogs);
router.get('/admin/features', requireAuth, analyticsController.getFeatureFlags);
router.put('/admin/features', requireAuth, requireRole(['ADMIN', 'ADMIN_PUSAT', 'admin']), analyticsController.updateFeatureFlags);
router.get('/admin/db-status', requireAuth, requireRole('ADMIN'), analyticsController.getDbStatus);

// Database Configuration & Switcher (Role Admin Only)
router.get('/admin/db-config', requireAuth, requireRole(['ADMIN', 'ADMIN_PUSAT', 'admin']), dbConfigController.getDbConfig);
router.post('/admin/db-config/test', requireAuth, requireRole(['ADMIN', 'ADMIN_PUSAT', 'admin']), dbConfigController.testDbConfig);
router.post('/admin/db-config/save', requireAuth, requireRole(['ADMIN', 'ADMIN_PUSAT', 'admin']), dbConfigController.saveDbConfig);
router.post('/admin/db-config/migrate', requireAuth, requireRole(['ADMIN', 'ADMIN_PUSAT', 'admin']), dbConfigController.migrateDbSchema);

// -------------------------------------------------------------------------------------------------
// 8. TICKETING MONITORING & ANALYTICS (Scoped)
// -------------------------------------------------------------------------------------------------
router.get('/analytics', requireAuth, requirePermission(['monitoring.view', 'analytics.view']), analyticsController.getAnalytics);
router.get('/analytics/operator-productivity', requireAuth, requirePermission('operator.stats_view'), analyticsController.getOperatorProductivity);

// -------------------------------------------------------------------------------------------------
// 9. TELEGRAM BOT GATEWAY
// -------------------------------------------------------------------------------------------------
router.get('/admin/telegram/status', requireAuth, requirePermission(['system.config', 'audit.view']), analyticsController.getTelegramStatus);
router.post('/admin/telegram/test', requireAuth, requirePermission(['system.config']), analyticsController.testTelegramNotification);

export default router;
