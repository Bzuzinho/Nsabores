# Arquitetura da plataforma Nsabores

## Objetivo

Construir uma solução única para presença institucional, comércio eletrónico, serviços gastronómicos e gestão interna do negócio.

## Componentes

### Website público

Domínio previsto: `https://www.nsabores.pt`

Responsabilidades:

- apresentação institucional;
- catálogo e pesquisa;
- loja online;
- carrinho e checkout;
- área de cliente;
- pedidos de tábuas, cabazes e eventos;
- Clube Nsabores;
- conteúdos, receitas e contactos.

### Aplicação de gestão

Caminho público: `https://www.nsabores.pt/gestao`

Responsabilidades:

- dashboard;
- produtos e categorias;
- stock, lotes e validades;
- encomendas;
- clientes e CRM;
- fornecedores;
- produção de tábuas e cabazes;
- subscrições;
- eventos, entregas e relatórios;
- utilizadores, permissões e auditoria.

### API

Caminho público: `https://www.nsabores.pt/v1`

Responsabilidades:

- regras de negócio;
- autenticação e autorização;
- validação;
- acesso à base de dados;
- integrações externas;
- logging e auditoria.

### Base de dados

PostgreSQL alojado no Railway.

## Organização do código

O projeto deverá evoluir para um monorepo com aplicações independentes e pacotes partilhados.

```text
apps/
  website/
  management/
  api/
packages/
  ui/
  types/
  validation/
  config/
docs/
scripts/
.github/
```

## Decisões iniciais

- TypeScript em todas as aplicações;
- Next.js para o website e aplicação de gestão;
- Node.js para a API;
- Prisma ORM para PostgreSQL;
- pnpm workspaces;
- Railway para API, gestão e base de dados;
- GitHub Actions para validação contínua;
- deploy de produção apenas após confirmação;
- segredos apenas em variáveis de ambiente.

## Entrada pública única

O serviço `website` funciona como gateway da experiência pública. Encaminha
`/gestao` para a aplicação de gestão e `/v1` para a API, mantendo três serviços
independentes no Railway sem exigir três domínios registados. A gestão usa o
`basePath` `/gestao`; website e gestão consomem a API pela mesma origem.

## Princípios

- segurança por defeito;
- separação clara de responsabilidades;
- contratos tipados entre frontend e API;
- componentes reutilizáveis;
- migrations versionadas;
- testes nos fluxos críticos;
- documentação mantida juntamente com o código.
