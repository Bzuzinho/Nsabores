# Identity V2 migration audit — first pass

Status: additive schema and SQL migration only. Do not enable V2 reads/writes or run against production before rehearsal. Legacy models remain authoritative until cutover; Party is not a second operational registry.

## Dependency inventory (schema.prisma)
- User: sessions, addresses, carts, orders, stock/purchase/inventory authors, business memberships, approval, returns, support, coupon redemptions, content and upload authors.
- Customer: orders and addresses, optional unique User link. Preserve unlinked/manual records, including companies.
- BusinessAccount: memberships, price list, orders, support cases, promotion targets, coupon redemptions, manager. Preserve memberships, statuses and prices.
- Order: existing userId, customerId, businessAccountId, priceListId and snapshots; future partyId identifies commercial owner, createdByUserId identifies actor. Do not assume legacy userId is actor for manually created orders.
- Cart: unique userId/status today, requires context-specific ownership and uniqueness before switching contexts.
- Address: legacy userId/customerId; migrate ownership without exposing company addresses in personal contexts.
- ResellerApplication: separate pending workflow with historical decision data, company details and optional businessAccountId. Resolve ownership explicitly; do not auto-approve.
- CustomerProfile: tax number, consent, notes; reconcile conflicts with Customer explicitly.

## Backfill rules
Create reviewed mapping from legacy User/Customer/BusinessAccount IDs to Party IDs. Explicit existing personal relationships may be reused after checking identity type and conflicts. A linked company customer does not prove the person owns the company; membership requires evidence. Never merge by email or NIF alone. Quarantine duplicate normalized identifiers and inconsistent contacts, inactive/deleted states or role mismatches; preserve audit trail. Do not reactivate accounts or grant new rights from inferred matches. Separate commercial owner from actor. Preserve original snapshots and order totals. Reconcile financial and stock totals before cutover.

## Next development
1. Add read-only reconciliation report with counts and conflict categories; run on restored isolated database.
2. Add context authorization policy and tests, deny by default; owner/representative checks on every API request. Enforce membership only for organizations, approved reseller implies client, active membership and approved context before prices.
3. Integrate safe registration, verification and duplicate handling; review all legacy auto-link paths (register, updateProfile, verifyEmail).
4. Implement unified administration and contextual commerce reads/writes with a controlled cutover. Remove legacy redundant fields only after migration verification.
5. Validate Prisma schema, generated client, SQL migration and rollback/rehearsal. No CI result yet; no production change.

## Known limitations
Current migration adds empty tables only. No backfill, authorization service, API, UI, context selection, order ownership migration or registration 409 fix yet. SQL CHECK constraints enforce personal credentials, reseller status shape and commercial numeric ranges; cross-table invariants still require transactional services and tests. Tax number index deliberately nonunique until legacy normalization/reconciliation is validated. Legacy mapping columns are temporary and must be removed after cutover.
