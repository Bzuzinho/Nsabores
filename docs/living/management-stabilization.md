# Estabilização funcional do Management

Última revisão: 2026-08-03

## Âmbito

A Prioridade 0 garante que as áreas principais da aplicação de gestão têm:

- página Next.js existente;
- ligação de navegação acessível;
- endpoint administrativo registado na API;
- proteção por autenticação e perfil;
- smoke test automático sem respostas `404`;
- validação autenticada sobre PostgreSQL com dados demo.

## Produção

`ProductionController` e `ProductionService` são registados diretamente no
`AppModule`. As rotas de produção deixaram de ser criadas manualmente dentro do
controller de recebimentos.

Rotas:

```text
GET   /v1/admin/production
GET   /v1/admin/production/:orderId
PATCH /v1/admin/production/:orderId
POST  /v1/admin/production/:orderId/complete
```

## Navegação operacional

O menu principal inclui explicitamente:

```text
/operacoes
/operacoes/preparacao
/operacoes/producao
/expedicoes
/devolucoes
/apoio
```

A lista de navegação está centralizada em
`apps/management/components/management-routes.ts`. O teste associado confirma
que todos os links principais têm um ficheiro `page.tsx` existente.

## Validação automática

### Testes rápidos

- controllers administrativos registados no `AppModule`;
- `ProductionService` registado por dependency injection;
- endpoints principais mapeados e protegidos;
- ficheiros de página existentes;
- rotas operacionais presentes no menu.

### Smoke autenticado

O workflow `Management smoke` cria uma base PostgreSQL limpa, aplica migrations,
executa o seed base e o seed demo, autentica `demo.staff@nsabores.pt` e consulta
todos os endpoints de listagem usados pelas páginas principais.

A validação falha perante:

- login inválido;
- cookie de acesso ausente;
- resposta HTTP não bem-sucedida;
- endpoint não registado;
- erro interno;
- menos de 12 produtos, 6 categorias ou 8 encomendas demo.

## Regra de evolução

Uma nova página principal do Management deve ser acrescentada ao registo de
rotas e ao smoke autenticado na mesma alteração. Assim, uma página não pode ser
introduzida sem navegação e sem endpoint verificável.
