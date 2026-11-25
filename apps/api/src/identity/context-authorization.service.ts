import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { canAccessContext, canViewResellerPrices, type ContextPermission } from './context-policy';

// Use a transaction client so authorization and subsequent business operation
// can share the same transaction. No public endpoint uses this service yet.
@Injectable()
export class ContextAuthorizationService {
  async requireContext(
    tx: Prisma.TransactionClient,
    userId: string,
    partyId: string,
    permission: ContextPermission,
  ) {
    const [actor, party, membership] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true, emailVerifiedAt: true, deletedAt: true },
      }),
      tx.party.findUnique({
        where: { id: partyId },
        include: { profiles: true, commercialTerms: true },
      }),
      tx.partyMembership.findUnique({
        where: { partyId_userId: { partyId, userId } },
      }),
    ]);
    if (!actor || !party || !canAccessContext(actor, party, membership, permission)) {
      throw new ForbiddenException('Não tem autorização para esta operação.');
    }
    return {
      partyId: party.id,
      actorUserId: actor.id,
      resellerPriceListId: canViewResellerPrices(actor, party, membership, party.commercialTerms)
        ? party.commercialTerms?.priceListId ?? null
        : null,
    };
  }
}
