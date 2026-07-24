# ADR 0004 — Separar utilizador de conta empresarial

- Estado: aceite
- Data: 2026-07-24

## Contexto

Uma empresa pode ter vários compradores. Colocar toda a informação numa role
`RESELLER` impediria delegação, auditoria e evolução para outros clientes B2B.

## Decisão

`User` representa a pessoa autenticada. `BusinessAccount` representa a entidade
comercial, preços, crédito, mínimos, pagamento e estado.
`BusinessAccountUser` associa ambos e atribui `OWNER`, `BUYER` ou `VIEWER`.

Encomendas B2B referenciam o utilizador e a empresa e guardam snapshots da
tabela, preço e condições aplicadas.

## Consequências

Suspender a empresa bloqueia todos os membros sem desativar as identidades. As
autorizações validam a associação ativa e o estado empresarial, não apenas a
role global do utilizador.
