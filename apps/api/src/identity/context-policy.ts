// Authorization policy for the V2 identity model. Pure and deny-by-default.
// Callers must load actor, target and membership from trusted database records.
export const contextPermissions = [
  'catalog:read',
  'orders:read',
  'orders:create',
  'orders:cancel',
  'deliveries:read',
  'documents:read',
  'ledger:read',
  'payments:submit',
  'entity:manage',
  'members:manage',
  'resale:apply',
] as const;

export type ContextPermission = (typeof contextPermissions)[number];

export interface ContextActor {
  id: string;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
}

export interface ContextParty {
  id: string;
  kind: 'PERSON' | 'ORGANIZATION';
  userId: string | null;
  isActive: boolean;
  profiles: readonly { kind: 'CLIENT' | 'RESELLER'; resellerStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | null }[];
}

export interface ContextMembership {
  userId: string;
  partyId: string;
  isActive: boolean;
  permissions: readonly string[];
}

const personalPermissions = new Set<ContextPermission>(
  contextPermissions.filter((permission) => permission !== 'members:manage'),
);
const commercialPermissions = new Set<ContextPermission>([
  'catalog:read', 'orders:read', 'orders:create', 'orders:cancel',
  'deliveries:read', 'documents:read', 'ledger:read', 'payments:submit',
  'resale:apply',
]);

export function canAccessContext(
  actor: ContextActor,
  party: ContextParty,
  membership: ContextMembership | null,
  permission: ContextPermission,
): boolean {
  if (!actor.isActive || actor.deletedAt !== null || !actor.emailVerifiedAt || !party.isActive) return false;
  if (!contextPermissions.includes(permission)) return false;
  if (commercialPermissions.has(permission) && !party.profiles.some((p) => p.kind === 'CLIENT')) return false;
  if (party.kind === 'PERSON') {
    return party.userId === actor.id && personalPermissions.has(permission);
  }
  return party.kind === 'ORGANIZATION'
    && party.userId === null
    && membership !== null
    && membership.isActive
    && membership.userId === actor.id
    && membership.partyId === party.id
    && membership.permissions.includes(permission);
}

export function canViewResellerPrices(
  actor: ContextActor,
  party: ContextParty,
  membership: ContextMembership | null,
  terms: { resellerLevel: number | null; priceListId: string | null } | null,
): boolean {
  return canAccessContext(actor, party, membership, 'catalog:read')
    && party.profiles.some((p) => p.kind === 'RESELLER' && p.resellerStatus === 'APPROVED')
    && terms !== null
    && terms.resellerLevel !== null
    && [1, 2, 3].includes(terms.resellerLevel)
    && Boolean(terms.priceListId);
}
