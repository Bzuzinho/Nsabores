# Estado vivo da infraestrutura

**Última revisão:** 2026-07-24

**Responsável:** equipa Nsabores

## GitHub e pipeline

- repositório: `Bzuzinho/Nsabores`;
- branch de deployment temporária: `main`;
- CI em cada push para `main`: formato, lint, tipos, testes e build;
- Railway deve manter **Wait for CI** ativo nas três aplicações;
- workflow manual de staging: valida o commit antes de executar `railway up`;
- nenhuma credencial é guardada no repositório.

## Aplicações

- `website` e `management`: Next.js App Router, bind a `0.0.0.0`;
- `api`: NestJS, bind a `0.0.0.0`, porta de `PORT`, CORS explícito em staging;
- Prisma preparado para PostgreSQL, ainda sem entidades ou migrations;
- Node.js 22, pnpm 11 e Turborepo.

## Railway

`production` já contém `website`, `management`, `api` e `Postgres`. A
configuração versionada para staging é:

| Serviço      | Config File                | Healthcheck       | Variáveis                                                |
| ------------ | -------------------------- | ----------------- | -------------------------------------------------------- |
| `website`    | `/railway/website.json`    | `/api/health`     | `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` |
| `management` | `/railway/management.json` | `/api/health`     | `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` |
| `api`        | `/railway/api.json`        | `/health`         | `NODE_ENV`, `DATABASE_URL`, `CORS_ORIGINS`               |
| `Postgres`   | imagem gerida Railway      | estado do serviço | variáveis geridas Railway                                |

`DATABASE_URL` deve ser a referência `${{Postgres.DATABASE_URL}}`. `PORT` é
fornecida pelo Railway e não deve ser definida manualmente.

## Estado da validação de staging

| Critério                                | Estado em 2026-07-24       |
| --------------------------------------- | -------------------------- |
| Configuração por serviço versionada     | concluído                  |
| Comandos locais e checks do repositório | concluído em 2026-07-24    |
| Ambiente `staging` e quatro serviços    | requer acesso Railway      |
| PostgreSQL independente                 | requer confirmação Railway |
| Wait for CI                             | requer confirmação Railway |
| Domínios temporários                    | por gerar no Railway       |
| Três health checks HTTP 200 remotos     | pendente do deployment     |
| Conectividade API → PostgreSQL          | pendente do deployment     |

Os valores reais e evidências remotas devem substituir os estados pendentes
depois da intervenção na conta. Não inventar domínios.

Validação local concluída com `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test` e `pnpm build`.

## Procedimento operacional

O procedimento completo, incluindo configuração final, variáveis sem segredos,
passos de staging, health checks, migrações, rollback e limitações, está em
[`docs/technical/railway-setup.md`](../technical/railway-setup.md).

## Limitações atuais

- os health checks não exercitam PostgreSQL;
- não existe migration para executar;
- staging e production usam temporariamente `main`;
- um rollback de aplicação não desfaz alterações de dados;
- criação e validação efetiva de staging exigem acesso manual à conta Railway.
