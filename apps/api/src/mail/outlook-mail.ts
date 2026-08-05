import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

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

const logger = new Logger('OutlookMail');

export function sendTransactionalMail(
  config: ConfigService,
  message: TransactionalMailMessage,
) {
  void deliverTransactionalMail(config, message).catch((error: unknown) => {
    logger.error(
      `Falha no envio de email para ${recipientDomain(message.to)}: ${
        error instanceof Error ? error.message : String(error)
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
    'nsabores@outlook.pt';

  if (provider !== 'outlook-graph') {
    logger.log(
      JSON.stringify({
        event: 'transactional_email',
        provider: 'log',
        from,
        recipientDomain: recipientDomain(message.to),
        subject: message.subject,
      }),
    );
    return;
  }

  const clientId = config.get<string>('OUTLOOK_CLIENT_ID')?.trim();
  const clientSecret = config.get<string>('OUTLOOK_CLIENT_SECRET')?.trim();
  const refreshToken = config.get<string>('OUTLOOK_REFRESH_TOKEN')?.trim();
  const tenant = config.get<string>('OUTLOOK_TENANT')?.trim() || 'consumers';

  if (!clientId || !refreshToken) {
    logger.warn(
      'MAIL_PROVIDER=outlook-graph sem OUTLOOK_CLIENT_ID e OUTLOOK_REFRESH_TOKEN; email mantido em modo log.',
    );
    logger.log(
      JSON.stringify({
        event: 'transactional_email',
        provider: 'log-fallback',
        from,
        recipientDomain: recipientDomain(message.to),
        subject: message.subject,
      }),
    );
    return;
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
    throw new Error(
      token.error_description ||
        token.error ||
        `OAuth HTTP ${tokenResponse.status}`,
    );
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
    const detail = await sendResponse.text();
    throw new Error(
      `Microsoft Graph HTTP ${sendResponse.status}: ${detail.slice(0, 300)}`,
    );
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
}

function recipientDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() || 'unknown';
}
