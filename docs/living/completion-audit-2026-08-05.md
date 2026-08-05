# Auditoria funcional — website, cliente, gestão e API

**Última revisão:** 2026-08-05

**Responsável:** equipa Nsabores

## Resultado

Todos os módulos expostos no website, na área de cliente e no menu de Gestão
foram revistos contra as respetivas rotas, serviços, modelos Prisma e testes.
Os cinco fluxos que ainda eram essencialmente de consulta na auditoria anterior
passaram a ter operações completas na interface e na API.

## Estado por módulo

| Área                       | Estado                         | Operações verificadas                                                                                                              |
| -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Website institucional      | Concluído                      | Homepage, heros responsivos, navegação, rodapé, serviços, experiências, contactos e SEO básico.                                    |
| Conteúdo e Blog            | Concluído                      | Listagem e detalhe públicos; criação, edição, publicação, rascunho e remoção na Gestão.                                            |
| Contactos                  | Concluído                      | Validação, proteção anti-spam, limite de pedidos e entrega ao provider de email configurado.                                       |
| Autenticação e conta       | Concluído                      | Registo, verificação de email, login, recuperação, perfil, moradas, sessões e alteração de password.                               |
| Área de cliente            | Concluído                      | Dashboard, encomendas, documentos, devoluções, tracking, moradas, Clube, fidelização, vales e experiência diferenciada B2C/B2B.    |
| Catálogo                   | Concluído                      | Categorias e produtos com CRUD, imagens, publicação, canal B2C/B2B, unidade de venda, mínimos, múltiplos e embalagem.              |
| Carrinho e checkout        | Concluído no modo manual atual | Carrinho anónimo/autenticado, cupões, cabazes, snapshots, reserva de stock, entrega, encomenda idempotente e pagamento a combinar. |
| Vendas e recebimentos      | Concluído                      | Pesquisa, detalhe, estados, notas, confirmação manual de pagamento, custo de transporte, histórico e CSV.                          |
| Produção e preparação      | Concluído                      | Fila, prioridades, responsáveis, datas, ficha de produção e transições operacionais.                                               |
| Expedições                 | Concluído no modo manual atual | Criação parcial/total a partir da encomenda, artigos, peso/custo, etiqueta de teste, expedição, eventos e tracking.                |
| Devoluções e apoio         | Concluído                      | Pedido pelo cliente, decisão, reembolso/substituição, estados, incidências e comentários.                                          |
| Promoções e cupões         | Concluído                      | Regras, alvos, stacking, limites, quantity deals, utilizações e editores de Gestão.                                                |
| Cabazes                    | Concluído                      | Cabazes fixos/configuráveis, grupos, componentes, personalização e reserva dos componentes reais.                                  |
| Stock                      | Concluído                      | Disponível/reservado, configuração de reposição, ativação de tracking, acertos auditados e histórico de movimentos.                |
| Fornecedores               | Concluído                      | Criar, consultar, editar e eliminar; fornecedores com histórico são desativados.                                                   |
| Compras                    | Concluído                      | Criação, submissão, confirmação, cancelamento permitido e receções parciais/totais com sobre-receção explícita.                    |
| Inventários                | Concluído                      | Seleção de produtos, contagem, notas, gravação intermédia, conclusão, cancelamento e correções auditadas.                          |
| Candidaturas profissionais | Concluído                      | Candidatura pública, prevenção de duplicados, aprovação/rejeição, tabela/condições e notificação por email.                        |
| Contas B2B                 | Concluído                      | CRUD comercial, estados, tabela, limites, morada, membros OWNER/BUYER/VIEWER e histórico de encomendas.                            |
| Tabelas de preços          | Concluído                      | Criar, editar, validade, ativação, itens, preços promocionais, mínimos/máximos e remoção/desativação segura.                       |
| Compra B2B                 | Concluído                      | Catálogo reservado, preços atribuídos, quantidades mínimas/múltiplas, referência do cliente e encomenda por OWNER/BUYER.           |
| Clube Nsabores             | Concluído no modo manual atual | Planos, adesões, subscrições, alterações, cobranças, renovação e confirmação manual.                                               |
| Fidelização e vales        | Concluído no modo manual atual | Ledgers, regras, saldos, reservas, compra/consulta de vales e emissão após confirmação.                                            |
| Documentos comerciais      | Demonstração funcional         | Séries, documentos, notas de crédito, eventos e reconciliação, sempre identificados como sem valor fiscal.                         |
| Administração              | Concluído                      | Dashboards, utilizadores, roles, estados, menu por categorias e configuração de métodos de entrega restrita a ADMIN.               |

## Implementado nesta passagem

- operações completas das candidaturas profissionais e respetiva notificação;
- edição integral de contas empresariais, membros e condições comerciais;
- criação, edição e remoção segura de tabelas de preços;
- criação, contagem, conclusão e cancelamento de inventários;
- estados e receções parciais/totais no detalhe das compras;
- configuração e acertos manuais de stock com idempotência e auditoria;
- campos comerciais B2B no editor de produtos;
- criação de encomendas profissionais na área do cliente;
- criação de expedições parciais ou totais no detalhe da encomenda;
- gestão administrativa dos custos e disponibilidade dos métodos de entrega;
- associação B2B apenas depois da verificação do email empresarial;
- criação automática de `StockItem` para produtos novos e migration de
  preenchimento para produtos existentes.

## Dependências externas deliberadamente não simuladas em produção

Estas áreas precisam de uma decisão de fornecedor, contrato e credenciais. A
aplicação mantém um fluxo manual operacional e falha explicitamente se alguém
tentar ativar um provider real sem adaptador:

1. pagamentos digitais e reembolsos automáticos (por exemplo, Stripe);
2. transportadora, compra de etiquetas e tracking por webhook real;
3. faturação certificada e comunicação à Autoridade Tributária;
4. cobrança recorrente automática do Clube;
5. envio real por Microsoft Graph enquanto o OAuth `Mail.Send` não estiver
   configurado no Railway.

Não devem ser removidos os avisos `DEMONSTRAÇÃO — SEM VALOR FISCAL` até existir
software certificado e validação contabilística.

## Evoluções opcionais, não bloqueantes

- permissões mais granulares dentro do perfil `STAFF`;
- múltiplos armazéns, lotes e validades;
- integração EDI/catálogo eletrónico de fornecedores;
- integração da newsletter com uma plataforma de marketing;
- dados jurídicos e ligações sociais finais fornecidos pela empresa.

## Critérios de entrega

- migration aplicada antes do arranque da API;
- `API_ORIGIN`, `CONTACT_RECIPIENT_EMAIL` e provider de email confirmados;
- `format:check`, `lint`, `typecheck`, `test` e `build` verdes;
- migrations e smoke autenticado executados sobre PostgreSQL limpo;
- validação dos três serviços depois do deployment.
