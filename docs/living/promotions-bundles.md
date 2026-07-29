# Promoções, cupões, cabazes e personalização

Última revisão: 2026-07-29

## Estado

A Sprint 7 está em implementação direta em `main`.

Implementado nesta fase:

- persistência de promoções, alvos, cupões e snapshots de desconto;
- cálculo promocional no servidor;
- aplicação e remoção de cupão no carrinho;
- descontos discriminados no carrinho e checkout;
- integração com B2C/B2B e `PriceList`;
- limites globais e por cliente/empresa;
- stacking por prioridade;
- percentagem, valor fixo, preço especial e portes grátis;
- snapshot imutável de descontos em `OrderDiscount`;
- `CouponRedemption` apenas após pagamento `PAID`;
- gestão de promoções e cupões no management;
- cabazes fixos e configuráveis;
- grupos de seleção e componentes;
- personalização de oferta;
- múltiplas configurações do mesmo produto no carrinho através de `configurationKey`;
- personalizador no website;
- gestão inicial de cabazes em `/cabazes`;
- snapshot de composição/personalização na encomenda;
- reserva de stock sobre componentes reais do cabaz.

## Motor de preços

O servidor resolve o contexto comercial antes do cálculo:

- utilizador sem conta empresarial aprovada: `B2C`;
- utilizador associado a `BusinessAccount` aprovada: `B2B`;
- em B2B é considerada a `PriceList` atribuída quando existe.

A ordem é:

```text
preço base / tabela de preços
→ preço configurado do cabaz quando aplicável
→ promoções automáticas
→ cupão
→ portes
→ desconto de portes
→ total final
```

A encomenda grava os valores finais em cêntimos. Cada desconto é preservado em `OrderDiscount` para impedir que alterações posteriores à campanha mudem encomendas históricas.

`QUANTITY_DEAL` permanece reservado no enum, mas ainda não executa uma regra X/Y enquanto essa regra não estiver explicitamente configurada.

## Cupões

Endpoints:

```text
POST   /v1/cart/coupon
DELETE /v1/cart/coupon
GET    /v1/cart
```

O código é normalizado em maiúsculas. São validados estado, datas, canal, mínimo de carrinho e limites de utilização.

A aplicação ao carrinho não consome a utilização. O consumo é auditado por `CouponRedemption` quando o pagamento atinge `PAID`, de forma idempotente.

## Cabazes

Um `ProductBundle` usa um produto normal como produto comercial principal. Os componentes continuam produtos do catálogo e podem continuar vendáveis isoladamente.

Modos:

- `FIXED`: composição definida administrativamente;
- `CONFIGURABLE`: o cliente escolhe opções respeitando mínimos/máximos globais e por grupo.

Preço:

- `PRODUCT_PRICE`: preço do produto principal + diferenças de seleção + personalização paga;
- `COMPONENT_TOTAL`: soma dos componentes + diferenças + personalização paga.

O browser pode pré-visualizar por:

```text
GET  /v1/bundles/:slug
POST /v1/bundles/:slug/price
```

A inclusão no carrinho é feita por:

```text
POST /v1/cart/bundles/:slug
```

O preço e a composição são recalculados no servidor nessa operação.

## Múltiplas configurações no carrinho

`CartItem.configurationKey` distingue configurações do mesmo produto:

- produto normal: `default`;
- cabaz configurado: hash SHA-256 da composição e personalização normalizadas.

Assim o mesmo cabaz pode existir simultaneamente no carrinho com destinatários, mensagens ou componentes diferentes sem uma configuração substituir a outra.

`CartItemBundleSelection` preserva os componentes da linha e `CartItemPersonalization` preserva os dados de oferta.

O merge visitante → conta mantém `configurationKey`, composição e personalização.

## Personalização

A configuração administrativa pode ativar:

- mensagem/cartão;
- nome do destinatário;
- embalagem especial e custo adicional;
- data pretendida;
- observações;
- packing slip sem valores.

O backend valida cada campo e os limites máximos antes de persistir.

## Checkout e snapshots

O checkout passa pela camada `BundleAwareCommerceService`.

Cada linha configurada cria um `OrderItem` independente. Mesmo que duas linhas usem o mesmo produto principal, permanecem distintas.

São congelados:

- componentes em `OrderItemBundleSelection`;
- nome e SKU do componente;
- quantidade;
- diferença de preço;
- personalização em `OrderItemPersonalization`;
- custo extra de personalização.

Alterações futuras ao catálogo ou ao cabaz não mudam a encomenda histórica.

## Promoções sobre cabazes

O preço efetivo da configuração entra no subtotal.

Os extras de configuração/personalização não podem aumentar artificialmente um desconto que já tinha sido calculado sobre o produto base. A camada bundle-aware recalcula quando o preço efetivo é inferior, mas limita o desconto ao valor originalmente obtido pelo motor promocional quando o preço configurado é superior.

Isto evita criar desconto adicional apenas por escolher embalagem especial ou componentes mais caros.

## Stock

Ao adicionar ao carrinho, a API verifica disponibilidade dos componentes monitorizados.

No checkout, a necessidade de stock é calculada por produto real:

- linha normal → produto da linha;
- cabaz → componentes do snapshot × quantidade do cabaz.

Se o mesmo componente aparecer várias vezes na encomenda, as necessidades são agregadas e é criada uma única `StockReservation` por produto/encomenda.

`releaseOrder` e `fulfillOrder` continuam compatíveis porque trabalham sobre as reservas já criadas, independentemente da origem ser produto normal ou componente de cabaz.

## Management

Rotas:

```text
/promocoes
/cupoes
/cabazes
```

A gestão de cabazes permite atualmente criar produto principal, modo, regra de preço, componentes e opções básicas de personalização. A edição avançada de grupos e um editor de detalhe dedicado continuam por melhorar.

## Website

Produtos com cabaz ativo apresentam `Personalizar cabaz`.

O fluxo está em:

```text
/loja/cabazes/[slug]/personalizar
```

O utilizador escolhe componentes, personalização e quantidade; o preço é recalculado pela API antes de permitir adicionar ao carrinho.

## Migrações

As migrations da Sprint 7 são deliberadamente explícitas. O `start:prod` não executa migrations automaticamente.

Antes de testar as funcionalidades numa base que ainda não recebeu estas migrations:

```bash
pnpm --filter @nsabores/api prisma:migrate:deploy
```

## Próximos passos antes de fechar a Sprint 7

- executar as migrations e seed numa base limpa;
- smoke test real: promoção → cupão → cabaz configurado → checkout → reserva → expedição;
- testar duas configurações diferentes do mesmo cabaz no mesmo carrinho;
- testes automatizados de concorrência/limites de cupão;
- testes de snapshot e stock de componentes;
- implementar `QUANTITY_DEAL` X/Y;
- melhorar edição de grupos no management;
- sincronizar os modelos SQL das Sprints 6/7 no `schema.prisma` para reduzir drift futuro;
- validar todos os quality gates antes de encerrar a issue #25.
