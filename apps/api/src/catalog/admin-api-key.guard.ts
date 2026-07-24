import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const supplied = context
      .switchToHttp()
      .getRequest<{ header(name: string): string | undefined }>()
      .header('x-admin-api-key');
    const expected = this.config.get<string>('ADMIN_API_KEY');
    if (!supplied || !expected)
      throw new UnauthorizedException('Chave administrativa inválida.');
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Chave administrativa inválida.');
    }
    return true;
  }
}
