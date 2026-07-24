import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './index';

afterEach(() => vi.restoreAllMocks());

describe('ApiClient', () => {
  it('includes credentials and returns typed errors', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Inválido' }), { status: 400 }),
      );
    const client = new ApiClient('http://api.test');
    await expect(client.get('/resource')).rejects.toEqual(
      expect.objectContaining({ status: 400, message: 'Inválido' }),
    );
    expect(request).toHaveBeenCalledWith(
      'http://api.test/resource',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('coalesces refresh and retries a 401 once', async () => {
    let resourceCalls = 0;
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        if (String(input).endsWith('/refresh')) {
          return Promise.resolve(new Response('{}', { status: 200 }));
        }
        resourceCalls += 1;
        return Promise.resolve(
          resourceCalls <= 2
            ? new Response('{}', { status: 401 })
            : new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );
      });
    const client = new ApiClient('http://api.test');
    await Promise.all([client.get('/resource'), client.get('/resource')]);
    expect(
      request.mock.calls.filter(([input]) =>
        String(input).endsWith('/refresh'),
      ),
    ).toHaveLength(1);
  });
});
