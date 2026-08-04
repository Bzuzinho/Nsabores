# Deploy e ambientes

## Ambientes previstos

- desenvolvimento local;
- staging;
- produção.

## Produção

O utilizador acede sempre a `https://www.nsabores.pt`:

| Caminho   | Responsabilidade                    | Serviço Railway |
| --------- | ----------------------------------- | --------------- |
| `/`       | website institucional, loja e conta | `website`       |
| `/gestao` | aplicação interna autenticada       | `management`    |
| `/v1`     | API do website e da gestão          | `api`           |

O serviço `website` é a entrada pública e encaminha internamente `/gestao` e
`/v1`. Os serviços `management` e `api` mantêm os domínios técnicos gerados
pelo Railway, mas não precisam de subdomínios próprios no DNS da Nsabores.

O domínio raiz `https://nsabores.pt` deve redirecionar para
`https://www.nsabores.pt`.

### Variáveis do website

```text
NEXT_PUBLIC_APP_URL=https://www.nsabores.pt
NEXT_PUBLIC_API_URL=
API_ORIGIN=https://<dominio-interno-api>.up.railway.app
MANAGEMENT_ORIGIN=https://<dominio-interno-management>.up.railway.app
```

`NEXT_PUBLIC_API_URL` fica vazio em produção para que o browser use `/v1` na
mesma origem. `API_ORIGIN` e `MANAGEMENT_ORIGIN` são usados apenas no serviço
`website` para o encaminhamento.

### Variáveis da API

```text
WEBSITE_URL=https://www.nsabores.pt
MANAGEMENT_URL=https://www.nsabores.pt/gestao
CORS_ORIGINS=https://www.nsabores.pt
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=true
```

### Base de dados

PostgreSQL gerido no Railway, com migrations executadas de forma controlada.

## Regras de deploy

- não executar deploy de produção sem confirmação;
- não incluir segredos no GitHub;
- configurar variáveis diretamente no ambiente Railway;
- usar HTTPS em todos os serviços;
- separar variáveis de staging e produção;
- validar migrations antes de aplicar em produção;
- garantir backups antes de alterações estruturais relevantes.

## DNS

É necessário apenas o endereço público do website:

```text
www    CNAME   <domínio-do-website>
@      redirect para https://www.nsabores.pt
```

Não criar registos DNS com valores provisórios.
