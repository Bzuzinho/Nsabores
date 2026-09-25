# Âmbito aprovado pelo cliente — 24/09/2026

Este documento traduz para configuração operacional a Matriz de Aprovação Funcional entregue pelo cliente.

## Disponível no arranque

- Website institucional, Blog, destaques de produtos e formulários de contacto/apoio.
- Loja: catálogo, páginas de produto, cabazes, carrinho/checkout, encomendas e métodos de entrega.
- Área de cliente: conta/login/perfil, moradas, histórico de encomendas, documentos reais associados aos pedidos e apoio.
- Gestão de encomendas e devoluções, com ciclo manual de tratamento e fecho da encomenda; sem os subfluxos avançados de preparação, produção ou expedição.
- Recebimentos: estado de pagamento, acompanhamento de recebimentos e reconciliação manual de pagamentos com encomendas.
- Marketing: promoções, conteúdos e produtos em destaque.
- Revendedores/B2B: candidaturas, contas profissionais e membros/utilizadores associados.
- Administração: painel, utilizadores, estado das contas e sessões.

## Fase 2 / indisponível no arranque

- Stock, movimentos, inventários, fornecedores, compras e respetivo painel.
- Preparação de encomendas, operações/produção e expedições.
- Emissão/gestão fiscal automática de documentos comerciais, notas de crédito e reconciliação documental/fiscal.
- Reembolsos financeiros automáticos.
- Cupões.
- Clube Nsabores, fidelização/pontos e vales-oferta.
- Tabelas de preços e encomendas B2B.
- Perfis/permissões configuráveis.

Os documentos disponíveis ao cliente no arranque são ficheiros reais associados manualmente pela equipa a uma encomenda (por exemplo, fatura ou guia recebida do processo comercial). A emissão fiscal automática, notas de crédito e respetiva reconciliação continuam em Fase 2.

## Pagamentos

Por decisão operacional posterior à matriz, os pagamentos do arranque são exclusivamente manuais. O cliente submete a encomenda, a equipa combina/recebe o pagamento e confirma o recebimento na Gestão.

Os pagamentos online ficam para o último lote do projeto. O endpoint de pagamento automático, webhooks e confirmações mock ficam bloqueados enquanto `PAYMENT_FLOW_MODE=manual`.

O adapter atual de pagamentos automáticos apenas suporta o provider de desenvolvimento/mock. A ativação futura exige a escolha do operador, integração real, credenciais, webhooks e testes antes de alterar o modo de produção.

## Regra de implementação

Os módulos de Fase 2 permanecem no código para evolução futura, mas:

- são ocultados da navegação da Gestão;
- acessos diretos na Gestão mostram indicação de Fase 2;
- as áreas públicas selecionadas para Fase 2 são redirecionadas para uma área disponível;
- ações de Fase 2 dentro de módulos parcialmente aprovados ficam indisponíveis na interface;
- em produção, `DEFERRED_FEATURES_ENABLED=false` bloqueia também os endpoints de API correspondentes, evitando acesso direto fora da interface;
- os dashboards deixam de consultar/expor indicadores de stock, compras e encomendas B2B enquanto esses módulos estiverem adiados;
- a encomenda pode ser marcada manualmente como entregue no fluxo simples, permitindo o processo de devolução sem reativar Expedições/tracking.
