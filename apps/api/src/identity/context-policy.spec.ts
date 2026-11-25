import { describe, expect, it } from 'vitest';
import { canAccessContext, canViewResellerPrices, type ContextActor, type ContextParty, type ContextMembership } from './context-policy';

const actor: ContextActor = { id: 'joao', isActive: true, deletedAt: null, emailVerifiedAt: new Date('2026-01-01') };
const personal: ContextParty = { id: 'joao-personal', kind: 'PERSON', userId: actor.id, isActive: true, profiles: [{ kind: 'CLIENT', resellerStatus: null }] };
const restaurant: ContextParty = { id: 'restaurant-x', kind: 'ORGANIZATION', userId: null, isActive: true, profiles: [{ kind: 'CLIENT', resellerStatus: null }] };
const buyer: ContextMembership = { userId: actor.id, partyId: restaurant.id, isActive: true, permissions: ['catalog:read', 'orders:read', 'orders:create', 'deliveries:read'] };
const approved: ContextParty = { ...restaurant, profiles: [...restaurant.profiles, { kind: 'RESELLER', resellerStatus: 'APPROVED' }] };
const terms = { resellerLevel: 2, priceListId: 'resale-2' };

describe('V2 identity context policy', () => {
  it('permits personal and authorized business purchases with one account', () => {
    expect(canAccessContext(actor, personal, null, 'orders:create')).toBe(true);
    expect(canAccessContext(actor, restaurant, buyer, 'orders:create')).toBe(true);
  });
  it('isolates the personal history of another employee', () => {
    expect(canAccessContext(actor, { ...personal, userId: 'maria' }, buyer, 'orders:read')).toBe(false);
  });
  it('separates buying, accounting and manager permissions', () => {
    const accounting = { ...buyer, permissions: ['documents:read', 'ledger:read'] };
    const manager = { ...buyer, permissions: ['members:manage', 'entity:manage'] };
    expect(canAccessContext(actor, restaurant, buyer, 'ledger:read')).toBe(false);
    expect(canAccessContext(actor, restaurant, accounting, 'ledger:read')).toBe(true);
    expect(canAccessContext(actor, restaurant, accounting, 'orders:create')).toBe(false);
    expect(canAccessContext(actor, restaurant, manager, 'members:manage')).toBe(true);
  });
  it('rejects forged, unrelated and revoked memberships', () => {
    for (const membership of [null, { ...buyer, userId: 'maria' }, { ...buyer, partyId: 'other' }, { ...buyer, isActive: false }]) {
      expect(canAccessContext(actor, restaurant, membership, 'orders:read')).toBe(false);
    }
    expect(canAccessContext(actor, personal, null, 'orders:read')).toBe(true);
  });
  it('rejects disabled identities and unverified or deleted users', () => {
    for (const user of [{ ...actor, isActive: false }, { ...actor, deletedAt: new Date() }, { ...actor, emailVerifiedAt: null }]) {
      expect(canAccessContext(user, restaurant, buyer, 'orders:read')).toBe(false);
    }
    expect(canAccessContext(actor, { ...restaurant, isActive: false }, buyer, 'orders:read')).toBe(false);
  });
  it('does not give reseller pricing to companies automatically', () => {
    expect(canViewResellerPrices(actor, restaurant, buyer, terms)).toBe(false);
    expect(canViewResellerPrices(actor, approved, buyer, terms)).toBe(true);
    expect(canViewResellerPrices(actor, personal, null, terms)).toBe(false);
    expect(canViewResellerPrices(actor, approved, null, terms)).toBe(false);
  });
  it('rejects pending, rejected or suspended resale and missing commercial terms', () => {
    for (const resellerStatus of ['PENDING', 'REJECTED', 'SUSPENDED'] as const) {
      expect(canViewResellerPrices(actor, { ...restaurant, profiles: [...restaurant.profiles, { kind: 'RESELLER', resellerStatus }] }, buyer, terms)).toBe(false);
    }
    expect(canViewResellerPrices(actor, approved, buyer, null)).toBe(false);
    expect(canViewResellerPrices(actor, approved, buyer, { ...terms, resellerLevel: 4 })).toBe(false);
    expect(canViewResellerPrices(actor, approved, buyer, { ...terms, priceListId: null })).toBe(false);
  });
  it('requires a commercial client profile and forbids personal member administration', () => {
    expect(canAccessContext(actor, { ...restaurant, profiles: [] }, buyer, 'orders:create')).toBe(false);
    expect(canAccessContext(actor, personal, null, 'members:manage')).toBe(false);
  });
});
