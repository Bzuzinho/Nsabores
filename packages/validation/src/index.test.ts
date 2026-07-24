import { describe, expect, it } from 'vitest';
import { createHealthResponse } from './index';

describe('createHealthResponse', () => {
  it('creates a typed health payload using the supplied time', () => {
    const now = new Date('2026-07-24T10:00:00.000Z');

    expect(createHealthResponse('api', now)).toEqual({
      service: 'api',
      status: 'ok',
      timestamp: '2026-07-24T10:00:00.000Z',
    });
  });
});
