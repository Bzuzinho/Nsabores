import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface ShippingRequest {
  shipmentNumber: string;
  service: string;
  recipient: Record<string, unknown>;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface ShippingLabel {
  provider: string;
  providerShipmentId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  estimatedDeliveryAt?: Date;
}

@Injectable()
export class ShippingProvider {
  constructor(private readonly config: ConfigService) {}

  async createLabel(request: ShippingRequest): Promise<ShippingLabel> {
    const provider = this.config.get<string>('SHIPPING_PROVIDER', 'mock');
    if (provider !== 'mock') {
      throw new ServiceUnavailableException(
        `O provider de transporte ${provider} ainda não está configurado.`,
      );
    }

    const token = randomBytes(6).toString('hex').toUpperCase();
    const trackingNumber = `NS${token}`;
    return {
      provider,
      providerShipmentId: `mock_${request.shipmentNumber}_${token}`,
      trackingNumber,
      trackingUrl: `https://tracking.invalid/${trackingNumber}`,
      labelUrl: `https://labels.invalid/${trackingNumber}.pdf`,
      estimatedDeliveryAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    };
  }

  async cancel(_providerShipmentId: string): Promise<void> {
    const provider = this.config.get<string>('SHIPPING_PROVIDER', 'mock');
    if (provider !== 'mock') {
      throw new ServiceUnavailableException(
        `O provider de transporte ${provider} ainda não está configurado.`,
      );
    }
  }

  verifyWebhook(rawBody: string, signature?: string): boolean {
    const secret = this.config.get<string>('SHIPPING_WEBHOOK_SECRET');
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const supplied = signature.replace(/^sha256=/, '');
    if (expected.length !== supplied.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
  }
}
