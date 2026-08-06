# Dados demonstrativos Nsabores

Este conjunto de seeds cria um ambiente funcional para demonstração e testes sem misturar os registos de exemplo com dados reais.

## Comandos simples

Executar na raiz do repositório:

```bash
# Criar ou completar todos os dados demonstrativos
DEMO_USER_PASSWORD='definir-uma-password' pnpm demo:load

# Confirmar que o ambiente demonstrativo está completo
pnpm demo:check

# Apagar todos os dados demonstrativos e validar que não ficou nenhum
pnpm demo:remove

# Apagar e voltar a criar todo o ambiente demonstrativo
DEMO_USER_PASSWORD='definir-uma-password' pnpm demo:reset
```

Os nomes antigos `demo:install`, `demo:clear` e `demo:validate` continuam disponíveis como aliases, para não quebrar processos existentes.

## Cobertura funcional

O carregamento é dividido por domínio e termina sempre com uma validação automática. O ambiente inclui, pelo menos:

- catálogo, categorias, produtos, imagens, stock e movimentos de inventário;
- utilizadores administrativos, colaboradores e clientes particulares;
- clientes empresariais, revendedores, candidaturas, tabelas de preços e condições comerciais;
- fornecedores, produtos de fornecedor, compras, receções e ordens de compra;
- encomendas em vários estados, pagamentos, expedições, tracking, devoluções e apoio ao cliente;
- promoções, cupões, cabazes fixos e configuráveis e personalização de oferta;
- produção, contagens de inventário e operações de armazém;
- acordos de pagamento e contas a receber;
- planos, subscrições, cobranças e benefícios do Clube Nsabores;
- contas e movimentos de fidelização;
- cartões oferta e respetivas compras;
- documentos fiscais e respetivos estados;
- dados suficientes para os dashboards, listas, detalhes e fluxos de gestão.

A validação falha caso algum domínio obrigatório não tenha a quantidade mínima de registos esperada.

## Identificação e remoção segura

Os registos demonstrativos usam identificadores reservados, entre outros:

- emails iniciados por `demo.` ou terminados em `.demo@nsabores.pt`;
- códigos, números e referências iniciados por `DEMO-`;
- chaves de idempotência iniciadas por `demo:`;
- encomendas com origem `DEMO_SEED`;
- produtos pertencentes à lista explícita de SKUs demonstrativos.

O comando `pnpm demo:remove` executa a remoção pela ordem necessária para respeitar as relações da base de dados e, no fim, corre `demo-seed-clear-validate.ts`. Se algum registo identificável permanecer, o comando termina com erro e apresenta o domínio onde a limpeza ficou incompleta.

O comando não faz `truncate` global, não apaga utilizadores reais e não elimina registos que não correspondam aos marcadores demonstrativos.

## Estrutura

- `demo-seed.ts`: base, catálogo e clientes particulares;
- `demo-seed-operations.ts`: fornecedores, compras, stock e operações;
- `demo-seed-commerce.ts`: encomendas, promoções, cabazes, expedições e pós-venda;
- `demo-seed-membership.ts`: Clube, fidelização, cartões oferta e fiscalidade;
- `demo-seed-validate.ts`: verificação de cobertura;
- `demo-seed-clear*.ts`: remoção ordenada dos dados demonstrativos;
- `demo-seed-clear-validate.ts`: confirmação final de limpeza.

## Utilização em produção

Os seeds não são executados automaticamente no arranque da API. Devem ser carregados apenas quando se pretende um ambiente de demonstração. Antes de usar em produção, confirme que `DATABASE_URL` aponta para a base correta e que a password dos utilizadores demo não é reutilizada noutros sistemas.
