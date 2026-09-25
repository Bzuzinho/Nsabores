import { OrderStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../auth/auth.types';
import type { DeferredFeatureGuard } from '../launch-scope/deferred-feature.guard';
import { AdminOrdersController } from './commerce.controller';
import type { CommerceService } from './commerce.service';
import type { OrderStatusDto } from './dto';
import type { ManualPaymentService } from './manual-payment.service';

const user = { sub: '00000000-0000-0000-0000-000000000001' } as AuthPrincipal;

function setup() {
  const changeStatus = vi.fn().mockResolvedValue({ id: 'order-1' });
  const assertEnabled = vi.fn();
  const controller = new AdminOrdersController(
    { changeStatus } as unknown as CommerceService,
    {} as ManualPaymentService,
    { assertEnabled } as unknown as DeferredFeatureGuard,
  );

  return { controller, changeStatus, assertEnabled };
}

describe('AdminOrdersController launch scope', () => {
  it.each([
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.REFUNDED,
  ])('protege o estado %s como funcionalidade adiada', async (status) => {
    const { controller, assertEnabled } = setup();

    await controller.status(
      user,
      'order-1',
      { status } as OrderStatusDto,
    );

    expect(assertEnabled).toHaveBeenCalledOnce();
  });

  it('mantém o ciclo simples de tratamento disponível no arranque', async () => {
    const { controller, changeStatus, assertEnabled } = setup();

    await controller.status(
      user,
      'order-1',
      { status: OrderStatus.PROCESSING } as OrderStatusDto,
    );

    expect(assertEnabled).not.toHaveBeenCalled();
    expect(changeStatus).toHaveBeenCalledWith(
      'order-1',
      OrderStatus.PROCESSING,
      user.sub,
      undefined,
    );
  });
});
