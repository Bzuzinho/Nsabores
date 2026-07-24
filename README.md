# Nsabores

O Sprint 5 acrescenta stock quantitativo, fornecedores, compras, inventário e
contas B2B com tabelas de preços. A arquitetura operacional está descrita em
[`docs/living/operations-b2b.md`](docs/living/operations-b2b.md).

Plataforma digital da marca **Nsabores**, composta por:

- website institucional;
- loja online;
- serviços e experiências gastronómicas;
- aplicação interna de gestão;
- API central;
- base de dados PostgreSQL.

## Arquitetura prevista

```text
www.nsabores.pt        Website público e loja online
app.nsabores.pt        Aplicação interna de gestão
api.nsabores.pt        API central
Railway                 Aplicação, API e PostgreSQL
GitHub                  Código-fonte e CI/CD
Domínios.pt             Gestão do domínio e DNS
```

## Estrutura prevista do monorepo

```text
apps/
  website/
  management/
  api/
packages/
  ui/
  types/
  validation/
  config/
docs/
scripts/
.github/
```

## Tecnologias previstas

- Next.js
- React
- TypeScript
- Tailwind CSS
- Node.js
- PostgreSQL
- Prisma ORM
- pnpm workspaces
- Railway
- GitHub Actions

## Estado atual

A fundação executável do monorepo está implementada:

- website e gestão em Next.js com App Router, Tailwind e health checks;
- API NestJS com validação de ambiente, CORS e Prisma/PostgreSQL;
- packages partilhados de UI, tipos, validação e configuração;
- testes reais e CI sobre instalação congelada, formato, lint, tipos, testes e build.

O catálogo funcional acrescenta categorias e produtos persistidos, API pública
e administrativa, gestão em `/catalogo`, loja em `/loja` e detalhe em
`/loja/[slug]`. Consultar [a documentação viva](docs/living/catalog.md) para
endpoints, configuração e limitações.

O fluxo comercial inclui carrinho persistente, checkout convidado/autenticado,
entregas configuráveis, encomendas, pagamento mock seguro e operação em
`/encomendas`. Consultar
[a documentação de comércio](docs/living/commerce.md).

## Desenvolvimento

Requer Node.js 22 e pnpm 11.9.0.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Copiar `.env.example` para `.env` antes de arrancar a API. O health check da
API não acede à base de dados.

## Princípios do projeto

- alterações pequenas e verificáveis;
- componentes reutilizáveis;
- segurança por defeito;
- ausência de segredos no repositório;
- código tipado e testado;
- documentação atualizada;
- nenhum push direto para `main` sem validação.
