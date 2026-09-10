export const normalizeRole = (role) => {
  if (['ADMIN', 'ADMIN_PUSAT', 'admin'].includes(role)) return 'ADMIN';
  if (['PETUGAS_UPT', 'OPERATOR', 'operator', 'upt', 'upt_pusat'].includes(role)) return 'PETUGAS_UPT';
  if (['UPT_LUAR', 'PELAPOR', 'USER_CABANG', 'USER_REGIONAL', 'pengguna_umum'].includes(role)) return 'UPT_LUAR';
  return null;
};
export const isAdmin = (user) => normalizeRole(user?.role) === 'ADMIN';
export const isStaff = (user) => ['ADMIN', 'PETUGAS_UPT'].includes(normalizeRole(user?.role));
export const isActive = (user) => Boolean(user && !user.isBlocked && user.is_active && user.account_status === 'ACTIVE');
export const can = (user, permission) => isActive(user) && (isAdmin(user) || Boolean(user.can?.(permission)) || user.allowedPermissions?.includes(permission) === true);

export function scopeFor(user) {
  if (isAdmin(user)) return 'GLOBAL';
  return ['GLOBAL', 'REGIONAL', 'OFFICE', 'OWN'].includes(user?.data_scope) ? user.data_scope : 'OWN';
}

export function ownsTicket(user, ticket) {
  // Names are not identifiers. Legacy tickets are matched only by the verified account email.
  return Boolean(user?.user_id && (ticket.requester_id === user.user_id || (!ticket.requester_id && user.email?.toLowerCase() === ticket.requester_email?.toLowerCase())));
}

export function canAccessTicket(user, ticket) {
  if (!isActive(user) || !(can(user, 'ticket.view') || can(user, 'ticket.view_own'))) return false;
  const scope = scopeFor(user);
  if (scope === 'GLOBAL') return true;
  if (ownsTicket(user, ticket)) return true;
  if (scope === 'REGIONAL') return Boolean(user.region_id && user.region_id === ticket.region_id);
  if (scope === 'OFFICE') return Boolean(user.office_id && user.office_id === ticket.office_id);
  return false;
}
