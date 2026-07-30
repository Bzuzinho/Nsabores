# Operação de produção

## Separação de responsabilidades

A produção é independente do estado financeiro da encomenda.

```text
Encomenda aceite
→ ficha de produção criada
→ prioridade/data/responsável definidos
→ preparação
→ pronta
→ pagamento acompanhado em paralelo
```

## Ficha de produção

Cada encomenda em `PROCESSING` ou `READY` pode ter uma única `ProductionWorkOrder` com:

- estado operacional;
- prioridade;
- data pretendida;
- responsável interno;
- notas de produção;
- datas de início, pronta e conclusão.

Estados:

- `QUEUED`;
- `IN_PROGRESS`;
- `READY`;
- `COMPLETED`;
- `CANCELLED`.

Prioridades:

- `LOW`;
- `NORMAL`;
- `HIGH`;
- `URGENT`.

## Management

- `/operacoes/producao`: fila ordenada por prioridade e data pretendida;
- `/operacoes/producao/[orderId]`: detalhe, itens, personalização, morada, notas, pagamento e ações operacionais.

A ação `Preparação concluída` marca a ficha como concluída e a encomenda como `READY`, sem alterar o estado do pagamento.

## Pagamentos

O pagamento continua a ser acompanhado em `/recebimentos`. Uma encomenda pode estar pronta e ainda ter pagamento pendente, conforme o modelo operacional manual definido para esta fase.

## Deployment

A migration `20260730140500_production_work_orders` é aplicada apenas pelo procedimento controlado de migrations. Não é executada no `start:prod`.
