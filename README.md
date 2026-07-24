# Nsabores

Plataforma digital da marca **Nsabores**, composta por:

- website institucional;
- loja online;
- serviços e experiências gastronómicas;
- aplicação interna de gestão;
- API central;
- base de dados PostgreSQL.

## Arquitetura prevista

```text
www.nsabores.pt        Website público e loja online
app.nsabores.pt        Aplicação interna de gestão
api.nsabores.pt        API central
Railway                 Aplicação, API e PostgreSQL
GitHub                  Código-fonte e CI/CD
Domínios.pt             Gestão do domínio e DNS
```

## Estrutura prevista do monorepo

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

## Tecnologias previstas

- Next.js
- React
- TypeScript
- Tailwind CSS
- Node.js
- PostgreSQL
- Prisma ORM
- pnpm workspaces
- Railway
- GitHub Actions

## Estado atual

Repositório preparado para a fase de planeamento técnico e implementação inicial.

O desenvolvimento deve começar pela análise da arquitetura, configuração do monorepo, definição do modelo de dados e criação da base técnica do projeto.

## Princípios do projeto

- alterações pequenas e verificáveis;
- componentes reutilizáveis;
- segurança por defeito;
- ausência de segredos no repositório;
- código tipado e testado;
- documentação atualizada;
- nenhum push direto para `main` sem validação.
