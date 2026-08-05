# Remediação dos fluxos funcionais — 2026-08-05

## Objetivo

Esta intervenção fecha os percursos funcionais identificados na auditoria integral, privilegiando a coerência entre módulos em vez da existência isolada de páginas ou endpoints.

## Fluxos implementados

- Encomendas administrativas com rascunho, edição, submissão, aprovação e rejeição.
- Pedidos B2B multialínea com entrega, condições comerciais, aprovação, reserva e recebível.
- Confirmação de pagamento sincronizada com encomenda e recebível.
- Reembolso executado pelo provider antes de o sistema declarar sucesso.
- Reserva, expedição, devolução e substituição de cabazes sobre os componentes físicos.
- Expedições limitadas ao estado operacional correto, com eventos e transições auditáveis.
- Apoio persistente, acessível ao cliente e à Gestão, incluindo pedidos de contacto.
- Newsletter com consentimento, persistência e gestão administrativa.
- Edição de compras em rascunho e saídas manuais completas no Clube.
- Edição e precedência temporal das regras de fidelização, com validade efetiva dos pontos.
- Gestão administrativa de vales, convites de utilizadores, métodos de entrega e moradas.

## Regras de integridade

- Stock só é reservado quando a encomenda entra no circuito operacional.
- Uma expedição consome a reserva da linha ou dos componentes efetivamente expedidos.
- Uma devolução repõe os mesmos componentes físicos que saíram.
- Estados financeiros só avançam depois da operação correspondente ser aceite.
- Respostas públicas de apoio ficam visíveis ao cliente; notas internas não ficam.
- Operações de histórico usam cancelamento, arquivo ou transição de estado em vez de eliminação destrutiva.

## Dependências externas

O código suporta providers configuráveis, mas a operação real continua dependente das credenciais e contratos de produção para pagamentos digitais e recorrentes, transportadora, faturação certificada e Outlook/OAuth.

## Verificação

Foram executados Prisma generate/validate, formatação, lint, TypeScript, testes automatizados e builds de produção da API, website e Gestão.
