import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentStatus } from '@prisma/client';

export interface PaymentSession {
  provider: string;
  providerPaymentId: string;
  redirectUrl: string;
}

export interface PaymentRefund {
  providerRefundId: string;
  amountCents: number;
  status: PaymentStatus;
  idempotencyKey: string;
}

@Injectable()
export class PaymentProvider {
  constructor(private readonly config: ConfigService) {}

  create(orderId: string): PaymentSession {
    const provider = this.config.get<string>('PAYMENT_PROVIDER') ?? 'mock';
    if (provider !== 'mock') {
      throw new NotImplementedException(
        `O provider ${provider} está preparado por configuração, mas requer o adaptador e credenciais do operador.`,
      );
    }
    const providerPaymentId = `mock_${randomUUID()}`;
    return {
      provider,
      providerPaymentId,
      redirectUrl: `${this.config.get<string>('PAYMENT_SUCCESS_URL') ?? 'http://localhost:3000/checkout/sucesso'}?orderId=${orderId}&paymentId=${providerPaymentId}`,
    };
  }

  refund(
    providerPaymentId: string,
    amountCents: number,
    idempotencyKey: string,
  ): PaymentRefund {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException('Montante de reembolso inválido.');
    }
    const provider = this.config.get<string>('PAYMENT_PROVIDER') ?? 'mock';
    if (provider !== 'mock') {
      throw new NotImplementedException(
        `O provider ${provider} requer um adaptador de reembolso real antes de poder emitir créditos.`,
      );
    }
    return {
      providerRefundId: `mock_refund_${providerPaymentId}_${randomUUID()}`,
      amountCents,
      status: 'REFUNDED',
      idempotencyKey,
    };
  }

  signature(payload: string) {
    return createHmac(
      'sha256',
      this.config.get<string>('PAYMENT_WEBHOOK_SECRET') ??
        'development-mock-webhook-secret',
    )
      .update(payload)
      .digest('hex');
  }

  verify(payload: string, signature?: string) {
    if (!signature) return false;
    const expected = Buffer.from(this.signature(payload));
    const received = Buffer.from(signature);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  supportsRefund() {
    return this.isMock();
  }

  isMock() {
    return (this.config.get<string>('PAYMENT_PROVIDER') ?? 'mock') === 'mock';
  }

  refundStatus(): PaymentStatus {
    return 'REFUNDED';
  }
}
