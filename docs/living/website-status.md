# Estado vivo do website

**Última revisão:** 2026-08-05

**Responsável:** equipa Nsabores

## Páginas e integrações

- `/`: homepage ligada ao catálogo da API, com hero compacto;
- `/loja`: catálogo real, pesquisa, filtros e estado de carregamento visual;
- `/sobre`, `/servicos` e `/eventos`: páginas editoriais responsivas com hero
  compacto;
- `/blog` e `/blog/[slug]`: listagem e leitura dos artigos publicados na API;
- `/contactos`: hero fotográfico e formulário entregue ao serviço de email;
- `/clube`, `/vales-oferta`, carrinho, checkout e acompanhamento: fluxos
  funcionais ligados à API;
- `/conta`: área autenticada com encomendas, documentos, moradas, Clube,
  fidelização e área profissional diferenciada entre particular, revendedor e
  B2B;
- `/receitas`: redirecionamento de compatibilidade para `/blog`.

O acesso à Gestão está no canto inferior direito do rodapé. O cabeçalho deixou
de apresentar esse atalho.

## Conteúdo e contacto

Os artigos são persistidos como rascunho ou publicação e geridos em
`/gestao/blog`. O website público mostra apenas artigos publicados cuja data de
publicação já chegou.

O formulário de contacto valida consentimento, limita o ritmo de submissões,
usa um campo honeypot e envia a mensagem para `CONTACT_RECIPIENT_EMAIL`. A
resposta é dirigida ao email do visitante através de `replyTo`.

## Configuração operacional obrigatória

- executar a migration Prisma de agosto antes de arrancar a nova versão;
- configurar `API_ORIGIN` no serviço website com a origem pública da API;
- configurar `CONTACT_RECIPIENT_EMAIL`;
- manter `MAIL_PROVIDER=outlook-graph` e as credenciais Outlook válidas para
  envio real. Sem essa configuração, o provider mantém o comportamento seguro
  de registo em log.

## Limitações conhecidas

- o blog inicia vazio até existir pelo menos um artigo publicado;
- redes sociais e dados jurídicos finais continuam dependentes de informação
  oficial da empresa;
- os identificadores visuais dos meios de pagamento no rodapé não são logótipos
  oficiais;
- a newsletter valida e confirma no frontend, mas ainda não está ligada a uma
  lista externa aprovada.
