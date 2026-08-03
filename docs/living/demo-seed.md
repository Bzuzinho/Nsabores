# Seed de demonstração

O seed de demonstração complementa o seed base com dados navegáveis para catálogo, stock, utilizadores e encomendas em estados diferentes.

## Criar dados demo

```bash
DEMO_USER_PASSWORD='<password-segura>' pnpm --filter @nsabores/api prisma:seed:demo
```

A variável `DATABASE_URL` deve apontar para a base de dados pretendida.

## Remover apenas os dados demo

```bash
pnpm --filter @nsabores/api prisma:seed:demo:clear
```

O comando remove apenas registos identificados pelo seed de demonstração:

- encomendas com `source = DEMO_SEED` e respetivos itens, pagamentos e histórico;
- utilizadores com email iniciado por `demo.` e respetivos perfis, endereços e sessões;
- produtos com os SKUs reservados ao dataset demo e o respetivo stock.

Não apaga categorias, fornecedores, métodos de entrega, tabelas de preços nem dados reais.

## Segurança

- A password nunca é guardada no repositório.
- Nenhum dos comandos é executado automaticamente no arranque da API.
- Os registos usam identificadores, origem, emails e SKUs reservados à demonstração.
- O seed é idempotente e pode ser repetido sem duplicar os registos principais.
- A limpeza é executada numa transação: em caso de erro, nenhuma remoção parcial é confirmada.

## Cobertura inicial

- doze produtos adicionais;
- stock coerente e pontos de reposição;
- um utilizador STAFF e cinco clientes;
- oito encomendas, cobrindo os principais estados;
- pagamentos e histórico de estado associados.

Os restantes módulos serão acrescentados progressivamente até cumprir a issue #36.
