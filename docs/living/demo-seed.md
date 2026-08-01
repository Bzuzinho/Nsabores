# Seed de demonstração

O seed de demonstração complementa o seed base com dados navegáveis para catálogo, stock, utilizadores e encomendas em estados diferentes.

## Execução

```bash
DEMO_USER_PASSWORD='<password-segura>' pnpm --filter @nsabores/api prisma:seed:demo
```

A variável `DATABASE_URL` deve apontar para a base de dados pretendida.

## Segurança

- A password nunca é guardada no repositório.
- O comando não é executado automaticamente no arranque da API.
- Os registos usam identificadores e emails com prefixo `demo`.
- O seed é idempotente e pode ser repetido sem duplicar os registos principais.

## Cobertura inicial

- doze produtos adicionais;
- stock coerente e pontos de reposição;
- um utilizador STAFF e cinco clientes;
- oito encomendas, cobrindo os principais estados;
- pagamentos e histórico de estado associados.

Os restantes módulos serão acrescentados progressivamente até cumprir a issue #36.
