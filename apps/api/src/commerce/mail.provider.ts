import { Injectable } from '@nestjs/common';

export type CommerceMailTemplate =
  | 'ORDER_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED';

@Injectable()
export class CommerceMailProvider {
  send(template: CommerceMailTemplate, recipient: string, orderNumber: string) {
    // Development/test provider: no external email is sent and no sensitive link is logged.
    console.info(
      JSON.stringify({
        event: 'transactional_email',
        provider: 'log',
        template,
        recipientDomain: recipient.split('@')[1] ?? 'unknown',
        orderNumber,
      }),
    );
  }
}
