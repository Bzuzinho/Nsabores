# Estado vivo da infraestrutura

**Última revisão:** 2026-08-04

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

## Domínios definitivos

A topologia aprovada é:

| Endereço                  | Serviço Railway |
| ------------------------- | --------------- |
| `https://www.nsabores.pt` | `website`       |
| `https://app.nsabores.pt` | `management`    |
| `https://api.nsabores.pt` | `api`           |

O domínio raiz `https://nsabores.pt` deve redirecionar para `https://www.nsabores.pt`. O `www` nunca aponta para a API nem para o PostgreSQL.

Depois da associação dos domínios no Railway, as variáveis de produção devem ficar alinhadas:

```text
WEBSITE_URL=https://www.nsabores.pt
MANAGEMENT_URL=https://app.nsabores.pt
CORS_ORIGINS=https://www.nsabores.pt,https://app.nsabores.pt
NEXT_PUBLIC_APP_URL=https://www.nsabores.pt
NEXT_PUBLIC_API_URL=https://api.nsabores.pt
API_URL=https://api.nsabores.pt
AUTH_COOKIE_SECURE=true
```

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

## Providers e decisões operacionais

### Pagamentos

- `PAYMENT_FLOW_MODE=manual`;
- não existe cobrança digital no checkout;
- o cliente escolhe uma preferência e o operador confirma as condições;
- são suportados contacto prévio, contra entrega, pagamento na recolha e envio à cobrança.

### Transporte

- não existe transportadora automática configurada;
- `case-by-case` permite orçamento e transportadora a confirmar por encomenda;
- `local-pickup` permite recolha local;
- o preço standard automático está desativado.

### Email

- remetente e resposta: `nsabores@outlook.pt`;
- provider preparado para Microsoft Graph com OAuth2 delegado;
- enquanto não existirem credenciais OAuth, `MAIL_PROVIDER=log` mantém o fluxo sem enviar nem expor conteúdo sensível;
- produção real usa `MAIL_PROVIDER=outlook-graph` e segredos apenas no Railway.

### Faturação

- o módulo mantém séries, numeração, linhas, impostos, notas de crédito, eventos e reconciliação para demonstração funcional;
- os documentos são fictícios por decisão de negócio;
- toda a visualização deve indicar `DEMONSTRAÇÃO — SEM VALOR FISCAL`;
- não existe alegação de certificação, comunicação à AT ou validade contabilística.

## Estado operacional

| Critério                               | Estado                          |
| -------------------------------------- | ------------------------------- |
| Configuração por serviço versionada    | concluído                       |
| Website, Management e API em produção  | online                          |
| PostgreSQL ligado à API                | validado                        |
| Health checks remotos                  | ativos                          |
| Migrations em base limpa e produção    | validadas                       |
| Autenticação e permissões E2E          | validadas                       |
| Ambiente demo integral                 | concluído                       |
| CI estrito para qualidade e regressões | concluído                       |
| Fluxo de pagamentos manuais            | implementado                    |
| Transporte caso a caso                 | implementado e validado no E2E  |
| Provider Outlook                       | código pronto; OAuth pendente   |
| Domínios definitivos                   | associação DNS/Railway pendente |
| Faturação de demonstração              | implementada e identificada     |

## Arranque e deployment

O arranque normal da API é:

```bash
node dist/main.js
```

As migrations e operações demo são comandos explícitos. Um restart da aplicação não reinstala nem elimina dados demo.

## Procedimento operacional

A configuração detalhada de Railway, variáveis, health checks, migrations e rollback está em [`docs/technical/railway-setup.md`](../technical/railway-setup.md).

## Limitações atuais

- a ativação do Outlook exige registo de aplicação Microsoft, consentimento `Mail.Send` e refresh token guardado no Railway;
- a associação dos domínios depende da criação dos registos DNS devolvidos pelo Railway;
- um rollback de aplicação não desfaz migrations ou alterações de dados;
- as operações de dados devem manter backups e planos de recuperação explícitos.
