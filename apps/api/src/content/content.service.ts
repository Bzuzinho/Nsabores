import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlogPostStatus, Prisma } from '@prisma/client';
import { deliverTransactionalMail } from '../mail/outlook-mail';
import { PrismaService } from '../prisma.service';
import type {
  BlogQueryDto,
  ContactRequestDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from './dto';

const topicNames: Record<string, string> = {
  PRODUCTS: 'Produtos e cabazes',
  EVENTS: 'Eventos e catering',
  BUSINESS: 'Empresas e B2B',
  CLUB: 'Clube Nsabores',
  OTHER: 'Outro assunto',
};

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  listPublic(query: BlogQueryDto) {
    return this.list(query, false);
  }

  listAdmin(query: BlogQueryDto) {
    return this.list(query, true);
  }

  private async list(query: BlogQueryDto, isAdmin: boolean) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const search = query.search?.trim();
    const where: Prisma.BlogPostWhereInput = {
      ...(isAdmin
        ? query.status
          ? { status: query.status }
          : {}
        : {
            status: BlogPostStatus.PUBLISHED,
            publishedAt: { lte: new Date() },
          }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { excerpt: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async publicPost(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: {
        slug,
        status: BlogPostStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!post) throw new NotFoundException('Artigo não encontrado.');
    return post;
  }

  async adminPost(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!post) throw new NotFoundException('Artigo não encontrado.');
    return post;
  }

  create(body: CreateBlogPostDto, authorId: string) {
    return this.unique(() =>
      this.prisma.blogPost.create({
        data: {
          ...body,
          authorId,
          status: body.status ?? BlogPostStatus.DRAFT,
          publishedAt: this.publishedAt(body.status, body.publishedAt),
        },
      }),
    );
  }

  async update(id: string, body: UpdateBlogPostDto) {
    const current = await this.adminPost(id);
    return this.unique(() =>
      this.prisma.blogPost.update({
        where: { id },
        data: {
          ...body,
          publishedAt:
            body.status === undefined && body.publishedAt === undefined
              ? undefined
              : this.publishedAt(
                  body.status ?? current.status,
                  body.publishedAt ?? current.publishedAt?.toISOString(),
                ),
        },
      }),
    );
  }

  async delete(id: string) {
    await this.adminPost(id);
    await this.prisma.blogPost.delete({ where: { id } });
    return { success: true };
  }

  async contact(body: ContactRequestDto) {
    if (body.website) return { accepted: true };
    const recipient =
      this.config.get<string>('CONTACT_RECIPIENT_EMAIL')?.trim() ||
      this.config.get<string>('MAIL_FROM_ADDRESS')?.trim() ||
      'nsabores@outlook.pt';
    const topic = topicNames[body.topic] ?? 'Outro assunto';
    const text = [
      `Novo pedido de contacto — ${topic}`,
      '',
      `Nome: ${body.name}`,
      `Email: ${body.email}`,
      `Telefone: ${body.phone || 'Não indicado'}`,
      '',
      body.message,
    ].join('\n');
    await deliverTransactionalMail(this.config, {
      to: recipient,
      replyTo: body.email,
      subject: `Nsabores — pedido de contacto: ${topic}`,
      text,
      html: `<h2>Novo pedido de contacto</h2><p><strong>Assunto:</strong> ${escapeHtml(topic)}</p><p><strong>Nome:</strong> ${escapeHtml(body.name)}<br><strong>Email:</strong> ${escapeHtml(body.email)}<br><strong>Telefone:</strong> ${escapeHtml(body.phone || 'Não indicado')}</p><p>${escapeHtml(body.message).replaceAll('\n', '<br>')}</p>`,
    });
    return { accepted: true };
  }

  private publishedAt(status?: BlogPostStatus, value?: string) {
    if (status !== BlogPostStatus.PUBLISHED) return null;
    return value ? new Date(value) : new Date();
  }

  private async unique<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe um artigo com este slug.');
      }
      throw error;
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
