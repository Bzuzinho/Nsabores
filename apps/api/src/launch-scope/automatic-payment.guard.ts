import { CanActivate, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AutomaticPaymentGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate() {
    const mode = this.config.get<string>('PAYMENT_FLOW_MODE') ?? 'manual';
    if (mode !== 'automatic') {
      throw new ConflictException(
        'Pagamentos online não estão ativos nesta fase.',
      );
    }
    return true;
  }
}
