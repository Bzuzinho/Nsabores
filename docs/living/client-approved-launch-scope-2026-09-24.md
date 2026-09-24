# Âmbito aprovado pelo cliente — 24/09/2026

Este documento traduz para configuração operacional a Matriz de Aprovação Funcional entregue pelo cliente.

## Disponível no arranque

- Website institucional, Blog, destaques de produtos e formulários de contacto/apoio.
- Loja: catálogo, páginas de produto, cabazes, carrinho/checkout, encomendas e métodos de entrega.
- Área de cliente: conta/login/perfil, moradas, histórico de encomendas e apoio.
- Gestão de encomendas e devoluções, sem os subfluxos de preparação, produção ou expedição.
- Recebimentos: estado de pagamento, acompanhamento de recebimentos e reconciliação manual de pagamentos com encomendas.
- Marketing: promoções, conteúdos e produtos em destaque.
- Revendedores/B2B: candidaturas, contas profissionais e membros/utilizadores associados.
- Administração: painel, utilizadores, estado das contas e sessões.

## Fase 2 / indisponível no arranque

- Stock, movimentos, inventários, fornecedores, compras e respetivo painel.
- Preparação de encomendas, operações/produção e expedições.
- Documentos comerciais/fiscais, notas de crédito e reconciliação documental/fiscal.
- Reembolsos financeiros automáticos.
- Cupões.
- Clube Nsabores, fidelização/pontos e vales-oferta.
- Tabelas de preços e encomendas B2B.
- Perfis/permissões configuráveis.

A área de cliente deixa igualmente de expor documentos enquanto o módulo de documentos comerciais estiver em Fase 2, por dependência funcional.

## Pagamentos online

A matriz aprova pagamentos online para o arranque. A versão atualmente em produção continua, no entanto, em fluxo manual até existir um provider real configurado e credenciais de produção.

O adapter atual de pagamentos automáticos apenas suporta o provider de desenvolvimento/mock. Não deve ser usado para cobrança real. A ativação de pagamentos online exige a escolha do operador e a respetiva integração/credenciais antes de alterar o modo de produção.

## Regra de implementação

Os módulos de Fase 2 permanecem no código para evolução futura, mas:

- são ocultados da navegação da Gestão;
- acessos diretos na Gestão mostram indicação de Fase 2;
- as áreas públicas selecionadas para Fase 2 são redirecionadas para uma área disponível;
- ações de Fase 2 dentro de módulos parcialmente aprovados ficam indisponíveis na interface.
