import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { deliverTransactionalMail } from '../mail/outlook-mail';

@Injectable()
export class MailProvider {
  private readonly logger = new Logger(MailProvider.name);

  constructor(private readonly config: ConfigService) {}

  sendPasswordReset(email: string, token: string) {
    const link = `${this.config.get('WEBSITE_URL')}/conta/redefinir-password?token=${token}`;
    return this.deliverLink(
      email,
      'Nsabores — redefinir palavra-passe',
      'Foi pedido um novo acesso à sua conta Nsabores.',
      link,
    );
  }

  sendEmailVerification(email: string, token: string) {
    const link = `${this.config.get('WEBSITE_URL')}/conta/verificar-email?token=${token}`;
    return this.deliverLink(
      email,
      'Nsabores — confirmar endereço de email',
      'Confirme o endereço de email associado à sua conta Nsabores.',
      link,
    );
  }

  private async deliverLink(
    email: string,
    subject: string,
    introduction: string,
    link: string,
  ) {
    if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.debug('Email de autenticação simulado em desenvolvimento.');
      return true;
    }

    const contact =
      this.config.get<string>('MAIL_REPLY_TO')?.trim() ||
      this.config.get<string>('MAIL_FROM_ADDRESS')?.trim() ||
      'geral@nsabores.pt';
    try {
      return await deliverTransactionalMail(this.config, {
        to: email,
        subject,
        text: `${introduction}\n\n${link}\n\nContacto: ${contact}`,
        html: `<p>${introduction}</p><p><a href="${link}">Continuar na Nsabores</a></p><p>Contacto: <a href="mailto:${contact}">${contact}</a></p>`,
      });
    } catch {
      this.logger.error('Falha no envio de email de autenticação.');
      return false;
    }
  }
}
