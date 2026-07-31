# Documentos comerciais e integração fiscal

Última revisão: 2026-07-31

## Estado

A Sprint 11 introduz um registo documental interno e auditável para encomendas e, progressivamente, para vales-oferta e cobranças do Clube.

Este módulo não declara certificação fiscal. O modo atual é `manual` e serve para:

- garantir idempotência e rastreabilidade;
- preservar snapshots comerciais;
- preparar integração futura com software certificado;
- associar pagamentos confirmados a documentos comerciais.

## Momento de emissão

Uma encomenda só pode originar um documento depois de o pagamento estar confirmado com `paymentStatus = PAID`.

Produção, preparação e expedição continuam independentes da emissão documental.

Fluxo atual:

```text
Encomenda criada
→ produção pode avançar
→ pagamento confirmado
→ emissão documental autorizada
→ snapshot imutável
```

## Tipos

Tipos suportados pelo modelo:

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

Cada tipo documental utiliza uma série anual.

A emissão:

1. seleciona ou cria a série;
2. incrementa `nextNumber` na mesma transação;
3. atribui o número sequencial;
4. cria o documento, linhas e eventos;
5. confirma a transação.

Exemplo:

```text
FR 2026/000001
FR 2026/000002
```

A constraint `(seriesId, sequentialNumber)` impede duplicações. A emissão é executada com isolamento `SERIALIZABLE`.

## Idempotência

Existe unicidade por:

```text
sourceType + sourceId + documentType
```

Repetir uma emissão para a mesma origem e tipo devolve o documento existente e não consome um novo número.

## Snapshots

Após emissão, o documento preserva:

- identificação e contacto do cliente;
- morada de faturação;
- moeda;
- subtotal, descontos, imposto e total;
- linhas, quantidades, preços e SKU;
- origem comercial;
- data e autor da emissão.

Alterações posteriores na encomenda, catálogo ou perfil do cliente não alteram o documento emitido.

## Management

Rotas:

```text
/documentos
/documentos/[id]
```

Permitem:

- listar e filtrar documentos;
- emitir um documento a partir de uma encomenda paga;
- consultar série, snapshots, linhas e eventos;
- identificar claramente o provider `manual`;
- distinguir a representação interna de faturação certificada.

Endpoints:

```text
GET  /v1/admin/fiscal/documents
GET  /v1/admin/fiscal/documents/:id
POST /v1/admin/fiscal/orders/:orderId/issue
```

Acesso limitado a `STAFF` e `ADMIN`.

## Cliente

Rotas:

```text
/conta/documentos
/conta/documentos/[id]
```

A conta mostra apenas documentos cujo `customerUserId` corresponde ao utilizador autenticado.

Não são expostos:

- erros do provider;
- notas internas;
- eventos administrativos;
- referências de outros clientes.

## Limitações legais

O provider atual é manual. A representação HTML disponibilizada no management e na conta:

- não é declarada como fatura certificada;
- não substitui um documento emitido por software homologado;
- não implementa assinatura fiscal, hash legal ou comunicação à AT;
- não produz ainda SAF-T certificado.

Uma futura integração certificada deve implementar `FiscalProvider` sem alterar os snapshots históricos nem a numeração interna já atribuída.

## Próximos passos

- notas de crédito totais e parciais;
- documentos para vales-oferta;
- documentos para cobranças do Clube;
- registo manual de número externo e URL/ficheiro;
- reprocessamento de falhas;
- representação PDF não certificada;
- exportação CSV e preparação SAF-T;
- configuração administrativa de séries e provider.
