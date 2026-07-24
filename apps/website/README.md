# Website e Loja

Aplicação pública Nsabores em Next.js.

Responsabilidades:

- website institucional;
- catálogo e loja online;
- carrinho local demonstrativo;
- experiências, cabazes, tábuas e Clube Nsabores;
- SEO, acessibilidade e desempenho.

## Rotas

`/`, `/sobre`, `/loja`, `/servicos`, `/clube`, `/eventos`, `/receitas` e
`/contactos`.

## Desenvolvimento

```bash
pnpm --filter @nsabores/website dev
pnpm --filter @nsabores/website test
pnpm --filter @nsabores/website build
```

O catálogo, carrinho, pesquisa e newsletter são locais nesta fase. Checkout,
pagamentos, autenticação, stock e encomendas estão fora do âmbito atual.
