# Clube Nsabores — planos, subscrições e pagamentos

Última revisão: 2026-07-31

## Estado

O Clube suporta dois modos financeiros, controlados por `PAYMENT_FLOW_MODE`:

```text
manual | automatic
```

O modo manual é o fluxo operacional por defeito. O modo automático mantém a abstração de provider e webhooks para ativação futura.

## Modelo

### ClubPlan

Define o produto recorrente:

- nome e código;
- preço em cêntimos;
- moeda;
- periodicidade `MONTHLY`, `QUARTERLY` ou `YEARLY`;
- trial opcional;
- benefícios estruturados;
- estado e visibilidade pública.

### ClubSubscription

Guarda o snapshot comercial contratado:

- plano;
- preço;
- moeda;
- periodicidade;
- benefícios;
- período corrente;
- estado operacional.

Estados suportados:

```text
PENDING_ACTIVATION
TRIALING
ACTIVE
PAST_DUE
PAUSED
CANCEL_AT_PERIOD_END
CANCELLED
EXPIRED
```

`PENDING_ACTIVATION` significa que a adesão existe, mas os benefícios financeiros ainda não foram ativados porque o pagamento não foi confirmado.

### ClubSubscriptionCharge

Cada cobrança tem:

- subscrição e período;
- montante e moeda;
- estado `PENDING`, `PAID`, `FAILED`, `CANCELLED` ou `REFUNDED`;
- provider/referência;
- chave de idempotência;
- timestamps e metadata de auditoria.

As cobranças do Clube são independentes dos pagamentos de encomendas.

### ClubSubscriptionEvent

Regista alterações de estado e ações administrativas. A confirmação manual guarda o autor, a cobrança, a referência e a nota associada.

## Fluxo manual

### Adesão sem trial

```text
pedido de adesão
→ PENDING_ACTIVATION
→ cobrança PENDING
→ confirmação por STAFF/ADMIN
→ cobrança PAID
→ subscrição ACTIVE
```

Não há ativação de benefícios antes da confirmação.

### Renovação

```text
pedido de renovação
→ nova cobrança PENDING
→ confirmação por STAFF/ADMIN
→ cobrança PAID
→ período da subscrição atualizado
→ subscrição ACTIVE
```

Criar novamente a mesma renovação não duplica a cobrança, porque a chave de idempotência é baseada na subscrição e no início do período.

Confirmar duas vezes a mesma cobrança também é idempotente: uma cobrança já `PAID` não gera nova ativação nem novo período.

### Trial

Planos com trial continuam a iniciar em `TRIALING`, sem cobrança inicial. A primeira cobrança é criada quando a renovação é solicitada.

## Fluxo automático

Quando `PAYMENT_FLOW_MODE=automatic`, a adesão e renovação continuam a usar `ClubBillingProvider` e os webhooks existentes.

A abstração atual inclui provider mock e preparação para Stripe. Nenhum segredo de provider é guardado no repositório.

## Benefícios no pricing

Os benefícios são aplicados apenas quando a subscrição está em:

- `TRIALING`;
- `ACTIVE`;
- `CANCEL_AT_PERIOD_END`, enquanto o período ainda não terminou.

Não são aplicados em `PENDING_ACTIVATION`, `PAST_DUE`, `PAUSED`, `CANCELLED` ou `EXPIRED`.

O benefício percentual mantém o formato:

```json
{ "discountPercent": 10 }
```

O cálculo é feito no servidor e gravado no snapshot da encomenda.

## Website

Rotas principais:

```text
/clube
/clube/planos
/clube/aderir/[code]
/conta/clube
```

No modo manual, a conta apresenta a adesão pendente e as cobranças sem expor notas internas ou dados de auditoria administrativa.

## Management

Rotas:

```text
/clube/planos
/clube/planos/[id]
/clube/subscricoes
/clube/subscricoes/[id]
/clube/cobrancas
```

`/clube/cobrancas` apresenta todas as cobranças `PENDING` e permite:

- consultar cliente, plano, período e valor;
- confirmar o pagamento;
- guardar referência/comprovativo opcional;
- guardar nota interna;
- abrir o detalhe da subscrição.

Todas as ações financeiras exigem `STAFF` ou `ADMIN`.

## API administrativa

```text
GET  /v1/admin/club/pending-charges
POST /v1/admin/club/subscriptions/:id/renew
POST /v1/admin/club/subscriptions/:id/charges/:chargeId/confirm
```

A confirmação é transacional: atualiza cobrança, período, estado da subscrição e histórico na mesma transação.

## Segurança e auditoria

- valores sempre em cêntimos;
- sem dados bancários ou de cartão;
- confirmação apenas por `STAFF`/`ADMIN`;
- autor e timestamps persistidos;
- referências opcionais, sem segredos;
- criação e confirmação idempotentes;
- modo manual e automático separados por configuração.

## Deployment e migrations

As migrations não são executadas automaticamente no arranque.

A migration do fluxo manual é:

```text
20260731143000_manual_club_payments
```

Aplicação controlada:

```bash
pnpm --filter @nsabores/api prisma:migrate:deploy
pnpm --filter @nsabores/api exec prisma migrate status
```

Depois do deployment, a base deve apresentar 18 migrations e `Database schema is up to date!`.
