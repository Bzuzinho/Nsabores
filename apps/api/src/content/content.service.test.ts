import type { ConfigService } from '@nestjs/config';
import { BlogPostStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverTransactionalMail } from '../mail/outlook-mail';
import type { PrismaService } from '../prisma.service';
import { ContentService } from './content.service';

vi.mock('../mail/outlook-mail', () => ({
  deliverTransactionalMail: vi.fn(),
}));

describe('ContentService', () => {
  const prisma = {
    blogPost: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const values: Record<string, string> = {
    CONTACT_RECIPIENT_EMAIL: 'equipa@nsabores.pt',
  };
  const config = {
    get: vi.fn((key: string) => values[key]),
  };
  const service = new ContentService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends contact requests to the configured recipient with a safe reply-to', async () => {
    await expect(
      service.contact({
        name: 'Maria <Cliente>',
        email: 'maria@example.com',
        phone: '+351 912 345 678',
        topic: 'BUSINESS',
        message: 'Quero saber mais.\nObrigada.',
        privacyAccepted: true,
      }),
    ).resolves.toEqual({ accepted: true });

    const mailCall = vi.mocked(deliverTransactionalMail).mock.calls[0];
    expect(mailCall?.[0]).toBe(config);
    expect(mailCall?.[1].to).toBe('equipa@nsabores.pt');
    expect(mailCall?.[1].replyTo).toBe('maria@example.com');
    expect(mailCall?.[1].subject).toBe(
      'Nsabores — pedido de contacto: Empresas e B2B',
    );
    expect(mailCall?.[1].html).toContain('Maria &lt;Cliente&gt;');
  });

  it('silently accepts honeypot submissions without sending mail', async () => {
    await expect(
      service.contact({
        name: 'Robô',
        email: 'robot@example.com',
        topic: 'OTHER',
        message: 'Spam',
        privacyAccepted: true,
        website: 'https://spam.invalid',
      }),
    ).resolves.toEqual({ accepted: true });

    expect(deliverTransactionalMail).not.toHaveBeenCalled();
  });

  it('publishes an article immediately when no publication date is supplied', async () => {
    prisma.blogPost.create.mockResolvedValue({ id: 'post-1' });

    await service.create(
      {
        title: 'Sabores de verão',
        slug: 'sabores-de-verao',
        excerpt: 'Uma seleção de verão.',
        content: 'Conteúdo do artigo.',
        coverImageUrl: '/images/summer.jpg',
        imageAlt: 'Mesa de verão',
        status: BlogPostStatus.PUBLISHED,
      },
      'user-1',
    );

    const createCall = prisma.blogPost.create.mock.calls[0]?.[0] as
      | {
          data: {
            authorId: string;
            status: BlogPostStatus;
            publishedAt: Date;
          };
        }
      | undefined;
    expect(createCall?.data.authorId).toBe('user-1');
    expect(createCall?.data.status).toBe(BlogPostStatus.PUBLISHED);
    expect(createCall?.data.publishedAt).toBeInstanceOf(Date);
  });
});
