import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

afterEach(() => vi.restoreAllMocks());

describe('catalog management proxy', () => {
  it('keeps the admin key server-side and forwards listings', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    const response = await GET(
      new NextRequest('http://localhost/api/catalog/products'),
      {
        params: Promise.resolve({ path: ['products'] }),
      },
    );
    expect(response.status).toBe(200);
    expect(request).toHaveBeenCalledWith(
      new URL('http://localhost:4000/v1/admin/products'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-admin-api-key': expect.any(String),
        }),
      }),
    );
  });

  it('forwards validation errors from form submissions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Slug ou SKU já existe.' }), {
        status: 409,
      }),
    );
    const response = await POST(
      new NextRequest('http://localhost/api/catalog/products', {
        method: 'POST',
        body: JSON.stringify({ sku: 'DUPLICADO' }),
      }),
      { params: Promise.resolve({ path: ['products'] }) },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Slug ou SKU já existe.',
    });
  });

  it('returns a controlled unavailable response', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const response = await GET(
      new NextRequest('http://localhost/api/catalog/products'),
      {
        params: Promise.resolve({ path: ['products'] }),
      },
    );
    expect(response.status).toBe(503);
  });
});
