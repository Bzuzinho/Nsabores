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

- `EARN_PENDING` cria pontos pendentes após pagamento;
- `EARN_RELEASED` transfere pendentes para disponíveis quando termina o prazo da regra;
- `REDEEM_RESERVED` reserva pontos para uma encomenda;
- `REDEEMED` consome a reserva após pagamento;
- `REDEEM_RELEASED` devolve uma reserva após falha/cancelamento;
- `REVERSED` anula pontos ganhos após reembolso;
- `ADJUSTMENT` regista ajustes administrativos.

A libertação de pontos vencidos é executada de forma idempotente quando o cliente consulta a conta ou antes de reservar pontos no checkout.

## Acumulação automática

Depois de uma encomenda ficar `PAID`, a API seleciona a primeira regra ativa compatível com o canal e período.

O valor elegível:

- exclui a parte paga com pontos;
- inclui a parte paga com vale-oferta, porque o vale representa dinheiro;
- respeita o mínimo da regra;
- aplica o multiplicador de membro do Clube quando existe subscrição válida;
- respeita o máximo de pontos por encomenda.

Os pontos entram primeiro em saldo pendente durante `pendingDays`.

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

## Compra pública de vales

Rotas públicas:

- `/vales-oferta`;
- `/vales-oferta/comprar`;
- `/vales-oferta/sucesso`;
- `/vales-oferta/consultar`.

A compra cria `GiftCardPurchase` em `PENDING_PAYMENT`. O vale só é emitido após confirmação do pagamento. No provider mock, a confirmação é idempotente e o código integral é apresentado uma única vez.

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

Em reembolso:

- pontos utilizados regressam ao saldo disponível;
- saldo consumido regressa ao vale;
- pontos ganhos pela própria encomenda são revertidos.

## Operações

Website:

- `/conta/fidelizacao`;
- utilização de pontos e vale no checkout;
- compra e consulta pública de vales.

Management:

- `/fidelizacao`;
- `/fidelizacao/regras`;
- `/fidelizacao/clientes/[id]`;
- `/vales-oferta`;
- `/vales-oferta/[id]`.

## Testes

O CI executa:

- smoke do ledger de pontos e vales;
- smoke integral do checkout através do `CommerceService` resolvido pelo Nest;
- reserva de stock;
- aplicação de 1.000 pontos e vale de 20 €;
- pagamento mock;
- consumo dos benefícios;
- acumulação pendente após pagamento.

## Deployment

As migrations continuam controladas e não são executadas no `start:prod`.
O histórico completo é validado numa base PostgreSQL limpa no CI.
