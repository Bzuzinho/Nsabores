# Catálogo

Última revisão: 2026-07-24. Responsável: equipa Nsabores.

## Modelo

`Category` e `Product` são persistidos em PostgreSQL através do Prisma. Os
identificadores são UUID, preços são inteiros em cêntimos e `gallery` é um
array PostgreSQL. A relação usa `ON DELETE RESTRICT`: uma categoria com
produtos não pode ser eliminada. Produtos eliminados são desativados.

## API

Endpoints públicos: `GET /v1/categories`, `GET /v1/categories/:slug`,
`GET /v1/products` e `GET /v1/products/:slug`. A listagem aceita
`category`, `featured`, `search`, `page`, `limit`, `sort` e `order`.

Os endpoints em `/v1/admin/categories` e `/v1/admin/products` suportam
`GET`, `POST`, `PATCH /:id` e `DELETE /:id`. Exigem sessão autenticada com
role `STAFF` ou `ADMIN`.

## Desenvolvimento local

1. Criar uma base PostgreSQL vazia.
2. Definir `DATABASE_URL`, as variáveis `AUTH_*`, `API_URL` e
   `NEXT_PUBLIC_API_URL` num ambiente local não versionado.
3. Executar `pnpm --filter @nsabores/api prisma:migrate:deploy`.
4. Executar `pnpm --filter @nsabores/api prisma:seed`.

A seed usa `upsert` por slug/SKU e não elimina registos existentes.

## Interfaces

A gestão em `/catalogo` oferece métricas, tabela pesquisável/filtrável,
formulários de produto e gestão de categorias. O acesso usa cookies HTTP-only
emitidos pela API central.

O website carrega destaques na homepage, oferece pesquisa, filtros, ordenação
e paginação em `/loja`, e detalhe, galeria e relacionados em `/loja/[slug]`.
A homepage mantém uma seleção visual controlada quando a API falha.

## Limitações

O carrinho permanece local e não existe checkout. Imagens usam caminhos locais
ou URLs controlados. Upload, variantes, stock quantitativo, promoções,
autenticação real e encomendas ficam para sprints posteriores.
