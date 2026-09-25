import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../auth/auth.types';
import type {
  DeferredFeatureGuard,
} from '../launch-scope/deferred-feature.guard';
import {
  ReturnRequestStatusDtoValue,
  type ReturnStatusUpdateDto,
} from './dto';
import { AdminFulfillmentController } from './fulfillment.controller';
import type { FulfillmentService } from './fulfillment.service';

const user = { sub: 'user-1' } as AuthPrincipal;

function setup() {
  const updateReturnStatus = vi.fn().mockResolvedValue({ id: 'return-1' });
  const assertEnabled = vi.fn();
  const controller = new AdminFulfillmentController(
    { updateReturnStatus } as unknown as FulfillmentService,
    { assertEnabled } as unknown as DeferredFeatureGuard,
  );

  return { controller, updateReturnStatus, assertEnabled };
}

describe('AdminFulfillmentController launch scope', () => {
  it.each([
    ReturnRequestStatusDtoValue.REFUND_PENDING,
    ReturnRequestStatusDtoValue.REFUNDED,
  ])('protege %s como estado financeiro adiado', async (status) => {
    const { controller, assertEnabled } = setup();

    await controller.updateReturnStatus(
      user,
      'return-1',
      { status } as ReturnStatusUpdateDto,
    );

    expect(assertEnabled).toHaveBeenCalledOnce();
  });

  it(
    'mantém os restantes estados da devolução disponíveis no arranque',
    async () => {
      const { controller, updateReturnStatus, assertEnabled } = setup();

      await controller.updateReturnStatus(
        user,
        'return-1',
        {
          status: ReturnRequestStatusDtoValue.INSPECTED,
        } as ReturnStatusUpdateDto,
      );

      expect(assertEnabled).not.toHaveBeenCalled();
      expect(updateReturnStatus).toHaveBeenCalledWith(
        'return-1',
        ReturnRequestStatusDtoValue.INSPECTED,
        user.sub,
        undefined,
      );
    },
  );
});
