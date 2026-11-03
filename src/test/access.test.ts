import { describe, it, expect } from 'vitest';
import { isAdminUser } from '../portal/utils/access';
describe('delete permission', () => {
  it('admin role can delete', () => expect(isAdminUser({ roleId: 'role_admin' })).toBe(true));
  it('system admin can delete', () => expect(isAdminUser({ roleId: 'x', isSystemAdmin: true })).toBe(true));
  it('analyst cannot delete', () => expect(isAdminUser({ roleId: 'role_analyst' })).toBe(false));
  it('no user cannot delete', () => expect(isAdminUser(null)).toBe(false));
});
