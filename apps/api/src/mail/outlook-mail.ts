import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export type TransactionalMailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

const logger = new Logger('TransactionalMail');

export function sendTransactionalMail(
  config: ConfigService,
  message: TransactionalMailMessage,
) {
  void deliverTransactionalMail(config, message).catch((error: unknown) => {
    logger.error(
      `Falha no envio de email para ${recipientDomain(message.to)}: ${
        error instanceof Error ? error.name : 'UnknownError'
      }`,
    );
  });
}

export async function deliverTransactionalMail(
  config: ConfigService,
  message: TransactionalMailMessage,
) {
  const provider = config.get<string>('MAIL_PROVIDER') ?? 'log';
  const from =
    config.get<string>('MAIL_FROM_ADDRESS')?.trim() || 'nsabores@outlook.pt';
  const replyTo =
    message.replyTo?.trim() ||
    config.get<string>('MAIL_REPLY_TO')?.trim() ||
    from;

  if (provider === 'smtp') {
    const host = config.get<string>('SMTP_HOST')?.trim();
    const user = config.get<string>('SMTP_USER')?.trim();
    const pass = config.get<string>('SMTP_PASSWORD');
    const port = Number(config.get('SMTP_PORT') ?? 465);
    const secureSetting = String(config.get('SMTP_SECURE') ?? 'true');
    const secure = secureSetting === 'true';
    const sender = config.get<string>('MAIL_FROM_ADDRESS')?.trim();
    if (
      !host ||
      !user ||
      !pass ||
      !sender ||
      ![465, 587].includes(port) ||
      !['true', 'false'].includes(secureSetting) ||
      secure !== (port === 465)
    ) {
      throw new Error('Configuração SMTP inválida ou incompleta.');
    }
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    const result = await transport.sendMail({
      from: {
        name: config.get<string>('MAIL_FROM_NAME')?.trim() || 'Nsabores',
        address: sender,
      },
      to: message.to,
      replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (!result.accepted.length || result.rejected.length) {
      throw new Error('SMTP não aceitou a mensagem.');
    }
    logger.log(
      JSON.stringify({
        event: 'transactional_email',
        provider: 'smtp',
        recipientDomain: recipientDomain(message.to),
        status: 'accepted',
      }),
    );
    return true;
  }

  if (provider === 'log') {
    logger.log(
      JSON.stringify({
        event: 'transactional_email',
        provider: 'log',
        from,
        recipientDomain: recipientDomain(message.to),
        subject: message.subject,
      }),
    );
    return false;
  }

  if (provider !== 'outlook-graph') {
    throw new Error('Fornecedor de email não suportado.');
  }

  const clientId = config.get<string>('OUTLOOK_CLIENT_ID')?.trim();
  const clientSecret = config.get<string>('OUTLOOK_CLIENT_SECRET')?.trim();
  const refreshToken = config.get<string>('OUTLOOK_REFRESH_TOKEN')?.trim();
  const tenant = config.get<string>('OUTLOOK_TENANT')?.trim() || 'consumers';

  if (!clientId || !refreshToken) {
    throw new Error('Credenciais Microsoft Graph em falta.');
  }

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'offline_access https://graph.microsoft.com/Mail.Send',
  });
  if (clientSecret) tokenBody.set('client_secret', clientSecret);

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    },
  );
  const token = (await tokenResponse.json()) as TokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(`OAuth HTTP ${tokenResponse.status}`);
  }

  const sendResponse = await fetch(
    'https://graph.microsoft.com/v1.0/me/sendMail',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: {
            contentType: message.html ? 'HTML' : 'Text',
            content: message.html ?? message.text,
          },
          toRecipients: [
            {
              emailAddress: {
                address: message.to,
              },
            },
          ],
          replyTo: [
            {
              emailAddress: {
                address: replyTo,
              },
            },
          ],
          internetMessageHeaders: [
            {
              name: 'X-Nsabores-From',
              value: from,
            },
          ],
        },
        saveToSentItems: true,
      }),
    },
  );

  if (!sendResponse.ok) {
    throw new Error(`Microsoft Graph HTTP ${sendResponse.status}`);
  }

  logger.log(
    JSON.stringify({
      event: 'transactional_email',
      provider: 'outlook-graph',
      from,
      recipientDomain: recipientDomain(message.to),
      subject: message.subject,
    }),
  );
  return true;
}

function recipientDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() || 'unknown';
}
