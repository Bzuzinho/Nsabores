import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeferredFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  assertEnabled() {
    const enabled =
      this.config.get<boolean>('DEFERRED_FEATURES_ENABLED') ?? true;
    if (!enabled) {
      throw new NotFoundException(
        'Funcionalidade prevista para uma fase posterior.',
      );
    }
  }

  canActivate(_context: ExecutionContext) {
    this.assertEnabled();
    return true;
  }
}
