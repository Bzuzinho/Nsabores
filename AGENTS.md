# Instruções para agentes de desenvolvimento

## Contexto

Este repositório contém a plataforma Nsabores: website institucional, loja online, serviços gastronómicos, aplicação de gestão, API e base de dados.

## Regras obrigatórias

1. Inspecionar o repositório antes de alterar código.
2. Apresentar um plano curto antes de mudanças estruturais.
3. Trabalhar por fases e em alterações pequenas.
4. Não fazer push direto para `main` sem confirmação expressa.
5. Não guardar segredos, credenciais ou dados reais de clientes.
6. Manter TypeScript estrito.
7. Reutilizar componentes e tipos partilhados.
8. Executar lint, verificação de tipos, testes e build antes de concluir.
9. Documentar decisões arquiteturais relevantes.
10. Não ativar pagamentos, emails ou integrações reais sem credenciais e autorização.

## Arquitetura prevista

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

## Infraestrutura

- `www.nsabores.pt`: website, loja, gestão em `/gestao` e API em `/v1`;
- `management` e `api`: serviços internos Railway encaminhados pelo website;
- Railway: aplicações e PostgreSQL;
- Domínios.pt: domínio e DNS.

## Primeira missão do Codex

Antes de implementar funcionalidades:

- analisar os documentos existentes;
- propor a arquitetura final;
- criar o monorepo;
- configurar pnpm, TypeScript, lint e formatação;
- criar shells mínimos para website, gestão e API;
- configurar Prisma sem aplicar migrations em produção;
- configurar CI inicial;
- atualizar o README;
- aguardar validação antes de avançar para o produto funcional.
