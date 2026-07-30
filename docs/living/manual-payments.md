# Pagamentos manuais

## Regra operacional atual

O pagamento não é cobrado automaticamente pela plataforma.

A configuração por defeito é:

```text
PAYMENT_FLOW_MODE=manual
```

Quando o cliente confirma uma encomenda:

1. a encomenda é criada;
2. o stock é reservado;
3. pontos e vale-oferta utilizados são consolidados;
4. a encomenda passa imediatamente para `PROCESSING`;
5. o pagamento permanece `PENDING` quando existe valor externo a receber;
6. a empresa combina o método de pagamento diretamente com o cliente;
7. o management marca manualmente o pagamento como recebido;
8. o pagamento passa para `PAID` sem alterar o estado de produção;
9. os pontos ganhos pela compra são calculados apenas após essa confirmação.

Produção e pagamento são, portanto, estados independentes.

## Management

No detalhe da encomenda existe a ação:

```text
Marcar pagamento como recebido
```

A ação permite guardar:

- método de pagamento;
- referência ou comprovativo;
- nota interna;
- utilizador que confirmou a operação.

A confirmação é idempotente.

## Pontos e vales usados na compra

Como a encomenda segue imediatamente para produção, os pontos e o saldo de vale utilizados são consumidos no momento em que a encomenda é aceite.

Se a encomenda for cancelada antes do pagamento, esses benefícios são devolvidos através do ledger.

Os pontos ganhos pela encomenda só são criados quando o pagamento externo é confirmado manualmente.

## Compra de vales-oferta

Um pedido de compra de vale fica em `PENDING_PAYMENT`.

O vale apenas é emitido depois de a empresa marcar manualmente o pedido como pago em:

```text
/vales-oferta/pedidos
```

O código integral é apresentado uma única vez nessa operação.

## Automatização futura

A implementação automática continua preparada. Quando existir provider e processo operacional aprovado, pode ser ativada por configuração:

```text
PAYMENT_FLOW_MODE=automatic
```

Nesse modo, permanecem disponíveis:

- criação de sessão de pagamento;
- provider mock/adapter futuro;
- webhooks idempotentes;
- confirmação automática;
- reembolsos através do provider.

A ativação futura não exige substituir o modelo de encomendas, apenas alterar a configuração e validar o provider real.

## Deployment

Não é necessário definir `PAYMENT_FLOW_MODE` para obter o comportamento atual: `manual` é o valor por defeito.

As migrations continuam controladas e não são executadas automaticamente no `start:prod`.
