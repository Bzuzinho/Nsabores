# Comércio: carrinho, checkout, encomendas e pagamentos

Última revisão: 2026-08-05 — Codex

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

## Pagamentos manuais e providers

Em produção, `PAYMENT_FLOW_MODE=manual` regista a preferência do cliente e a
Gestão confirma o pagamento recebido com referência, nota e autor. O transporte
caso a caso pode ser orçamentado no detalhe antes da confirmação do valor.

`PAYMENT_PROVIDER=mock` continua disponível apenas para desenvolvimento e testes.
O webhook valida HMAC-SHA256, é idempotente e nunca confia no redirect. O valor
`stripe` está reservado na configuração, mas falha explicitamente até existir
um adaptador autorizado e credenciais do operador.

Variáveis: `PAYMENT_PROVIDER`, `PAYMENT_SECRET_KEY`,
`PAYMENT_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL` e `PAYMENT_CANCEL_URL`.

## Entrega e gestão

A Gestão permite ativar/desativar métodos de entrega e alterar preço e limiar de
portes gratuitos. O modo caso a caso e a recolha local permanecem disponíveis.

`/encomendas` na aplicação de gestão oferece pesquisa, filtros e CSV.
`/encomendas/[id]` apresenta snapshots, pagamento, histórico, notas, transições,
cancelamento, reembolso e criação de expedições parciais/totais.

## Emails

Os templates cobrem receção, pagamento, preparação, envio, cancelamento e
reembolso. O provider de log é usado em desenvolvimento; Microsoft Graph envia
email real quando o OAuth delegado está configurado no ambiente.

## Limitações

- Não existem faturação certificada, transportadora automática ou multi-moeda.
- O adaptador de pagamento digital e o provider de transporte dependem de
  contrato, credenciais e autorização.
- Termos e privacidade têm texto provisório para revisão jurídica.
