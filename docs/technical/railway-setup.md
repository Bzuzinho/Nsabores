# Configuração do Railway

## Configuração versionada por serviço

Os serviços de aplicação usam a raiz do monorepo. Em Railway, deixar **Root
Directory** vazio e definir **Config File** com o caminho absoluto indicado:

| Serviço      | Config File                | Build                                      | Start                                      | Healthcheck   |
| ------------ | -------------------------- | ------------------------------------------ | ------------------------------------------ | ------------- |
| `website`    | `/railway/website.json`    | `pnpm --filter @nsabores/website build`    | `pnpm --filter @nsabores/website start`    | `/api/health` |
| `management` | `/railway/management.json` | `pnpm --filter @nsabores/management build` | `pnpm --filter @nsabores/management start` | `/api/health` |
| `api`        | `/railway/api.json`        | `pnpm --filter @nsabores/api build`        | `pnpm --filter @nsabores/api start:prod`   | `/health`     |

Os ficheiros selecionam Railpack, esperam até 300 segundos pelo health check e
reiniciam no máximo três vezes em caso de falha. Os dois processos Next.js fazem
bind explícito a `0.0.0.0`; a API também e lê a porta injetada em `PORT`.

## Variáveis de staging

Não copiar valores resolvidos nem segredos para o repositório.

### `website`

```text
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://<dominio-staging-website>
NEXT_PUBLIC_API_URL=https://<dominio-staging-api>
```

### `management`

```text
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://<dominio-staging-management>
NEXT_PUBLIC_API_URL=https://<dominio-staging-api>
```

### `api`

```text
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGINS=https://<dominio-staging-website>,https://<dominio-staging-management>
```

Não definir `PORT`: Railway injeta-a automaticamente. `DATABASE_URL` e
`CORS_ORIGINS` são obrigatórias para o funcionamento de staging, mas a API
consegue arrancar e responder em `/health` sem configuração externa; nesse modo
de diagnóstico usa apenas origens localhost e não acede à base de dados.

## Criação manual de staging

Estes passos exigem acesso à conta Railway:

1. No projeto Nsabores, escolher **New Environment → Duplicate Environment**,
   usar `production` como origem e nomear o destino `staging`.
2. Rever as alterações preparadas antes de as aplicar. Confirmar os serviços
   `website`, `management`, `api` e `Postgres`.
3. No `Postgres` de staging, confirmar que `RAILWAY_ENVIRONMENT_NAME=staging`.
   Nunca apontar a API para uma URL copiada de produção.
4. Em cada aplicação, ligar o repositório `Bzuzinho/Nsabores`, branch `main`,
   deixar **Root Directory** vazio e selecionar o **Config File** da tabela.
5. Ativar **Wait for CI** nos três serviços. O CI tem evento `push` em `main`;
   se falhar, o deployment deve ficar `SKIPPED`.
6. Gerar um domínio Railway em **Networking → Public Networking** para cada
   aplicação. Não configurar ainda os domínios `nsabores.pt`.
7. Preencher as variáveis acima com os três domínios gerados. Confirmar que
   `DATABASE_URL` aparece como referência `${{Postgres.DATABASE_URL}}`, não como
   texto de uma credencial.
8. Aplicar as alterações de staging. O PostgreSQL deve ficar saudável antes da
   API quando a alteração é aplicada em conjunto.
9. Opcionalmente, para permitir o workflow manual de fallback, criar o GitHub
   Environment `staging` e adicionar o secret `RAILWAY_TOKEN`. O workflow
   `.github/workflows/deploy-staging.yml` volta a executar todos os checks antes
   de enviar o serviço escolhido.

## Validação do primeiro deployment

Depois do CI e dos deployments concluírem:

```bash
curl --fail --show-error https://<dominio-staging-website>/api/health
curl --fail --show-error https://<dominio-staging-management>/api/health
curl --fail --show-error https://<dominio-staging-api>/health
```

Os três pedidos devem devolver HTTP 200. Nos detalhes do deployment, confirmar
que a configuração tem origem no ficheiro versionado e que não existem erros
críticos nos logs.

Para validar a base de dados, abrir uma shell do serviço `api` no ambiente
`staging` e executar:

```bash
pnpm --filter @nsabores/api prisma:generate
pnpm --filter @nsabores/api exec prisma db execute --stdin <<< "SELECT 1;"
```

Se a shell não suportar redirecionamento, executar `SELECT 1;` através do
separador **Data** do `Postgres`. O health check da API, por desenho, não prova
conectividade ao PostgreSQL.

## Migrações, rollback e recuperação

O schema ainda não tem migrations. Quando existir uma migration revista,
executar uma única vez, antes do deployment da API de staging:

```bash
pnpm --filter @nsabores/api prisma:migrate:deploy
```

Não colocar este comando no start e não o automatizar em produção sem revisão.
Antes de mudanças destrutivas, criar/verificar um backup. Se uma aplicação
falhar, usar **Deployments → ⋯ → Rollback** no serviço afetado. Um rollback de
código não reverte schema ou dados: restaurar o backup ou aplicar uma migration
corretiva validada.

## Limitações

- a criação do ambiente, ligação ao GitHub, variáveis, domínios, deploys e
  validação de logs dependem de acesso manual ao Railway;
- os domínios temporários só podem ser registados na documentação depois de
  gerados;
- `/health` mede a disponibilidade do processo, não PostgreSQL;
- duplicar `production` também duplica configuração e referências; é obrigatório
  confirmar que staging referencia o seu próprio `Postgres`;
- `main` alimenta temporariamente staging e production. Manter aprovação manual
  de produção até existir uma estratégia de promoção separada.
