# Fidelização, pontos e vales-oferta

## Princípios

- Pontos e saldo monetário são ledgers separados.
- Todas as alterações de saldo são append-only e idempotentes.
- Saldos são alterados em transações PostgreSQL `Serializable`.
- O código integral do vale nunca é guardado em snapshots de encomenda ou apresentado no management após a emissão.
- Nesta sprint, 1 ponto equivale a 1 cêntimo no checkout.

## Pontos

Estados de saldo da conta:

- disponíveis;
- pendentes;
- reservados.

Fluxos:

- `EARN_PENDING` cria pontos pendentes;
- `EARN_RELEASED` transfere pendentes para disponíveis;
- `REDEEM_RESERVED` reserva pontos para uma encomenda;
- `REDEEMED` consome a reserva após pagamento;
- `REDEEM_RELEASED` devolve uma reserva após falha/cancelamento;
- `REVERSED` devolve pontos após reembolso;
- `ADJUSTMENT` regista ajustes administrativos.

## Vales-oferta

O vale guarda:

- hash SHA-256 do código normalizado;
- últimos quatro caracteres para identificação operacional;
- saldo disponível e reservado;
- validade e estado;
- destinatário e mensagem opcionais.

O código completo só é devolvido no momento da emissão.

Fluxo de encomenda:

1. reserva do saldo;
2. consumo após pagamento;
3. libertação em falha/cancelamento;
4. reposição em reembolso.

## Checkout

A ordem de aplicação é:

1. preços e tabela comercial;
2. promoções e cupões;
3. benefício do Clube;
4. pontos;
5. vale-oferta;
6. pagamento externo do remanescente.

A encomenda guarda snapshots em `OrderLoyaltyApplication` e `OrderGiftCardApplication`.
Encomendas totalmente liquidadas com pontos/vale passam diretamente a `PAID`.

## Operações

Website:

- `/conta/fidelizacao`;
- utilização de pontos e vale no checkout.

Management:

- `/fidelizacao`;
- `/fidelizacao/regras`;
- `/fidelizacao/clientes/[id]`;
- `/vales-oferta`;
- `/vales-oferta/[id]`.

## Deployment

As migrations continuam controladas e não são executadas no `start:prod`.
O histórico completo é validado numa base PostgreSQL limpa no CI.
