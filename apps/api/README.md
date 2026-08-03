# API

Serviço central previsto para `api.nsabores.pt`, alojado no Railway.

Responsabilidades:

- autenticação e autorização;
- catálogo, stock e preços;
- clientes, encomendas e pagamentos;
- produção, subscrições, entregas e eventos;
- auditoria, integrações e notificações;
- acesso à base de dados PostgreSQL.

Tecnologia prevista: Node.js, TypeScript, NestJS, Prisma e PostgreSQL.

## Dados de demonstração

A API inclui comandos explícitos e não automáticos para criar e remover dados de demonstração:

- `pnpm run prisma:seed:demo`
- `pnpm run prisma:seed:demo:clear`
