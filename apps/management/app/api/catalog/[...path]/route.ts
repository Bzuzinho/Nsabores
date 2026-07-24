import { NextRequest, NextResponse } from 'next/server';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const target = new URL(`/v1/admin/${path.join('/')}`, apiUrl);
  target.search = request.nextUrl.search;
  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.text();
  try {
    const response = await fetch(target, {
      method: request.method,
      headers: {
        'content-type': 'application/json',
        'x-admin-api-key': process.env.ADMIN_API_KEY ?? '',
      },
      body,
      cache: 'no-store',
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'API de catálogo indisponível.' },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
