# Pagamentos manuais

## Regra operacional atual

A plataforma não cobra pagamentos digitais. A configuração obrigatória nesta fase é:

```text
PAYMENT_FLOW_MODE=manual
```

O checkout recolhe uma preferência do cliente, que será sempre validada pela equipa:

- `OPERATOR_CONTACT`: contacto antes da produção ou envio para combinar o pagamento;
- `PAY_ON_DELIVERY`: pagamento contra entrega;
- `PAY_ON_PICKUP`: pagamento no momento da recolha;
- `CARRIER_COD`: envio à cobrança.

A preferência não confirma automaticamente condições comerciais. O operador pode ajustar a solução depois de contactar o cliente.

Quando o cliente confirma uma encomenda:

1. a encomenda é criada;
2. o stock é reservado;
3. pontos e vale-oferta utilizados são consolidados;
4. a encomenda passa para `PROCESSING`;
5. o pagamento permanece `PENDING` quando existe valor externo a receber;
6. a preferência de cobrança fica guardada em `paymentTermsSnapshot`;
7. a empresa confirma diretamente com o cliente pagamento, produção e entrega;
8. o Management marca manualmente o pagamento como recebido;
9. o pagamento passa para `PAID` sem alterar automaticamente o estado de produção;
10. os pontos ganhos pela compra são calculados apenas após essa confirmação.

Produção, pagamento e transporte são estados independentes.

## Transporte tratado caso a caso

Os métodos públicos ativos são:

- `case-by-case`: transporte e respetivo custo a confirmar pelo operador;
- `local-pickup`: recolha local sem custo automático.

O antigo preço standard fica desativado. Quando a encomenda usa `case-by-case`:

- o checkout apresenta um total provisório sem transporte;
- `shippingQuoteStatus` fica em `PENDING` dentro de `paymentTermsSnapshot`;
- o operador introduz o custo real no detalhe da encomenda;
- o total da encomenda e o valor esperado no módulo de recebimentos são atualizados;
- o custo não pode ser alterado depois de o pagamento estar confirmado.

## Management

No detalhe da encomenda existem as ações:

```text
Confirmar custo de transporte
Marcar pagamento como recebido
```

A confirmação do pagamento permite guardar:

- método de pagamento;
- referência ou comprovativo;
- nota interna;
- utilizador que confirmou a operação.

As operações são idempotentes sempre que aplicável.

## Pontos e vales usados na compra

Como a encomenda segue para produção, os pontos e o saldo de vale utilizados são consumidos no momento em que a encomenda é aceite.

Se a encomenda for cancelada antes do pagamento, esses benefícios são devolvidos através do ledger.

Os pontos ganhos pela encomenda só são criados quando o pagamento externo é confirmado manualmente.

## Compra de vales-oferta

Um pedido de compra de vale fica em `PENDING_PAYMENT`.

O vale apenas é emitido depois de a empresa marcar manualmente o pedido como pago em:

```text
/vales-oferta/pedidos
```

O código integral é apresentado uma única vez nessa operação.

## Pagamentos digitais

Os adapters automáticos permanecem no código apenas para evolução futura e testes isolados. Não são apresentados no checkout nem iniciados quando `PAYMENT_FLOW_MODE=manual`.

Qualquer ativação futura exige uma decisão de negócio explícita, configuração segura e novos testes de aceitação.

## Deployment

Em produção devem ser mantidas:

```text
PAYMENT_FLOW_MODE=manual
MAIL_FROM_ADDRESS=nsabores@outlook.pt
MAIL_REPLY_TO=nsabores@outlook.pt
```

As migrations e os seeds continuam controlados e não são executados automaticamente no `start:prod`.
