# NSabores — arquitetura integrada v2 (2026-11-25)

## Decisão de domínio
Uma fonte de verdade por identidade: pessoa singular ou coletiva. A conta autenticável pertence exclusivamente a uma pessoa singular; uma entidade coletiva não usa credenciais partilhadas. O módulo Administração > Identidades e utilizadores é o único cadastro; clientes, revendedores, staff e administradores são vistas/perfis, não cadastros independentes. Uma pessoa pode ser criada sem credenciais e ativá-las por verificação de email. Identidades e contas existentes devem manter referências estáveis. Dados pessoais e empresariais não são duplicados entre modelos. Email de autenticação e contactos comerciais têm semânticas distintas.

Modelo alvo (nomes técnicos provisórios): Party (PERSON/ORGANIZATION, identificador estável), User (credenciais e referência única à Party pessoal), PartyProfile (CLIENT, RESELLER, acumuláveis; revenda implica cliente), UserRoleAssignment (STAFF, ADMIN e permissões internas), PartyMembership (userId, partyId, estado, permissões por representação), CommercialTerms (partyId, priceListId, crédito, prazo), ResellerApplication (partyId, estado, decisão auditada). A identidade pessoal tem exatamente um titular; uma organização pode ter vários representantes e um utilizador pode representar várias organizações. Não criar um segundo registo pessoal para compras particulares. A gestão de identidades inclui moradas, contactos, preferências, consentimentos, classificações e atividade. Perfil comercial não concede privilégios administrativos. Natureza jurídica não determina preço: empresa pode ser consumidor final, pessoa singular pode revender. Aprovação de revenda e níveis 1–3 são atributos comerciais; preços aplicados apenas a contexto autorizado e aprovado.

## Contexto e autorização
Autenticar uma vez, selecionar contexto pessoal ou empresarial. A API valida a associação ativa e a permissão específica em cada pedido; nunca confiar no contexto enviado pelo frontend. Carrinhos, preços, moradas, encomendas, conta corrente e documentos segregados por titular. Encomenda guarda partyId e createdByUserId (autor distinto do titular), snapshots imutáveis de faturação/preços e histórico. Desativação de associação revoga acesso empresarial sem remover conta pessoal nem histórico. Gestão empresarial só pode convidar/gerir representantes dentro da própria entidade; sem autoatribuição de ADMIN/STAFF. Convites com token expirável de utilização única e verificação do email. Registo público nunca associa históricos existentes antes de comprovação de titularidade, e nunca reativa conta suspensa por si só. Não expor existência de contas internas em respostas públicas.

## Navegação alvo
- Painel: indicadores e filas de trabalho reais.
- Vendas: encomendas (criar/consultar/editar conforme estado), nova encomenda, análise comercial.
- Operações: preparação, montagem/produção, expedições/entregas, devoluções, apoio.
- Financeiro: recebimentos e validação, contas correntes, documentos comerciais, fornecedores. Reconciliação como vista de pagamentos por identificar apenas se houver origem real; sem segundo processo redundante.
- Produtos e preços: produtos/serviços, compostos/cabazes, categorias, tabelas consumidor final e revenda 1/2/3.
- Compras e stocks: fornecedores, compras/faturas, receções, stocks, movimentos e inventário.
- Património: bens/equipamentos, localização, garantia/manutenção, inventário patrimonial. Passivos são obrigações financeiras.
- Marketing: campanhas, promoções/cupões, newsletter, segmentos, blog, conteúdos website.
- Administração: identidades e utilizadores (filtros pessoas/empresas/clientes/revendedores/candidaturas/staff/admin), perfis e permissões, parametrizações, auditoria, integrações.
Website institucional divulga produtos/serviços, loja e blog; área reservada contextual inclui encomendas, entrega prevista, documentação, pagamentos, conta corrente, apoio e preferências.

