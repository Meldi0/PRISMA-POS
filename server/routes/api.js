import express from 'express';
import { authenticate, requireAuth, requireRole, requirePermission } from '../middleware/authMiddleware.js';
import * as authController from '../controllers/authController.js';
import * as ticketController from '../controllers/ticketController.js';
import * as userController from '../controllers/userController.js';
import * as approvalController from '../controllers/approvalController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import { pool } from '../config/db.js';

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
router.get('/roles', userController.getRoles);

// -------------------------------------------------------------------------------------------------
// 3. AUTHENTICATION & MFA
// -------------------------------------------------------------------------------------------------
router.post('/auth/login', authController.login);
router.post('/auth/mfa/verify', authController.verifyMfa);
router.post('/auth/mfa/resend', authController.resendMfaOtp);
router.post('/auth/register', authController.register);
router.get('/auth/me', requireAuth, authController.getProfile);
router.post('/auth/mfa/setup', requireAuth, authController.setupMfa);
router.post('/auth/mfa/confirm', requireAuth, authController.confirmMfa);

// -------------------------------------------------------------------------------------------------
// 4. TICKETS & THREADS
// -------------------------------------------------------------------------------------------------
router.get('/tickets', ticketController.getTickets);
router.post('/tickets', ticketController.createTicket);
router.get('/tickets/track/:id', ticketController.trackTicket);
router.get('/tickets/:id', ticketController.getTicketDetail);
router.patch('/tickets/:id/status', requireAuth, requirePermission(['ticket.change_status', 'ticket.resolve', 'ticket.close']), ticketController.updateTicketStatus);
router.post('/tickets/:id/threads', ticketController.addThreadMessage);

// -------------------------------------------------------------------------------------------------
// 5. USER REGISTRATION APPROVAL (Admin Pusat)
// -------------------------------------------------------------------------------------------------
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
router.get('/admin/db-status', requireAuth, analyticsController.getDbStatus);

// -------------------------------------------------------------------------------------------------
// 8. TICKETING MONITORING & ANALYTICS (Scoped)
// -------------------------------------------------------------------------------------------------
router.get('/analytics', requireAuth, requirePermission(['monitoring.view', 'analytics.view']), analyticsController.getAnalytics);

export default router;
