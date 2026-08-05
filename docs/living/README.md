# Documentação Viva

Consulte [Operações, stock e canal B2B](./operations-b2b.md) para o modelo do
Sprint 5 e [ADR 0004](./decisions/0004-business-account-separation.md) para a
separação entre utilizador e conta empresarial.

Esta pasta contém documentação operacional e evolutiva do projeto. Deve ser atualizada à medida que o produto, o negócio e as decisões técnicas mudam.

## Regras

1. Atualizar os documentos na mesma Pull Request que altera o comportamento descrito.
2. Registar decisões importantes em `decisions/`.
3. Manter requisitos e âmbito em `product/`.
4. Registar processos de operação em `operations/`.
5. Nunca guardar credenciais, dados pessoais ou informação confidencial.
6. Indicar sempre a data da última revisão e o responsável pela alteração.

## Estrutura

- `product/`: visão, requisitos, personas, jornadas e backlog funcional.
- `decisions/`: registos de decisões de produto e arquitetura.
- `operations/`: processos de operação, suporte e lançamento.
- `changelog/`: resumo legível das mudanças relevantes.
- `templates/`: modelos para novos documentos.
- `website-status.md`: estado funcional e limitações do website público.
- `completion-audit-2026-08-05.md`: auditoria funcional transversal e trabalho
  ainda pendente após a revisão de agosto.
- `catalog.md`: modelo, API e interfaces do catálogo.
- `authentication.md`: sessões, clientes, roles e bootstrap administrativo.
- `commerce.md`: carrinho, checkout, pagamentos, entrega e gestão de encomendas.

A documentação técnica consolidada continuará em `docs/`, enquanto esta área funciona como memória viva do projeto.
