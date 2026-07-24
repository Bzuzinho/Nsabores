import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('GET /health', () => {
  it('returns the API health payload', () => {
    const response = new HealthController().health();

    expect(response).toMatchObject({ service: 'api', status: 'ok' });
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
  });
});
