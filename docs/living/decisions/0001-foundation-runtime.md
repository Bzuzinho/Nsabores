# 0001 — Fundação executável em monorepo

**Data:** 2026-07-24

**Estado:** aceite

**Responsável:** equipa Nsabores

## Contexto

O repositório definia Next.js, NestJS, Prisma, pnpm e Railway, mas continha
apenas estrutura e documentação. Era necessário tornar as três aplicações
executáveis sem antecipar o modelo de negócio.

## Decisão

Manter um monorepo pnpm/Turborepo com:

- duas aplicações Next.js App Router independentes;
- uma API NestJS independente;
- packages compilados para consumo consistente pela API e Next.js;
- contratos de health check e componente visual partilhados;
- Prisma ligado a PostgreSQL, sem entidades até estas serem definidas;
- builds Railway iniciadas na raiz para preservar os workspaces.

## Alternativas consideradas

- duplicar tipos e UI nas aplicações: rejeitado por não validar os workspaces;
- criar entidades Prisma provisórias: rejeitado para não inventar domínio;
- usar uma única aplicação: rejeitado por contrariar a topologia Railway.

## Consequências

### Positivas

- aplicações publicáveis de forma independente;
- contratos partilhados validados em build e testes;
- fundação pequena, sem abstrações de negócio prematuras.

### Negativas ou riscos

- os packages partilhados precisam de build antes dos consumidores;
- migrations e conectividade real ao PostgreSQL continuam por validar.

## Referências

- Issue #8.
