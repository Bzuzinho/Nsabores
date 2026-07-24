# Estado vivo da infraestrutura

Última atualização: 2026-07-24

Este documento deve refletir o estado real da infraestrutura. Deve ser atualizado sempre que forem criados, alterados ou removidos serviços, ambientes, domínios, segredos ou pipelines.

## GitHub

- Repositório: `Bzuzinho/Nsabores`
- Branch principal: `main`
- Integração por pull request: ativa por convenção
- Workflow de CI: criado em `.github/workflows/ci.yml`
- Deploy para staging: workflow manual criado em `.github/workflows/deploy-staging.yml`
- Dependabot: configurado para npm e GitHub Actions

## Railway

Estado atual: **por configurar na conta Railway**.

Estrutura prevista:

| Serviço | Diretório | Domínio previsto | Estado |
|---|---|---|---|
| website | `apps/website` | `www.nsabores.pt` | por criar |
| management | `apps/management` | `app.nsabores.pt` | por criar |
| api | `apps/api` | `api.nsabores.pt` | por criar |
| PostgreSQL | gerido pelo Railway | privado | por criar |

Ambientes previstos:

- `staging`
- `production`

## Segredos e variáveis

Não colocar valores reais neste ficheiro.

### GitHub Environment: staging

- `RAILWAY_TOKEN`

### Railway partilhadas

- `DATABASE_URL`
- `NODE_ENV`
- `APP_ENV`

### Railway website

- `NEXT_PUBLIC_API_URL`

### Railway management

- `NEXT_PUBLIC_API_URL`

### Railway API

- `DATABASE_URL`
- `PORT`
- `CORS_ALLOWED_ORIGINS`
- `AUTH_SECRET` — quando a autenticação for implementada

## Próximas ações

1. Criar o projeto Nsabores no Railway.
2. Criar os ambientes `staging` e `production`.
3. Adicionar PostgreSQL.
4. Criar os serviços `website`, `management` e `api` ligados ao repositório.
5. Configurar o token Railway no GitHub Environment `staging`.
6. Gerar as aplicações mínimas e respetivos health checks.
7. Validar o primeiro deploy em staging.
8. Só depois preparar o deploy automático de produção.
