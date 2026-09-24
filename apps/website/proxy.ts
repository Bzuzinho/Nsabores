import { NextRequest, NextResponse } from 'next/server';

const accountPhase2Prefixes = [
  '/conta/clube',
  '/conta/fidelizacao',
  '/conta/documentos',
  '/conta/precos',
  '/conta/condicoes-comerciais',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/clube' || pathname.startsWith('/clube/')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/vales-oferta' || pathname.startsWith('/vales-oferta/')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (
    accountPhase2Prefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.redirect(new URL('/conta', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/clube/:path*',
    '/vales-oferta/:path*',
    '/conta/clube/:path*',
    '/conta/fidelizacao/:path*',
    '/conta/documentos/:path*',
    '/conta/precos/:path*',
    '/conta/condicoes-comerciais/:path*',
  ],
};
