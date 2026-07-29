# Clube Nsabores — planos, subscrições e billing

Última revisão: 2026-07-29

## Estado

A Sprint 8 está em implementação em `main`.

Já existe suporte para:

- planos configuráveis mensais, trimestrais e anuais;
- trial opcional;
- subscrições recorrentes separadas das encomendas;
- provider de billing `mock` determinístico e idempotente;
- cobranças recorrentes próprias do Clube;
- eventos auditáveis de lifecycle;
- cancelamento no fim do período e retoma;
- alteração de plano;
- renovação;
- `PAST_DUE` após falha de pagamento;
- webhook de billing idempotente;
- benefício percentual do Clube integrado no pricing;
- website e área de conta;
- management de planos e subscrições.

## Modelo

### ClubPlan

Define o produto comercial recorrente:

- nome e código;
- preço em cêntimos;
- moeda;
- periodicidade `MONTHLY`, `QUARTERLY` ou `YEARLY`;
- trial opcional;
- benefícios em snapshot estruturado;
- estado e visibilidade pública.

### ClubSubscription

Uma subscrição guarda sempre o snapshot comercial com que foi contratada:

- plano;
- preço;
- moeda;
- periodicidade;
- benefícios.

Alterar posteriormente o plano administrativo não modifica silenciosamente uma subscrição existente. Uma alteração explícita de plano atualiza o snapshot da subscrição.

A base de dados impede mais de uma subscrição simultaneamente ativa por utilizador para os estados operacionais do Clube.

### ClubSubscriptionCharge

As cobranças recorrentes são separadas de `Payment` de encomendas. Cada cobrança tem período, montante, estado, referência do provider e chave de idempotência.

A faturação fiscal/certificada não faz parte desta sprint.

### ClubSubscriptionEvent

Regista a evolução da subscrição e ações administrativas/provider. Eventos provenientes do provider usam `providerEventId` único para evitar processamento duplicado.

## Ciclo de vida

Estados suportados:

```text
TRIALING
ACTIVE
PAST_DUE
PAUSED
CANCEL_AT_PERIOD_END
CANCELLED
EXPIRED
```

Fluxo base sem trial:

```text
adesão
→ ACTIVE
→ cobrança inicial PAID
→ renovações
→ ACTIVE
```

Com trial:

```text
adesão
→ TRIALING
→ fim do trial / primeira renovação
→ cobrança
→ ACTIVE
```

Cancelamento normal:

```text
ACTIVE/TRIALING
→ CANCEL_AT_PERIOD_END
→ benefícios mantidos até currentPeriodEnd
→ CANCELLED no limite do período
```

A retoma antes do fim do período remove o cancelamento agendado.

## Alteração de plano

No provider `mock`, a alteração de plano é imediata e sem prorrata.

A operação:

- troca `planId`;
- atualiza preço/moeda/periodicidade do snapshot;
- atualiza os benefícios do snapshot;
- preserva o período corrente;
- grava `PLAN_CHANGED`.

A próxima renovação utiliza o novo snapshot.

Prorrata real fica dependente do provider de billing que vier a substituir o mock.

## Períodos recorrentes

O calendário é tratado por meses civis, não por número fixo de dias.

Exemplos:

- 31 janeiro mensal → último dia válido de fevereiro;
- 29 fevereiro anual → 28 fevereiro no ano não bissexto;
- trimestral → +3 meses civis.

Isto evita deriva de datas em subscrições iniciadas no fim do mês.

## Benefícios no pricing

O primeiro benefício comercial implementado é:

```json
{ "discountPercent": 10 }
```

O desconto é aplicado no servidor apenas quando a subscrição está em:

- `TRIALING`;
- `ACTIVE`;
- `CANCEL_AT_PERIOD_END` enquanto o período ainda não terminou.

Não é aplicado a `PAST_DUE`, `PAUSED`, `CANCELLED` ou `EXPIRED`.

O cálculo ocorre depois dos descontos promocionais de produto, portanto o benefício do Clube incide sobre o subtotal ainda elegível e nunca leva o total abaixo de zero.

O benefício é gravado em `OrderDiscount` com `source = CLUB` e snapshot da subscrição/plano, sem depender de uma `Promotion` artificial.

## Website

Rotas:

```text
/clube
/clube/planos
/clube/aderir/[code]
/conta/clube
```

A conta permite:

- consultar estado e plano;
- consultar período/trial;
- consultar cobranças;
- alterar plano;
- agendar cancelamento no fim do período;
- retomar quando permitido.

## Management

Rotas:

```text
/clube
/clube/planos
/clube/planos/[id]
/clube/subscricoes
/clube/subscricoes/[id]
```

Inclui:

- criação/edição de planos;
- benefício percentual configurável;
- métricas operacionais e MRR estimado;
- listagem/detalhe de subscrições;
- cobranças e histórico;
- renovação mock manual;
- cancelamento e retoma administrativa auditáveis.

## Webhook

Endpoint:

```text
POST /v1/webhooks/club
```

Eventos mock suportados:

- `renewal.succeeded`;
- `payment.failed`;
- `subscription.cancelled`.

O endpoint usa `x-club-signature` e `CLUB_BILLING_WEBHOOK_SECRET` para HMAC no contrato mock. Isto não representa ainda a implementação do protocolo Stripe; Stripe apenas está previsto na abstração do provider.

## Deployment e migrations

As migrations continuam deliberadamente fora de `start:prod`.

O CI valida o histórico numa instância PostgreSQL limpa. A aplicação de migrations a produção continua uma operação controlada:

```bash
pnpm --filter @nsabores/api prisma:migrate:deploy
```

O código do Clube tem compatibilidade pré-migration limitada: enquanto as tabelas do Clube ainda não existirem, planos públicos/listagens devolvem vazio, a conta devolve ausência de subscrição e o motor de pricing ignora benefícios do Clube. Outros erros de base de dados não são mascarados.

## Próximos passos

Antes de fechar a Sprint 8:

- alinhar os modelos do Clube no `schema.prisma`;
- testar lifecycle completo numa PostgreSQL limpa com a migration da Sprint 8;
- testar webhook/idempotência sobre dados reais de teste;
- completar filtros operacionais do management;
- avaliar benefícios adicionais como portes grátis/acesso antecipado sem duplicar o motor promocional;
- validar todos os quality gates.
