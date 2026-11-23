import { KsbmCurrentUser, WholesalePermission } from '../types';

const ADMIN_ROLES = new Set(['master_admin', 'admin', 'owner', 'super_admin']);
const MANAGER_ROLES = new Set(['manager', 'store_manager', 'supervisor']);

const MANAGER_DEFAULT_PERMISSIONS = new Set<WholesalePermission>([
  'wholesale.view',
  'wholesale.scrape',
  'wholesale.catalog.edit',
  'wholesale.markups.edit',
  'wholesale.brands.manage',
  'wholesale.export',
]);

const STAFF_DEFAULT_PERMISSIONS = new Set<WholesalePermission>([
  'wholesale.view',
  'wholesale.export',
]);

/**
 * Evaluates whether the KSBM user passed from the Master Shell has a specific module permission.
 * - `master_admin` / `admin` / `owner` always have full access.
 * - If `currentUser.permissions` array is provided, checks exact match or `'wholesale.*'` / `'*'`.
 * - Otherwise falls back to sensible role defaults (`manager` vs `staff`).
 */
export function hasWholesalePermission(
  user: KsbmCurrentUser | undefined,
  permission: WholesalePermission
): boolean {
  if (!user) return false;

  const normalizedRole = (user.role || '').toLowerCase().trim();
  if (ADMIN_ROLES.has(normalizedRole)) {
    return true;
  }

  if (Array.isArray(user.permissions)) {
    if (user.permissions.includes('*') || user.permissions.includes('wholesale.*')) {
      return true;
    }
    return user.permissions.includes(permission);
  }

  if (MANAGER_ROLES.has(normalizedRole)) {
    return MANAGER_DEFAULT_PERMISSIONS.has(permission);
  }

  return STAFF_DEFAULT_PERMISSIONS.has(permission);
}
