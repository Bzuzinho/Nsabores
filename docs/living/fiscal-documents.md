# Documentos comerciais e integração fiscal

Última revisão: 2026-07-31

## Estado

A Sprint 11 introduz um registo documental interno e auditável para encomendas, vales-oferta e cobranças do Clube.

Este módulo não declara certificação fiscal. Serve para:

- garantir idempotência e rastreabilidade;
- preservar snapshots comerciais;
- preparar integração futura com software certificado;
- associar pagamentos confirmados a documentos comerciais;
- registar documentos externos emitidos por um sistema certificado.

## Momento de emissão

Uma origem só pode gerar documento depois da confirmação financeira:

- encomenda com `paymentStatus = PAID`;
- vale-oferta com `GiftCardPurchase.status = PAID`;
- Clube com `ClubSubscriptionCharge.status = PAID`.

Produção, preparação e expedição continuam independentes da emissão documental.

## Tipos e estados

Tipos suportados:

- `INVOICE`;
- `INVOICE_RECEIPT`;
- `RECEIPT`;
- `CREDIT_NOTE`;
- `PROFORMA`.

Estados:

- `DRAFT`;
- `ISSUED`;
- `CANCELLED`;
- `CREDITED`;
- `FAILED`.

## Séries e numeração

Cada tipo documental utiliza uma série anual. A emissão seleciona ou cria a série, incrementa `nextNumber` na mesma transação e cria documento, linhas e eventos com isolamento `SERIALIZABLE`.

Exemplo:

```text
FR 2026/000001
FR 2026/000002
NC 2026/000001
```

A constraint `(seriesId, sequentialNumber)` impede duplicações.

## Idempotência

A emissão comercial usa unicidade por:

```text
sourceType + sourceId + documentType
```

Notas de crédito usam `idempotencyKey` própria, permitindo várias notas parciais sem repetir a mesma operação.

## Snapshots

Após emissão, o documento preserva:

- identificação e contacto do cliente;
- morada de faturação quando disponível;
- moeda;
- subtotal, descontos, imposto e total;
- linhas, quantidades, preços e SKU;
- origem comercial;
- data e autor da emissão.

Alterações posteriores no catálogo, encomenda, subscrição ou perfil não alteram o documento emitido.

## Notas de crédito

São suportadas notas de crédito totais e parciais.

O fluxo:

1. calcula as quantidades já creditadas por linha;
2. impede crédito superior ao saldo disponível;
3. emite uma nova nota na série `NC`;
4. preserva o documento original;
5. marca o original como `CREDITED` apenas quando o valor total ficou creditado;
6. grava eventos auditáveis em ambos os documentos.

## Providers

A variável operacional é:

```text
FISCAL_PROVIDER=manual|mock
```

Sem configuração explícita, o sistema usa `manual`.

### Manual

Permite registar:

- número externo;
- URL do documento;
- referência do provider.

O registo não finge certificação. Serve para associar ao registo interno um documento emitido noutro sistema.

Um documento em `FAILED` pode ser reprocessado manualmente. A operação limpa `providerError`, regressa a `ISSUED` e grava `REPROCESSED`.

### Mock

Usado para desenvolvimento e testes. Permite:

- processamento determinístico com referência mock;
- falha simulada, que coloca o documento em `FAILED`;
- reprocessamento posterior com sucesso;
- eventos `PROVIDER_FAILED` e `REPROCESSED`.

O mock não é um provider fiscal certificado.

## Management

Rotas:

```text
/documentos
/documentos/[id]
/documentos/[id]/nota-credito
```

O detalhe inclui o painel do provider, número externo, URL, erro atual e ações de processamento/reprocessamento.

Endpoints principais:

```text
GET  /v1/admin/fiscal/documents
GET  /v1/admin/fiscal/documents/:id
GET  /v1/admin/fiscal/provider
POST /v1/admin/fiscal/orders/:orderId/issue
POST /v1/admin/fiscal/gift-card-purchases/:purchaseId/issue
POST /v1/admin/fiscal/club-charges/:chargeId/issue
POST /v1/admin/fiscal/documents/:id/provider/manual
POST /v1/admin/fiscal/documents/:id/provider/mock
POST /v1/admin/fiscal/documents/:id/credit-notes
```

Acesso limitado a `STAFF` e `ADMIN`.

## Cliente

Rotas:

```text
/conta/documentos
/conta/documentos/[id]
```

A conta mostra apenas documentos cujo `customerUserId` corresponde ao utilizador autenticado.

Não são expostos erros do provider, notas internas, eventos administrativos ou referências de outros clientes.

## Validação obrigatória

A CI PostgreSQL executa:

```text
validate:fiscal
validate:fiscal-sources
validate:fiscal-provider
```

Os smokes cobrem emissão, numeração, idempotência, notas de crédito, origens de vale/Clube, falha do provider e reprocessamento.

## Limitações legais

A representação atual:

- não é declarada como fatura certificada;
- não substitui um documento emitido por software homologado;
- não implementa assinatura fiscal, hash legal ou comunicação à AT;
- não produz ainda SAF-T certificado.

Uma futura integração certificada deve implementar o contrato de provider sem alterar snapshots históricos nem a numeração interna já atribuída.

## Próximos passos

- representação PDF não certificada;
- exportação CSV e preparação SAF-T;
- configuração administrativa de séries;
- pesquisa de pagamentos sem documento e documentos sem pagamento;
- provider certificado futuro.
