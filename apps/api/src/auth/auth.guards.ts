import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ROLES_KEY } from './auth.decorators';
import type { AuthPrincipal, RequestWithAuth } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = request.cookies?.nsabores_access;
    if (!token) throw new UnauthorizedException('Sessão necessária.');
    try {
      const principal = await this.jwt.verifyAsync<AuthPrincipal>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: principal.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });
      if (!user?.isActive) throw new UnauthorizedException('Sessão inválida.');
      request.user = { sub: user.id, email: user.email, role: user.role };
      return true;
    } catch {
      throw new UnauthorizedException('Sessão expirada ou inválida.');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<RequestWithAuth>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Não tem permissão para esta operação.');
    }
    return true;
  }
}
