# Operações, stock e canal B2B

Última revisão: 2026-08-05 — Codex

## Stock

`StockItem` mantém quantidades físicas e reservadas. A disponibilidade é sempre
derivada por `onHandQuantity - reservedQuantity`. Alterações são transacionais e
auditadas por `StockMovement`; correções criam movimentos compensatórios.

O checkout cria uma reserva. Pagamento confirmado mantém-na; pagamento falhado
ou cancelamento liberta-a; expedição consome-a e reduz o stock físico. As chaves
de idempotência e a atualização condicional de `StockItem` impedem duplicação,
dupla reserva e stock negativo.

## Fornecedores, compras e inventário

Uma compra guarda custos e descrições como snapshot. Só a receção total ou
parcial incrementa stock. Sobre-receção exige confirmação explícita. Ao concluir
um inventário, cada diferença produz um `INVENTORY_CORRECTION` auditável.

A Gestão permite configurar reposição e tracking, registar acertos manuais,
criar e transitar compras, receber artigos, criar inventários, gravar contagens,
concluir ou cancelar. Produtos novos recebem `StockItem` automaticamente; a
migration de preenchimento cobre produtos já existentes.

## B2B

A aprovação de uma candidatura cria uma `BusinessAccount`, atribui a
`PriceList` e condições comerciais. `BusinessAccountUser` liga vários
utilizadores à empresa com papéis `OWNER`, `BUYER` ou `VIEWER`.

O servidor nunca expõe preços B2B a anónimos. Uma conta `APPROVED` vê produtos
`B2B_ONLY` e `BOTH`, preços atribuídos, mínimos e múltiplos. A encomenda guarda
canal, tabela, preço e condições em snapshot. Contas pendentes, rejeitadas ou
suspensas ficam bloqueadas.

A aprovação cria a conta empresarial e, quando existe um utilizador com email
já verificado, associa-o como `OWNER`. Se o registo acontecer depois da
aprovação, a associação só é feita após a verificação do email. `VIEWER` pode
consultar condições e preços, mas apenas `OWNER` e `BUYER` podem encomendar.

## Endpoints e permissões

- público: `POST /v1/reseller-applications`, `GET /v1/catalog/resolved`;
- B2B autenticado: `GET /v1/business/account`, `GET /v1/business/catalog`,
  `POST /v1/business/orders`;
- STAFF/ADMIN: `/v1/admin/stock`, `stock/movements`, `suppliers`, `purchases`,
  `inventories` e decisões de `reseller-applications`;
- ADMIN: escrita de `business-accounts`, respetivos membros e `price-lists`.

## Limitações

Não existem múltiplos armazéns, lotes, validade ou EDI. A transportadora real e
a faturação certificada dependem de integrações externas; os fluxos manuais e os
documentos de demonstração estão separados e explicitamente identificados.
