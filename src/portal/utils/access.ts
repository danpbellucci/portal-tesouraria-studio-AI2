/** Module visibility by profile. Admin-only and analyst-hidden modules. */
export const ADMIN_ONLY_MODULES = ['users', 'docs'];
export const HIDDEN_FOR_ANALYST = ['audit'];

export function canAccessModule(moduleId: string, user: { roleId?: string; isSystemAdmin?: boolean } | null | undefined): boolean {
  if (!user) return false;
  const isAdmin = !!user.isSystemAdmin || user.roleId === 'role_admin';
  if (ADMIN_ONLY_MODULES.includes(moduleId)) return isAdmin;
  if (HIDDEN_FOR_ANALYST.includes(moduleId)) return user.roleId !== 'role_analyst';
  return true;
}

/** Only administrators may delete data (enforced again in the backend for every DELETE). */
export function isAdminUser(user: { roleId?: string; isSystemAdmin?: boolean } | null | undefined): boolean {
  return !!user && (!!user.isSystemAdmin || user.roleId === 'role_admin');
}
