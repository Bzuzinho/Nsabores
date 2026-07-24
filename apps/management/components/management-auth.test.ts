import { describe, expect, it } from 'vitest';
import { roleHasAccess } from './management-auth';

describe('management access', () => {
  it('allows staff/admin, blocks customers, and reserves user admin for admins', () => {
    expect(roleHasAccess('STAFF', ['STAFF', 'ADMIN'])).toBe(true);
    expect(roleHasAccess('ADMIN', ['STAFF', 'ADMIN'])).toBe(true);
    expect(roleHasAccess('CUSTOMER', ['STAFF', 'ADMIN'])).toBe(false);
    expect(roleHasAccess('STAFF', ['ADMIN'])).toBe(false);
  });
});
