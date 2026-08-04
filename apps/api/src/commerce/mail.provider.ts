import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sendTransactionalMail } from '../mail/outlook-mail';

export type CommerceMailTemplate =
  | 'ORDER_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED';

const templates: Record<
  CommerceMailTemplate,
  (orderNumber: string) => { subject: string; text: string }
> = {
  ORDER_RECEIVED: (orderNumber) => ({
    subject: `Nsabores — encomenda ${orderNumber} recebida`,
    text: `Recebemos a encomenda ${orderNumber}. A equipa Nsabores irá contactar para confirmar pagamento, entrega e eventual custo de transporte.`,
  }),
  PAYMENT_CONFIRMED: (orderNumber) => ({
    subject: `Nsabores — pagamento da encomenda ${orderNumber} confirmado`,
    text: `O pagamento da encomenda ${orderNumber} foi registado pela equipa Nsabores.`,
  }),
  ORDER_PROCESSING: (orderNumber) => ({
    subject: `Nsabores — encomenda ${orderNumber} em preparação`,
    text: `A encomenda ${orderNumber} encontra-se em preparação ou produção.`,
  }),
  ORDER_SHIPPED: (orderNumber) => ({
    subject: `Nsabores — encomenda ${orderNumber} expedida`,
    text: `A encomenda ${orderNumber} foi expedida. Os detalhes de transporte são comunicados caso a caso.`,
  }),
  ORDER_CANCELLED: (orderNumber) => ({
    subject: `Nsabores — encomenda ${orderNumber} cancelada`,
    text: `A encomenda ${orderNumber} foi cancelada. Para qualquer esclarecimento, responda a este email.`,
  }),
  ORDER_REFUNDED: (orderNumber) => ({
    subject: `Nsabores — regularização da encomenda ${orderNumber}`, 
    text: `Foi registada uma regularização ou devolução relativa à encomenda ${orderNumber}.`,
  }),
};

@Injectable()
export class CommerceMailProvider {
  constructor(private readonly config: ConfigService) {}

  send(
    template: CommerceMailTemplate,
    recipient: string,
    orderNumber: string,
  ) {
    const content = templates[template](orderNumber);
    sendTransactionalMail(this.config, {
      to: recipient,
      subject: content.subject,
      text: `${content.text}\n\nContacto: nsabores@outlook.pt`,
    });
  }
}
