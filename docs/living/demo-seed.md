# Ambiente de demonstração integral

**Última revisão:** 2026-08-03

O ambiente demo preenche todas as áreas principais do Management com dados coerentes, auditáveis e identificáveis. Não é executado automaticamente no arranque da API.

## Comandos

A variável `DATABASE_URL` deve apontar para a base pretendida. Para criar os utilizadores, é obrigatória uma destas variáveis: `DEMO_USER_PASSWORD`, `DEMO_USER_PASSWORD_HASH` ou `BOOTSTRAP_ADMIN_PASSWORD_HASH`.

```bash
pnpm demo:install
```

Cria ou atualiza os dados demo sem duplicar os registos principais.

```bash
pnpm demo:validate
```

Confirma as contagens mínimas de todos os módulos.

```bash
pnpm demo:clear
```

Remove apenas os dados identificados como demonstração e pode ser repetido.

```bash
pnpm demo:reset
```

Executa a limpeza e volta a instalar o ambiente completo.

## Cobertura

- catálogo: 6 categorias, 12 produtos, imagens, preços e estados de stock;
- utilizadores: ADMIN, STAFF, CUSTOMER e utilizador associado a conta B2B;
- stock: saldos, níveis mínimos, movimentos e correções de inventário;
- fornecedores: 3 fornecedores, artigos associados, compras e receções;
- inventários: concluído e em progresso;
- B2B: contas aprovadas e pendentes, candidaturas, membros e tabelas de preços;
- encomendas: B2C e B2B, principais estados e pagamentos;
- produção: fila, prioridades, responsáveis e datas pretendidas;
- recebimentos: acordos, estados, referências e eventos de contacto;
- fulfillment: preparação, expedições, tracking, devoluções e apoio;
- promoções: campanhas, cupões, alvos e auditoria de utilização;
- cabazes: composição fixa e personalização;
- Clube Nsabores: planos, subscrições, cobranças e eventos;
- fidelização: regra, contas, tiers, saldos e movimentos;
- vales-oferta: vales, movimentos e pedidos de compra;
- documentos comerciais: séries, faturas-recibo, nota de crédito e origens de encomenda, vale e Clube.

## Identificação e limpeza

Os dados usam exclusivamente marcadores reservados, incluindo:

- emails iniciados por `demo.`;
- encomendas com `source = DEMO_SEED`;
- SKUs constantes da lista demo;
- números e códigos iniciados por `DEMO-`;
- chaves de idempotência iniciadas por `demo:`.

A limpeza remove primeiro as dependências dos módulos avançados e, no fim, os produtos, utilizadores e encomendas base. Não remove categorias partilhadas, métodos de entrega ou registos normais.

## Validação no CI

O workflow `Management smoke` executa numa base PostgreSQL limpa:

1. migrations e seed base;
2. `demo:reset`;
3. nova instalação para provar idempotência;
4. validação das contagens por módulo;
5. smoke autenticado dos endpoints do Management;
6. validação das páginas do menu;
7. limpeza repetida duas vezes;
8. confirmação de que não permanecem dados identificáveis como demo.

As credenciais nunca ficam no repositório.
