# ADR 0002 — Autenticação centralizada com cookies e refresh rotativo

Data: 2026-07-24
Estado: aceite

## Contexto

Website, gestão e API vivem em subdomínios distintos e precisam de partilhar
identidade sem expor tokens ao JavaScript persistente. Checkout e encomendas
exigirão sessões revogáveis.

## Decisão

A API NestJS é a autoridade de autenticação. Emite:

- JWT de acesso com 15 minutos, num cookie `HttpOnly`;
- refresh token opaco aleatório, num cookie `HttpOnly`, guardado na base apenas
  como SHA-256;
- cookies `Secure` em produção, `SameSite=Lax` e domínio configurável.

Cada refresh revoga a sessão anterior e cria outra. Logout revoga a sessão
corrente; logout-all e alterações de password revogam todas. Passwords usam
Argon2id. Operações mutáveis validam a origem configurada; CORS permite
credenciais apenas às origens declaradas.

O refresh não é JWT, logo não existe `AUTH_REFRESH_TOKEN_SECRET`: reduzir
segredos e manter revogação direta foi uma escolha intencional.

## Consequências

As aplicações nunca usam `localStorage` para autenticação. O cliente HTTP
partilhado inclui credenciais, tenta um refresh controlado e agrega pedidos
concorrentes numa única tentativa. O domínio dos cookies deve ser
`.nsabores.pt` em produção.

Email é uma abstração. Desenvolvimento regista links de teste; produção não
regista tokens e deverá receber um provider transacional antes do lançamento.
