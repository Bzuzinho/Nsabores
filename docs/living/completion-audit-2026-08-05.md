# Auditoria funcional — website, cliente e gestão

**Última revisão:** 2026-08-05

**Responsável:** equipa Nsabores

## Corrigido nesta revisão

| Área                 | Resultado                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo público     | A origem da API ignora variáveis vazias e o loading preserva o hero, eliminando o ecrã vazio.                                                        |
| Heroes               | Homepage, experiências/eventos, serviços e blog usam uma altura aproximadamente 50% menor em desktop. Contactos passou a ter hero fotográfico.       |
| Blog                 | Artigos persistidos na API, listagem e detalhe públicos, e CRUD completo em Gestão com rascunhos e publicação.                                       |
| Contactos            | Formulário real com validação, anti-spam, limite de pedidos e entrega por email; os dados por confirmar foram removidos da interface.                |
| Acesso à Gestão      | Retirado do cabeçalho e colocado no canto inferior direito do rodapé.                                                                                |
| Área de cliente      | Dashboard com dados reais de encomendas, documentos, moradas, Clube e fidelização; navegação e conteúdo distintos para particular, revendedor e B2B. |
| Identidade da Gestão | Logótipo real no login e no menu lateral.                                                                                                            |
| Navegação da Gestão  | Categorias clicáveis, dashboard por categoria e submenus expansíveis; Oferta passou a Catálogo e Centro de operações foi removido.                   |
| Dashboards           | Vendas, Operações, Catálogo, Compras e stock, Clientes e Administração têm painéis com indicadores e gráficos CSS responsivos.                       |
| Fornecedores         | Criar, consultar, editar e eliminar/desativar. Fornecedores com histórico são desativados para preservar movimentos.                                 |

## Lacunas encontradas fora do âmbito corrigido

Estas funcionalidades têm suporte parcial na API, mas a interface de Gestão
continua essencialmente de consulta:

1. decisão de candidaturas de revendedores;
2. edição integral de contas B2B, membros e condições comerciais;
3. criação e edição de tabelas de preços;
4. criação, contagem e conclusão de inventários;
5. receções parciais/totais de compras dentro do detalhe da compra.

Também permanece por definir uma matriz granular de permissões dentro de
`STAFF`; atualmente as restrições principais distinguem `CUSTOMER`, `STAFF` e
`ADMIN`.

## Critérios de entrega

- migration aplicada antes do deployment;
- `API_ORIGIN`, `CONTACT_RECIPIENT_EMAIL` e provider de email confirmados no
  ambiente de produção;
- artigo inicial publicado para evitar um blog vazio no lançamento;
- `format:check`, `lint`, `typecheck`, `test` e `build` verdes;
- smoke autenticado executado contra uma base PostgreSQL limpa.
