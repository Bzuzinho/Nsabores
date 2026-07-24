# Estado vivo da infraestrutura

**Última revisão:** 2026-07-24

**Responsável:** equipa Nsabores

## GitHub

- Repositório: `Bzuzinho/Nsabores`
- Branch principal: `main`
- Integração por pull request: ativa por convenção
- CI: instalação congelada, formato, lint, tipos, testes e build
- Deploy staging: workflow manual por serviço
- Dependabot: npm e GitHub Actions

## Implementação atual

- website e gestão em Next.js App Router;
- API NestJS com Prisma preparado para PostgreSQL;
- packages partilhados `types`, `validation`, `config` e `ui`;
- Node.js 22, pnpm 11 e Turborepo;
- CORS limitado à lista separada por vírgulas em `CORS_ORIGINS`;
- variáveis da API validadas no arranque.

Não existem ainda autenticação, loja, pagamentos, CRM, entidades Prisma ou
migrations.

## Railway

Os serviços `website`, `management`, `api` e `Postgres` existem em `production`.
`Wait for CI` está ativo nos três serviços de aplicação. O primeiro deploy desta
fundação deve acontecer em `staging`.

Todas as aplicações usam a raiz do monorepo como diretório de build.

| Serviço    | Build                                      | Start                                      | Healthcheck   |
| ---------- | ------------------------------------------ | ------------------------------------------ | ------------- |
| website    | `pnpm --filter @nsabores/website build`    | `pnpm --filter @nsabores/website start`    | `/api/health` |
| management | `pnpm --filter @nsabores/management build` | `pnpm --filter @nsabores/management start` | `/api/health` |
| api        | `pnpm --filter @nsabores/api build`        | `pnpm --filter @nsabores/api start:prod`   | `/health`     |

As três builds, os comandos de start e os health checks HTTP 200 foram
verificados localmente.

## Variáveis

Não guardar valores reais no repositório.

### GitHub Environment `staging`

- `RAILWAY_TOKEN`

### Website

- `NEXT_PUBLIC_API_URL`

### Management

- `NEXT_PUBLIC_API_URL`

### API

- `DATABASE_URL`
- `NODE_ENV` (`development`, `test` ou `production`)
- `PORT`
- `CORS_ORIGINS` (origens separadas por vírgulas)

## Comandos verificados

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm dev`
- `pnpm --filter @nsabores/api prisma:generate`

## Configuração final de staging

1. Criar ou confirmar o ambiente `staging`.
2. Replicar os quatro serviços de `production` para `staging`.
3. Definir a raiz do monorepo como diretório de build nos três serviços.
4. Aplicar os comandos e healthchecks da tabela.
5. Referenciar `DATABASE_URL` do Postgres no serviço `api`.
6. Definir `NODE_ENV=production`, `PORT` e `CORS_ORIGINS` na API.
7. Definir `NEXT_PUBLIC_API_URL` nos frontends depois de gerar o domínio da API.
8. Configurar `RAILWAY_TOKEN` no GitHub Environment `staging`.
9. Validar staging antes de alterar produção.

## Limitações e próximos passos

- `/health` mede o processo da API, não a conectividade com PostgreSQL;
- a primeira entidade deve introduzir a primeira migration versionada;
- migrations devem correr com
  `pnpm --filter @nsabores/api prisma:migrate:deploy`, fora do start concorrente;
- domínios e valores finais dependem da configuração externa Railway.
