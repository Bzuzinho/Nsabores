# 0003 — Fronteiras do domínio comercial

Data: 2026-07-24

Estado: aceite

## Decisão

Persistir carrinho, entrega, encomenda, itens, pagamento, histórico e eventos de
webhook na API central. Valores monetários usam cêntimos inteiros. A encomenda
guarda snapshots imutáveis; o catálogo é consultado novamente durante o
checkout. Pagamentos são acedidos por uma abstração de provider e só eventos
verificados podem liquidar uma encomenda.

## Consequências

O frontend nunca é autoridade sobre preço ou pagamento. A idempotência é
persistida, funciona entre processos e permite repetição segura. O modelo aceita
um provider real sem acoplar o checkout, mas credenciais e efeitos externos
permanecem desativados até autorização operacional.
