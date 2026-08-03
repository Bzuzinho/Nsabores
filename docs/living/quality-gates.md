# Gates de qualidade

**Última revisão:** 2026-08-03

A branch `main` só deve receber alterações que passem os gates automáticos abaixo.

## Quality checks

Executados em pull requests:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Nenhum destes comandos usa `continue-on-error`. O runner não altera nem formata o código antes da validação; o commit submetido é exatamente o commit testado.

## Migrations e regressões funcionais

Numa instância PostgreSQL 16 limpa, o CI:

1. gera o Prisma Client;
2. aplica todas as migrations;
3. confirma `prisma migrate status`;
4. executa o seed base;
5. valida Clube, pagamentos manuais, fidelização, checkout, recebimentos e faturação;
6. confirma que os smokes transacionais existentes continuam verdes.

## Management e E2E

O workflow `Management smoke` usa PostgreSQL limpo e executa:

1. instalação e reset do ambiente demo integral;
2. segunda instalação para comprovar repetibilidade;
3. validação das contagens mínimas por módulo;
4. acesso público ao catálogo;
5. autenticação STAFF e leitura de `/v1/auth/me`;
6. recusa de acesso administrativo sem autenticação;
7. recusa de acesso administrativo para CUSTOMER;
8. validação de todos os endpoints principais do Management;
9. validação das rotas Next.js presentes no menu;
10. limpeza do ambiente demo duas vezes e confirmação de ausência de resíduos.

## Regras de dependency injection

- controllers recebem serviços pelo construtor;
- controllers não instanciam serviços de domínio com `new`;
- serviços transversais são registados no `AppModule` ou num módulo próprio;
- scripts de smoke podem obter serviços através de `app.get()`;
- criação direta de `PrismaService` fora do container Nest não é permitida no arranque da aplicação.

## Segredos e bootstrap

- passwords, hashes, tokens e chaves nunca entram no repositório;
- o bootstrap administrativo é opcional e exige simultaneamente `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD_HASH`;
- a ausência das duas variáveis desativa o bootstrap;
- definir apenas uma das variáveis provoca falha explícita de configuração.

## Deployment

O deployment no Railway mantém:

- health check da API em `/health`;
- arranque normal sem seeds demo automáticos;
- migrations e seeds como operações explícitas;
- validação dos estados dos serviços depois do merge em `main`.
