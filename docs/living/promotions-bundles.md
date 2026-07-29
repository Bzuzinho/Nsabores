# Promoções, cupões, cabazes e personalização

Última revisão: 2026-07-29

## Estado

A Sprint 7 está em implementação direta em `main`.

Implementado até esta revisão:

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
- libertação de redemption quando a encomenda é cancelada;
- gestão inicial de promoções e cupões no management;
- modelo persistente de cabazes fixos/configuráveis;
- grupos de seleção e componentes;
- configuração de personalização de oferta;
- API pública de detalhe e cálculo de cabaz;
- API administrativa de cabazes.

## Motor de preços

O servidor resolve o contexto comercial do utilizador antes do cálculo:

- utilizador sem conta empresarial aprovada: `B2C`;
- utilizador associado a `BusinessAccount` aprovada: `B2B`;
- em B2B é considerada a `PriceList` atribuída quando existe.

A ordem de cálculo atual é:

```text
preço base / tabela de preços
→ promoções automáticas por prioridade
→ cupão aplicado
→ portes
→ desconto de portes quando aplicável
→ total final
```

A encomenda grava `subtotalCents`, `shippingCents`, `discountCents` e `totalCents` calculados no servidor. Cada desconto é preservado em `OrderDiscount`, incluindo tipo, valor, código e produtos elegíveis usados no cálculo.

### Percentagens

`benefitValue` usa percentagem inteira entre 0 e 100 para promoções `PERCENTAGE`.

Para `FIXED_AMOUNT` e `SPECIAL_PRICE`, os valores monetários são guardados em cêntimos.

`QUANTITY_DEAL` está reservado no enum, mas ainda não é aplicado pelo motor até existir uma definição explícita de quantidade comprada/paga. Não é aplicado silenciosamente.

## Cupões

Endpoints públicos do carrinho:

```text
POST   /v1/cart/coupon
DELETE /v1/cart/coupon
GET    /v1/cart
```

O código é normalizado em maiúsculas. São validados:

- estado da promoção;
- estado do cupão;
- datas;
- canal;
- mínimo de carrinho;
- limite total;
- limite por utilizador;
- limites da promoção.

Cupões com limite por utilizador exigem autenticação.

A utilização não é consumida por simples aplicação ao carrinho. O pagamento `PAID` cria `CouponRedemption` de forma idempotente através da lifecycle de base de dados. Uma encomenda cancelada liberta essa utilização.

## Management

Rotas disponíveis:

```text
/promocoes
/cupoes
```

A primeira versão permite:

- criar promoção;
- ativar/pausar promoção;
- definir tipo, valor, canal, prioridade e stacking;
- configurar limites gerais;
- criar cupão associado a uma promoção;
- configurar canal e limites do cupão;
- consultar promoções e cupões existentes.

A edição detalhada de alvos será expandida na continuação da sprint.

## Cabazes

A persistência suporta:

- `FIXED`;
- `CONFIGURABLE`;
- preço do produto principal (`PRODUCT_PRICE`);
- preço derivado dos componentes (`COMPONENT_TOTAL`);
- mínimo/máximo de escolhas;
- grupos de seleção;
- componentes obrigatórios/opcionais;
- mínimo/máximo por componente;
- diferença de preço por componente.

Endpoints públicos:

```text
GET  /v1/bundles/:slug
POST /v1/bundles/:slug/price
```

Endpoints de gestão:

```text
GET   /v1/admin/bundles
GET   /v1/admin/bundles/:id
POST  /v1/admin/bundles
PATCH /v1/admin/bundles/:id
```

O cálculo do cabaz é efetuado no servidor. O browser apenas envia escolhas e recebe a composição validada e o preço resultante.

## Personalização

A configuração por produto já suporta:

- mensagem de oferta;
- nome do destinatário;
- embalagem especial e respetivo custo;
- data pretendida;
- observações;
- packing slip sem preço;
- limites de tamanho de mensagem e observações.

Foram criadas estruturas de snapshot para carrinho e encomenda, mas a captura no carrinho ainda não está ligada ao frontend nesta revisão.

## Próximo sub-bloco

O modelo histórico de `CartItem` tem unicidade por `(cartId, productId)`. Isso impede colocar no mesmo carrinho duas configurações/personalizações diferentes do mesmo cabaz.

Antes de ativar `Adicionar ao carrinho` no personalizador, o próximo passo é introduzir uma chave de configuração na linha de carrinho, mantendo o comportamento `default` para produtos normais. Depois serão ligados:

1. composição ao carrinho;
2. snapshot de componentes/personalização na encomenda;
3. reserva de stock dos componentes reais;
4. página `/loja/cabazes/[slug]/personalizar`;
5. gestão visual de componentes/grupos no management.

Esta limitação é intencionalmente mantida visível para evitar um fluxo que pareça suportar múltiplas personalizações mas sobrescreva silenciosamente uma configuração anterior.
