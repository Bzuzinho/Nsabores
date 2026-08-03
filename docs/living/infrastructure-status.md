# Estado vivo da infraestrutura

**Última revisão:** 2026-08-03

**Responsável:** equipa Nsabores

## GitHub e pipeline

- repositório: `Bzuzinho/Nsabores`;
- branch de produção: `main`;
- CI em pull requests: formatação, lint, typecheck, testes, build e validação de migrations;
- `Management smoke`: PostgreSQL limpo, ambiente demo integral, autenticação, permissões, endpoints administrativos, rotas do Management, idempotência e limpeza;
- lint, typecheck, testes e build são gates bloqueantes;
- Railway mantém a ligação ao GitHub para website, Management e API;
- nenhuma credencial é guardada no repositório.

## Aplicações

- `website`: Next.js App Router, catálogo e loja ligados à API;
- `management`: Next.js App Router, gestão autenticada dos módulos operacionais;
- `api`: NestJS, PostgreSQL e Prisma, bind a `0.0.0.0` na porta fornecida por `PORT`;
- `Postgres`: serviço gerido pelo Railway;
- Node.js 22, pnpm 11 e Turborepo.

## Base de dados

- 21 migrations versionadas e validadas numa base PostgreSQL limpa;
- migrations executadas em produção;
- histórico Prisma alinhado com a estrutura real;
- seed base separado do ambiente demo;
- ambiente demo integral com instalação, validação, limpeza e reset idempotentes;
- nenhum seed demo é executado automaticamente no arranque normal da API.

## Railway

O projeto Railway contém `website`, `management`, `api` e `Postgres` no ambiente de produção.

| Serviço      | Config File                | Healthcheck   | Variáveis principais                                      |
| ------------ | -------------------------- | ------------- | --------------------------------------------------------- |
| `website`    | `/railway/website.json`    | `/api/health` | `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`  |
| `management` | `/railway/management.json` | `/api/health` | `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`  |
| `api`        | `/railway/api.json`        | `/health`     | `NODE_ENV`, `DATABASE_URL`, `CORS_ORIGINS`, segredos auth |
| `Postgres`   | imagem gerida Railway      | serviço       | variáveis geridas pelo Railway                            |

`DATABASE_URL` deve usar a referência do serviço Postgres. `PORT` é fornecida pelo Railway e não deve ser definida manualmente.

## Estado operacional

| Critério                                    | Estado       |
| ------------------------------------------- | ------------ |
| Configuração por serviço versionada         | concluído    |
| Website, Management e API em produção       | online       |
| PostgreSQL ligado à API                     | validado     |
| Health checks remotos                       | ativos       |
| Migrations em base limpa e produção         | validadas    |
| Autenticação e permissões E2E                | validadas    |
| Ambiente demo integral                      | concluído    |
| CI estrito para qualidade e regressões      | concluído    |
| Domínios definitivos `nsabores.pt`           | por concluir |
| Providers externos de pagamentos/fiscal/etc | por concluir |

## Arranque e deployment

O arranque normal da API é:

```bash
node dist/main.js
```

As migrations e operações demo são comandos explícitos. Um restart da aplicação não reinstala nem elimina dados demo.

## Procedimento operacional

A configuração detalhada de Railway, variáveis, health checks, migrations e rollback está em [`docs/technical/railway-setup.md`](../technical/railway-setup.md).

## Limitações atuais

- os providers de pagamento, transporte, email e faturação certificada continuam por integrar;
- os domínios temporários Railway devem ser substituídos pelos domínios definitivos;
- um rollback de aplicação não desfaz migrations ou alterações de dados;
- as operações de dados devem manter backups e planos de recuperação explícitos.
