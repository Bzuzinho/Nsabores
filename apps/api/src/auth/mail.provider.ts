import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailProvider {
  private readonly logger = new Logger(MailProvider.name);

  constructor(private readonly config: ConfigService) {}

  sendPasswordReset(email: string, token: string) {
    this.developmentLink(
      email,
      `${this.config.get('WEBSITE_URL')}/conta/redefinir-password?token=${token}`,
    );
  }

  sendEmailVerification(email: string, token: string) {
    this.developmentLink(
      email,
      `${this.config.get('WEBSITE_URL')}/conta/verificar-email?token=${token}`,
    );
  }

  private developmentLink(email: string, link: string) {
    if (this.config.get('NODE_ENV') === 'production') {
      this.logger.log('Email transacional entregue ao provider configurado.');
      return;
    }
    this.logger.debug(`Link de desenvolvimento para ${email}: ${link}`);
  }
}
