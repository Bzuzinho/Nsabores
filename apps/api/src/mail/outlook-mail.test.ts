import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { deliverTransactionalMail } from './outlook-mail';

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail })),
  };
});

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

const message = {
  to: 'cliente@example.com',
  subject: 'Teste',
  text: 'Mensagem de teste',
};

function config(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    MAIL_PROVIDER: 'smtp',
    MAIL_FROM_ADDRESS: 'geral@nsabores.pt',
    SMTP_HOST: 'cpanel172.dnscpanel.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'geral@nsabores.pt',
    SMTP_PASSWORD: 'test-only',
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('Transactional SMTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue({
      accepted: [message.to],
      rejected: [],
    });
  });

  it('accepts email using authenticated TLS', async () => {
    expect(await deliverTransactionalMail(config(), message)).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 465,
        secure: true,
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
        },
      }),
    );
  });

  it('rejects missing credentials', async () => {
    await expect(
      deliverTransactionalMail(config({ SMTP_PASSWORD: '' }), message),
    ).rejects.toThrow();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects insecure configuration', async () => {
    await expect(
      deliverTransactionalMail(config({ SMTP_SECURE: 'false' }), message),
    ).rejects.toThrow();
  });

  it('rejects refused recipients', async () => {
    sendMail.mockResolvedValue({
      accepted: [],
      rejected: [message.to],
    });
    await expect(deliverTransactionalMail(config(), message)).rejects.toThrow();
  });

  it('propagates SMTP connection failures', async () => {
    sendMail.mockRejectedValue(new Error('Connection failed'));
    await expect(deliverTransactionalMail(config(), message)).rejects.toThrow();
  });

  it('does not claim delivery in log mode', async () => {
    expect(
      await deliverTransactionalMail(config({ MAIL_PROVIDER: 'log' }), message),
    ).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
