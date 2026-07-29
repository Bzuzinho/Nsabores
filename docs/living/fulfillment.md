# Fulfillment, expedições, devoluções e pós-venda

Última revisão: 2026-07-29

## Âmbito atual

A operação pós-venda cobre preparação, expedições totais e parciais, tracking, entrega, devoluções/RMA, inspeção, reposição de stock, reembolsos e substituições. Os fluxos reutilizam o stock quantitativo e as reservas implementadas na Sprint 5 e funcionam sobre encomendas B2C e B2B.

## Preparação e expedição

Fluxo operacional:

```text
PAID / aprovado
→ PROCESSING
→ criação de Shipment
→ etiqueta
→ dispatch
→ IN_TRANSIT
→ DELIVERED
```

Uma encomenda pode ter várias expedições e cada `ShipmentItem` guarda a quantidade de cada `OrderItem` incluída. O backend impede expedir mais unidades do que as compradas.

Ao confirmar a expedição:

- é validada a reserva ativa de stock;
- `onHandQuantity` e `reservedQuantity` são reduzidos atomicamente;
- a reserva é consumida total ou parcialmente;
- é criado `StockMovement` do tipo `ORDER_FULFILLMENT`;
- quando todos os artigos estiverem expedidos, a encomenda passa para `SHIPPED`.

Quando todas as expedições aplicáveis forem entregues, a encomenda passa para `DELIVERED`.

## Provider de transporte

`SHIPPING_PROVIDER=mock` é o provider operacional atual. A abstração suporta criação de etiqueta, tracking e validação de webhook. Não é contactado nenhum operador real sem configuração e implementação explícitas.

Variáveis preparadas:

```text
SHIPPING_PROVIDER
SHIPPING_API_KEY
SHIPPING_API_SECRET
SHIPPING_WEBHOOK_SECRET
SHIPPING_SENDER_NAME
SHIPPING_SENDER_ADDRESS
```

Eventos de tracking são idempotentes por `shipmentId + providerEventId`.

## Tracking

Existem dois fluxos:

- autenticado: `/conta/encomendas/[id]/tracking` → `GET /v1/account/orders/:orderId/tracking`;
- convidado: `/acompanhar` → `POST /v1/tracking` com número da encomenda e email.

O acesso autenticado valida o proprietário da encomenda. O tracking convidado não devolve uma encomenda quando número e email não coincidirem.

## Devoluções / RMA

O cliente pode iniciar uma devolução em:

```text
/conta/encomendas/[id]/devolver
```

A API valida:

- a encomenda pertence ao utilizador;
- a encomenda está `SHIPPED` ou `DELIVERED`;
- existem artigos selecionados;
- a quantidade pedida não excede a quantidade comprada menos devoluções ainda válidas.

Estados do RMA:

```text
REQUESTED
UNDER_REVIEW
APPROVED / REJECTED
IN_TRANSIT
RECEIVED
INSPECTED
REFUND_PENDING
REFUNDED
CLOSED / CANCELLED
```

A decisão administrativa pode definir por artigo:

- condição recebida;
- `RESTOCK`;
- `UNSELLABLE`;
- `RETURN_TO_SUPPLIER`;
- `DESTROY`;
- montante elegível para reembolso.

Quando um RMA chega a `INSPECTED`, artigos com decisão `RESTOCK` geram entrada de stock e `StockMovement.CUSTOMER_RETURN` de forma auditável e idempotente.

## Reembolsos

Endpoint administrativo:

```text
POST /v1/admin/returns/:id/refund
```

Só é permitido quando:

- a resolução do RMA é `REFUND`;
- o RMA está `INSPECTED` ou `REFUND_PENDING`;
- existe pagamento `PAID` ou `PARTIALLY_REFUNDED`;
- o total elegível é positivo;
- o total acumulado de reembolsos não excede o pagamento original.

O provider devolve uma referência de reembolso. A referência, montante, RMA e chave de idempotência ficam registados em `Payment.metadata`. O estado do pagamento passa para `PARTIALLY_REFUNDED` ou `REFUNDED`. A encomenda só passa para `REFUNDED` quando o pagamento estiver integralmente reembolsado.

O RMA é marcado como `REFUNDED` apenas depois da operação de provider e atualização transacional da base de dados. Repetir a mesma operação não cria um segundo reembolso.

O provider `mock` implementa o contrato completo de reembolso. Providers reais continuam bloqueados até existir adaptador e credenciais explícitas.

## Substituições

Endpoint administrativo:

```text
POST /v1/admin/returns/:id/replacement
```

Só é permitido para RMA com resolução `REPLACEMENT` e estado `APPROVED` ou `INSPECTED`.

É criada uma nova encomenda:

- com `source=RETURN_REPLACEMENT`;
- a custo zero;
- com os artigos e quantidades do RMA;
- com snapshots de cliente, morada, entrega, canal e conta empresarial da encomenda original;
- com `customerReference` igual ao número do RMA;
- com chave idempotente `return:<id>:replacement`;
- em estado `PAID`, pronta para preparação;
- com nova reserva de stock.

Se a nova reserva falhar, a encomenda de substituição criada é removida e o RMA não é encerrado. Após sucesso, o RMA fica `CLOSED` e recebe um evento auditável com a referência da substituição.

## Pós-venda

`SupportCase` suporta atraso, perda, embalagem/produto danificado, artigo em falta ou incorreto, falha de entrega, devolução ao remetente e outros casos.

Na gestão existem:

```text
/apoio
/apoio/[id]
```

O detalhe permite alterar estado/resolução e adicionar comentários internos. Comentários internos não são devolvidos no acesso do cliente.

## Management

Rotas principais:

```text
/operacoes
/operacoes/preparacao
/expedicoes
/expedicoes/[id]
/devolucoes
/devolucoes/[id]
/apoio
/apoio/[id]
```

O detalhe da devolução expõe ações de reembolso ou substituição apenas conforme a resolução e estado do RMA.

## Segurança e integridade

- operações críticas usam transações;
- movimentos de stock são append-only;
- expedições e reservas usam chaves de idempotência;
- webhooks têm assinatura;
- tracking autenticado valida propriedade;
- gestão exige `STAFF` ou `ADMIN`;
- reembolso não pode ser confirmado apenas pelo frontend;
- montantes usam inteiros em cêntimos;
- não são guardados dados de cartão.

## Limitações atuais

- apenas providers `mock` de pagamento e transporte estão operacionais;
- integração real com transportadora requer configuração e adaptador;
- Stripe está apenas preparado por configuração, sem adaptador real ativo;
- não existe conta corrente B2B completa;
- não existe faturação certificada;
- políticas legais de devolução por categoria/perecíveis ainda devem ser parametrizadas numa fase posterior, não hardcoded.