## Fluxos obrigatórios
1. Registo público: password alinhada frontend/API (10–128 caracteres, maiúscula, minúscula, número), confirmação, mostrar/ocultar, mensagens de validação array/string; login sem impor regras de criação a credenciais antigas; recuperação sem enumeração. Tratar P2002 com diagnóstico interno sem dados sensíveis, concorrência e resposta segura; 409 não prova qual índice falhou. Ativação de identidade preexistente só após prova de titularidade e sem duplicar nem reatribuir entidade.
2. Revenda: candidatura por titular autorizado, análise, aprovação/rejeição, nível e tabela atribuídos, suspensão; mantém histórico e não confere direitos internos.
3. Encomenda: online ou gestão → validação comercial (preço, transporte, prazo) → confirmação/reserva → preparação parcial/total → conferência → expedição/recolha → entrega confirmada → fecho. Estados comercial, operacional e financeiro separados; crédito autorizado permite entrega não liquidada. Cancelamentos libertam reservas; não alterar snapshots históricos.
4. Recebimento manual: registar valor, método, referência/comprovativo, autor, data, alocação a uma ou várias encomendas, pagamentos parciais, validação, reversão auditada. Pendentes e liquidados são filtros do mesmo ledger. Conta corrente por titular, saldos derivados e histórico preservado. Sem pagamentos online nesta fase; documentos comerciais reais associados, sem emissão fiscal automática até integração aprovada.
5. Compras: fornecedor/fatura/linhas → receção física → stock e custo atualizados uma única vez, regras de atualização de preços configuráveis, aprovação quando definida; dívida/pagamento fornecedor. Inventário ajusta por movimento auditado; lotes, validades e quebras. Stock físico/reservado/disponível separados. Cabaz é produto composto; consumir componentes na montagem ou reserva conforme modelo, nunca duas vezes.
6. Devolução: encomenda entregue → seleção de linhas e quantidades ainda elegíveis → análise → receção/inspeção → reposição ou quebra → regularização financeira → fecho. Não repor alimentos automaticamente. Apoio: contacto público/área reservada/criação interna, relacionar titular e encomenda quando aplicável.
7. Marketing: consentimentos, preferências, segmentação, campanhas e blog; registos de atividade proporcionais e sujeitos a permissões; cancelamento de comunicações.
8. Parametrizações: empresa, perfis, condições comerciais, pagamentos, transportes, impostos, unidades, armazéns, preços, notificações e integrações. Não permitir alterações retroativas a documentos emitidos.

## Implementação incremental
A. Inventariar schema Prisma, migrations, controllers, serviços, rotas, componentes, guards, seeds, testes, flags e ambiente publicado. Mapa de dependências User/Customer/CustomerProfile/BusinessAccount e todos os FKs; classificar aproveitar/corrigir/refatorar/criar/eliminar.
B. Corrigir UX e segurança de autenticação; estabelecer modelo de identidade e permissões/contexto, migração expansiva e compatibilidade temporária.
C. Administração unificada e seleção de contexto; migrar fluxos B2C/B2B, aprovações, tabelas de preços.
D. Catálogo, compras, stocks e produtos compostos; operações e vendas integradas.
E. Financeiro/conta corrente/documentos, devoluções/apoio, portal cliente.
F. Marketing, património, parâmetros; reorganizar navegação e remover duplicações quando dependências migradas.
G. Testar e publicar por lote; pagamentos digitais ficam por último. A anterior decisão de Fase 2 deve ser revista módulo a módulo; não ativar DEFERRED_FEATURES_ENABLED globalmente sem testes e autorização de rollout.

## Migração e aceitação
Backup restaurável e ensaio em cópia isolada. Inventariar duplicados por email normalizado/NIF quando disponível; não fazer merge automático de casos ambíguos. Preservar mapeamento IDs antigos/novos, FKs, snapshots, encomendas, pagamentos, moradas, consentimentos, documentos, histórico e privilégios; contas existentes não recebem novas permissões por inferência. Expandir → preencher → validar contagens e totais/órfãos → migrar leitores/escritores → remover legado só após validação. Plano de rollback compatível com novas escritas. Não alterar produção/DNS ou eliminar dados nesta branch.
Testes obrigatórios: registo novo e duplicado; password inválida e válida; ativação segura; conta suspensa; restaurante com três funcionários (compras, gerência, contabilidade) e compra pessoal; troca de contexto e isolamento horizontal; funcionário removido; revenda pendente/aprovada/suspensa; preços no backend; compras/receção sem dupla entrada; cabazes e concorrência de stock; pagamento parcial/múltiplo/reversão; entrega a crédito; devolução parcial; campanhas só para elegíveis. Testes negativos de escalada de privilégio, IDOR e revogação. Para cada menu validar origem dos dados, ação inicial, sequência, permissões, efeitos, exceções, histórico e conclusão. Nenhuma feature é concluída por mera existência de página/endpoint.

## Estado
Documento de referência inicial; não representa implementação ou testes executados. Requer validação por código e decisões operacionais sobre margens, limites, regras de crédito e integração fiscal antes de ativação.
