# Configuração do Railway

## Estado

Os serviços `website`, `management`, `api` e `Postgres` já existem no ambiente
`production`, com `Wait for CI` ativo nas aplicações. A fundação deve ser
validada primeiro num ambiente `staging`.

## Build a partir da raiz

Os três serviços usam a raiz do monorepo, para que o pnpm encontre todos os
workspaces. Não configurar `apps/*` como Root Directory.

### website

```text
Build: pnpm --filter @nsabores/website build
Start: pnpm --filter @nsabores/website start
Healthcheck: /api/health
```

Variável:

- `NEXT_PUBLIC_API_URL`

### management

```text
Build: pnpm --filter @nsabores/management build
Start: pnpm --filter @nsabores/management start
Healthcheck: /api/health
```

Variável:

- `NEXT_PUBLIC_API_URL`

### api

```text
Build: pnpm --filter @nsabores/api build
Start: pnpm --filter @nsabores/api start:prod
Healthcheck: /health
```

Variáveis obrigatórias:

- `DATABASE_URL`: referência privada ao serviço PostgreSQL;
- `NODE_ENV`: `production`;
- `PORT`: porta injetada pelo Railway;
- `CORS_ORIGINS`: URLs permitidos separados por vírgulas.

Os comandos acima e os três health checks foram verificados localmente. Os
health checks não dependem da base de dados.

## Staging

1. Criar o ambiente `staging`, caso ainda não exista.
2. Replicar os quatro serviços existentes.
3. Ligar os três serviços de aplicação a `Bzuzinho/Nsabores`.
4. Configurar Node.js 22 e os comandos acima.
5. Referenciar `DATABASE_URL` do Postgres no serviço `api`.
6. Gerar os domínios Railway e preencher URLs/CORS.
7. Configurar o secret `RAILWAY_TOKEN` no GitHub Environment `staging`.
8. Executar manualmente `.github/workflows/deploy-staging.yml`.

Nunca colocar o token, a URL real da base de dados ou outros segredos no
repositório.

## Migrações

O schema inicial não contém entidades nem migrations. Quando existir uma
migration validada, executá-la de forma controlada:

```bash
pnpm --filter @nsabores/api prisma:migrate:deploy
```

Não executar migrations automaticamente no start, para evitar concorrência
entre réplicas.

## Produção

Só promover depois de staging passar CI, health checks e validação manual. O
deploy de produção deve partir de `main` e manter aprovação manual nesta fase.
