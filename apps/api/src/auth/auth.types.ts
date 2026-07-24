import type { UserRole } from '@prisma/client';

export interface AuthPrincipal {
  sub: string;
  email: string;
  role: UserRole;
}

export interface RequestWithAuth {
  cookies?: Record<string, string | undefined>;
  user?: AuthPrincipal;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
