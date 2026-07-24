# Comércio: carrinho, checkout, encomendas e pagamentos

Última revisão: 2026-07-24 — Codex

## Fluxo

O browser recebe o cookie `nsabores_cart`, `HttpOnly`, `SameSite=Lax`, com
transporte seguro controlado por `AUTH_COOKIE_SECURE`. O carrinho de visitante
é associado a este UUID. Após autenticação, `POST /v1/cart/merge` combina as
linhas no carrinho da conta, limitando cada quantidade a 99.

Todas as mutações devolvem o carrinho completo. O website aplica a alteração de
forma otimista e restaura o snapshot anterior quando a API rejeita o pedido.
Preços, disponibilidade e totais são sempre relidos do catálogo no servidor.

O checkout valida dados portugueses, consentimentos obrigatórios, carrinho,
produtos, entrega e totais dentro da transação que cria a encomenda e os seus
snapshots. A chave de idempotência torna repetível a criação da encomenda. O
carrinho convertido deixa de ser reutilizado.

## Estados

- Encomenda: `PENDING_PAYMENT → PAID → PROCESSING → READY → SHIPPED → DELIVERED`.
- Cancelamento é permitido antes da expedição.
- Reembolso termina em `REFUNDED` e só é aplicado após resposta do provider.
- Pagamento tem estado independente: `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`,
  `CANCELLED`, `REFUNDED` ou `PARTIALLY_REFUNDED`.

Cada transição operacional gera `OrderStatusHistory`. Os snapshots de produto,
preço, cliente e moradas não são alterados pela gestão.

## Pagamentos e webhooks

`PAYMENT_PROVIDER=mock` cria uma sessão local. A confirmação mock percorre a
mesma operação idempotente usada pelo webhook. `POST /v1/payments/webhook`
valida HMAC-SHA256 em `x-payment-signature` com `PAYMENT_WEBHOOK_SECRET`; eventos
repetidos são registados apenas uma vez. O redirect nunca é a fonte de verdade.

O valor `stripe` está aceite pela configuração para futura instalação do
adaptador real. Até existirem credenciais e autorização, retorna uma resposta
explícita de não implementado e não contacta serviços externos.

Variáveis: `PAYMENT_PROVIDER`, `PAYMENT_SECRET_KEY`,
`PAYMENT_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL` e `PAYMENT_CANCEL_URL`.

## Entrega e gestão

O seed cria entrega standard em Portugal Continental (4,90 €, gratuita a partir
de 50 €) e recolha local. A API administrativa permite ativar, desativar e
alterar estes valores persistidos.

`/encomendas` na aplicação de gestão oferece pesquisa, filtros e CSV.
`/encomendas/[id]` apresenta snapshots, pagamento, histórico, notas, transições,
cancelamento e reembolso com confirmação.

## Emails

Os templates preparados cobrem receção, pagamento, preparação, envio,
cancelamento e reembolso. O provider atual apenas escreve eventos estruturados
de teste, ocultando o endereço local do destinatário. Nenhum email real é
enviado.

## Limitações

- Não existe stock quantitativo nem reserva de unidades; `stockStatus` continua
  a ser validado antes da encomenda e do pagamento.
- Não existem faturação certificada, transportadoras, cupões ou multi-moeda.
- O adaptador Stripe e emails reais dependem de credenciais e autorização.
- Termos e privacidade têm texto provisório para revisão jurídica.
