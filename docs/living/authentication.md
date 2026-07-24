# Autenticação e clientes

Última revisão: 2026-07-24. Responsável: equipa Nsabores.

## Fluxos

`POST /v1/auth/register` cria CUSTOMER, perfil e sessão. Login devolve apenas
dados públicos e cookies. `POST /v1/auth/refresh` roda o refresh token.
`logout`, `logout-all`, recuperação, redefinição e verificação nunca devolvem
hashes.

Endpoints autenticados adicionais:

- `GET/PATCH /v1/auth/me` e `/v1/account/profile`;
- CRUD de `/v1/account/addresses`;
- alteração de password e gestão de `/v1/auth/sessions`;
- administração em `/v1/admin/users`, exclusiva a ADMIN.

O catálogo administrativo aceita STAFF e ADMIN. `ADMIN_API_KEY` foi removida.

## Roles

- `CUSTOMER`: conta, perfil, moradas e futura compra;
- `STAFF`: gestão do catálogo;
- `ADMIN`: catálogo e utilizadores.

## Aplicações

O website expõe `/conta`, autenticação, recuperação/verificação, perfil,
moradas e segurança. A gestão expõe `/login`, `/sem-acesso`, protege o catálogo
e oferece `/utilizadores` apenas a ADMIN.

## Bootstrap

Na primeira seed, definir as quatro variáveis `BOOTSTRAP_ADMIN_*`. A seed só
cria o administrador se o email ainda não existir e nunca substitui password,
role ou dados existentes. Remover as variáveis do Railway após sucesso.

## Retenção e limitações

Sessões expiradas podem ser removidas por manutenção periódica futura.
Metadados limitam-se a user-agent e IP. Não existem ainda MFA, login social,
eliminação RGPD completa nem email real de produção.
