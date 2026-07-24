# Deploy e ambientes

## Ambientes previstos

- desenvolvimento local;
- staging;
- produção.

## Produção

### Website público

Domínio: `www.nsabores.pt`

O website poderá ser servido no Railway ou noutro serviço compatível com Next.js. Caso o alojamento da Domínios.pt seja apenas alojamento tradicional, o domínio deverá ser apontado por DNS para o serviço onde o frontend estiver efetivamente publicado.

### Aplicação de gestão

Domínio: `app.nsabores.pt`

Alojamento previsto: Railway.

### API

Domínio: `api.nsabores.pt`

Alojamento previsto: Railway.

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

## DNS previsto

A configuração final dependerá dos domínios gerados pelo Railway.

Exemplo conceptual:

```text
www    CNAME   <domínio-do-website>
app    CNAME   <domínio-da-app>
api    CNAME   <domínio-da-api>
```

Não criar registos DNS com valores provisórios.
