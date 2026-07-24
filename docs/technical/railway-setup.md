# Configuração do Railway

Este guia descreve a configuração inicial da infraestrutura Nsabores no Railway.

## 1. Criar o projeto

Criar um projeto denominado `Nsabores` e ligá-lo ao repositório GitHub `Bzuzinho/Nsabores`.

## 2. Criar ambientes

Criar os ambientes:

- `staging`
- `production`

O ambiente de produção não deve ser usado até o staging estar validado.

## 3. Criar PostgreSQL

Adicionar um serviço PostgreSQL gerido pelo Railway.

A variável `DATABASE_URL` deve ser referenciada pelo serviço `api`. Não copiar a credencial para ficheiros versionados.

## 4. Criar serviços de aplicação

Criar três serviços ligados ao mesmo repositório:

### website

- Root directory: `apps/website`
- Domínio previsto: `www.nsabores.pt`
- Variável pública: `NEXT_PUBLIC_API_URL`

### management

- Root directory: `apps/management`
- Domínio previsto: `app.nsabores.pt`
- Variável pública: `NEXT_PUBLIC_API_URL`

### api

- Root directory: `apps/api`
- Domínio previsto: `api.nsabores.pt`
- Variáveis: `DATABASE_URL`, `PORT`, `CORS_ALLOWED_ORIGINS`

Os comandos concretos de build e start serão definidos quando as aplicações forem geradas.

## 5. Token para GitHub Actions

Criar um token Railway com o menor âmbito possível e adicioná-lo ao GitHub:

1. Repository settings.
2. Environments.
3. Criar o environment `staging`.
4. Adicionar o secret `RAILWAY_TOKEN`.

Nunca colocar o token em `.env`, documentação, issues ou mensagens de commit.

## 6. Deploy

O workflow `.github/workflows/deploy-staging.yml` é manual e permite escolher um serviço.

O deploy só deve ser executado depois de:

- as aplicações terem sido geradas;
- os comandos de build e start funcionarem localmente;
- os serviços Railway terem os nomes `website`, `management` e `api`;
- o token estar configurado.

## 7. Health checks

Após a geração das aplicações, configurar:

- website: `/api/health` ou rota equivalente;
- management: `/api/health` ou rota equivalente;
- api: `/health`.

Os health checks devem devolver sucesso sem depender de serviços externos, exceto quando existir um endpoint separado para verificar a base de dados.

## 8. Produção

O deploy de produção deve ser configurado apenas após validação do staging. Deve exigir:

- CI concluída com sucesso;
- branch `main`;
- environment GitHub `production`;
- aprovação manual, enquanto o projeto estiver em fase inicial;
- migrações de base de dados controladas.
