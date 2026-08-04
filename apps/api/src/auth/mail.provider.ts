import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sendTransactionalMail } from '../mail/outlook-mail';

@Injectable()
export class MailProvider {
  private readonly logger = new Logger(MailProvider.name);

  constructor(private readonly config: ConfigService) {}

  sendPasswordReset(email: string, token: string) {
    const link = `${this.config.get('WEBSITE_URL')}/conta/redefinir-password?token=${token}`;
    this.deliverLink(
      email,
      'Nsabores — redefinir palavra-passe',
      'Foi pedido um novo acesso à sua conta Nsabores.',
      link,
    );
  }

  sendEmailVerification(email: string, token: string) {
    const link = `${this.config.get('WEBSITE_URL')}/conta/verificar-email?token=${token}`;
    this.deliverLink(
      email,
      'Nsabores — confirmar endereço de email',
      'Confirme o endereço de email associado à sua conta Nsabores.',
      link,
    );
  }

  private deliverLink(
    email: string,
    subject: string,
    introduction: string,
    link: string,
  ) {
    if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.debug(`Link de desenvolvimento para ${email}: ${link}`);
      return;
    }

    sendTransactionalMail(this.config, {
      to: email,
      subject,
      text: `${introduction}\n\n${link}\n\nContacto: nsabores@outlook.pt`,
      html: `<p>${introduction}</p><p><a href="${link}">Continuar na Nsabores</a></p><p>Contacto: <a href="mailto:nsabores@outlook.pt">nsabores@outlook.pt</a></p>`,
    });
  }
}
