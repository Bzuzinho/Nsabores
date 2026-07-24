# Estado vivo do website

**Última revisão:** 2026-07-24

**Responsável:** equipa Nsabores

## Referência visual

O website segue o mockup aprovado `Nsabores_mockup_funcional.html`: paleta verde
escuro, creme e dourado, composição editorial, tipografia serifada nos títulos,
fotografia gastronómica e linguagem centrada em curadoria, proximidade,
tradição e experiências.

Os assets foram fornecidos com o mockup e estão versionados em
`apps/website/public/images/`. Não existem imagens base64 no código.

## Páginas públicas

- `/`: homepage completa;
- `/sobre`: história, posicionamento e pilares;
- `/loja`: catálogo demonstrativo e filtros;
- `/servicos`: tábuas, cabazes e catering;
- `/clube`: conceito e funcionamento previsto;
- `/eventos`: empresas, celebrações e processo;
- `/receitas`: guias e inspiração;
- `/contactos`: necessidades de contacto e dados explicitamente por confirmar.

Todas reutilizam o cabeçalho, rodapé, newsletter e sistema visual comum.

## Componentes principais

- `SiteHeader` e `MobileNavigation`;
- `Hero` e `ValueStrip`;
- `SectionHeading`;
- `ExperienceCard`;
- `ProductCard` e `ProductShowcase`;
- `NewsletterForm`;
- `EditorialPage`;
- `SiteFooter`;
- `ShopProvider` para estado local do carrinho.

## Comportamento atual

- menu mobile com abertura e fecho;
- pesquisa local sobre os produtos de demonstração;
- filtros por categoria;
- adição e remoção no carrinho em memória;
- contador e total local;
- newsletter com validação frontend e mensagem de sucesso;
- metadata global e por página, Open Graph base, `robots.txt` e sitemap;
- navegação por teclado, skip link, focus visível e textos alternativos;
- layouts específicos para 360, 768, 1024 e 1440 px.

## Dados e limitações

- produtos, categorias, preços, receitas e experiências são estáticos;
- o carrinho perde o conteúdo ao recarregar;
- não existem checkout, pagamentos, stock, encomendas ou conta de cliente;
- a newsletter não envia dados para um serviço externo;
- contactos, morada, redes sociais e dados legais finais ainda não foram
  fornecidos e aparecem como informação por confirmar;
- os meios de pagamento no rodapé são apenas placeholders visuais;
- não existe ligação à API nem ao backoffice;
- não foram alterados Railway, domínios ou deployment.

## Próximos passos

1. Modelar catálogo, categorias, preços e stock na API.
2. Substituir os dados locais por queries com estados de loading e erro.
3. Persistir carrinho e definir regras de entrega.
4. Implementar autenticação, conta e encomendas.
5. Integrar checkout e pagamentos apenas após decisão e autorização.
6. Ligar newsletter e formulários a serviços aprovados.
7. Substituir placeholders por contactos e informação legal confirmados.
