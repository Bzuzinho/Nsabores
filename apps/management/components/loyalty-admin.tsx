'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { managementApi } from './management-auth';

interface LoyaltyAccountRow {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  availablePoints: number;
  pendingPoints: number;
  reservedPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
}

interface LoyaltyRule {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  channel?: string | null;
  pointsPerEuro: number;
  clubMultiplierBasisPoints: number;
  minimumOrderCents?: number | null;
  maximumPointsPerOrder?: number | null;
  pendingDays: number;
}

interface GiftCard {
  id: string;
  codeLast4: string;
  status: string;
  initialAmountCents: number;
  balanceCents: number;
  reservedCents: number;
  currency: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  expiresAt?: string | null;
}

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(cents / 100);

export function LoyaltyAdmin({ mode }: { mode: 'dashboard' | 'rules' | 'giftCards' }) {
  const [accounts, setAccounts] = useState<LoyaltyAccountRow[]>([]);
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [search, setSearch] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [accountRows, ruleRows, cards] = await Promise.all([
        managementApi.get<LoyaltyAccountRow[]>(`/v1/admin/loyalty/accounts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        managementApi.get<LoyaltyRule[]>('/v1/admin/loyalty/rules'),
        managementApi.get<GiftCard[]>('/v1/admin/loyalty/gift-cards'),
      ]);
      setAccounts(accountRows);
      setRules(ruleRows);
      setGiftCards(cards);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a fidelização.');
    }
  }, [search]);

  useEffect(() => void load(), [load]);

  const metrics = useMemo(() => ({
    customers: accounts.length,
    available: accounts.reduce((sum, row) => sum + row.availablePoints, 0),
    pending: accounts.reduce((sum, row) => sum + row.pendingPoints, 0),
    giftLiability: giftCards.reduce((sum, row) => sum + row.balanceCents + row.reservedCents, 0),
  }), [accounts, giftCards]);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await managementApi.post('/v1/admin/loyalty/rules', {
        name: String(data.get('name')),
        code: String(data.get('code')),
        isActive: data.get('isActive') === 'on',
        channel: data.get('channel') || undefined,
        pointsPerEuro: Number(data.get('pointsPerEuro')),
        clubMultiplierBasisPoints: Number(data.get('clubMultiplierBasisPoints')),
        minimumOrderCents: data.get('minimumOrderCents') ? Number(data.get('minimumOrderCents')) : undefined,
        maximumPointsPerOrder: data.get('maximumPointsPerOrder') ? Number(data.get('maximumPointsPerOrder')) : undefined,
        pendingDays: Number(data.get('pendingDays')),
        configuration: {},
      });
      form.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a regra.');
    } finally {
      setBusy(false);
    }
  }

  async function issueGiftCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setIssuedCode('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await managementApi.post<GiftCard & { code: string }>('/v1/admin/loyalty/gift-cards', {
        initialAmountCents: Number(data.get('initialAmountCents')),
        recipientEmail: String(data.get('recipientEmail') || '') || undefined,
        recipientName: String(data.get('recipientName') || '') || undefined,
        message: String(data.get('message') || '') || undefined,
        expiresAt: String(data.get('expiresAt') || '') || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      setIssuedCode(result.code);
      form.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível emitir o vale.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="admin-header"><div><p className="eyebrow">Fidelização</p><h1>{mode === 'dashboard' ? 'Clientes e pontos' : mode === 'rules' ? 'Regras' : 'Vales-oferta'}</h1></div></header>
      {error && <p className="admin-error" role="alert">{error}</p>}

      {mode === 'dashboard' && <>
        <section className="user-detail"><h2>Resumo</h2><p>Clientes: <strong>{metrics.customers}</strong> · Pontos disponíveis: <strong>{metrics.available}</strong> · Pendentes: <strong>{metrics.pending}</strong></p><p>Responsabilidade em vales: <strong>{money(metrics.giftLiability)}</strong></p><p><Link href="/fidelizacao/regras">Gerir regras</Link> · <Link href="/vales-oferta">Gerir vales</Link></p></section>
        <section className="user-detail">
          <h2>Clientes</h2>
          <form onSubmit={(event) => { event.preventDefault(); void load(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou email" /><button>Pesquisar</button></form>
          {!accounts.length && <p>Sem contas de fidelização.</p>}
          {accounts.map((row) => <article key={row.id}><p><strong>{row.firstName} {row.lastName}</strong> · {row.email}</p><p>Disponíveis: {row.availablePoints} · Pendentes: {row.pendingPoints} · Reservados: {row.reservedPoints}</p><Link href={`/fidelizacao/clientes/${row.userId}`}>Ver ledger</Link></article>)}
        </section>
      </>}

      {mode === 'rules' && <>
        <section className="user-detail"><h2>Nova regra</h2><form className="auth-form" onSubmit={createRule}>
          <label>Nome<input name="name" required /></label><label>Código<input name="code" required /></label>
          <label>Canal<select name="channel" defaultValue=""><option value="">Todos</option><option value="B2C">B2C</option><option value="B2B">B2B</option></select></label>
          <label>Pontos por euro<input name="pointsPerEuro" type="number" min="0" defaultValue="1" required /></label>
          <label>Multiplicador Clube (basis points)<input name="clubMultiplierBasisPoints" type="number" min="0" defaultValue="10000" required /></label>
          <label>Compra mínima (cêntimos)<input name="minimumOrderCents" type="number" min="0" /></label>
          <label>Máximo por encomenda<input name="maximumPointsPerOrder" type="number" min="0" /></label>
          <label>Dias pendentes<input name="pendingDays" type="number" min="0" defaultValue="14" required /></label>
          <label><input name="isActive" type="checkbox" defaultChecked /> Ativa</label><button className="admin-primary" disabled={busy}>Criar regra</button>
        </form></section>
        <section className="user-detail"><h2>Regras existentes</h2>{rules.map((rule) => <article key={rule.id}><p><strong>{rule.name}</strong> · {rule.code} · {rule.isActive ? 'Ativa' : 'Inativa'}</p><p>{rule.pointsPerEuro} ponto(s)/€ · Clube {rule.clubMultiplierBasisPoints / 100}% · pendência {rule.pendingDays} dias</p></article>)}</section>
      </>}

      {mode === 'giftCards' && <>
        <section className="user-detail"><h2>Emitir vale</h2><form className="auth-form" onSubmit={issueGiftCard}>
          <label>Valor (cêntimos)<input name="initialAmountCents" type="number" min="100" required /></label>
          <label>Email destinatário<input name="recipientEmail" type="email" /></label><label>Nome destinatário<input name="recipientName" /></label>
          <label>Mensagem<textarea name="message" maxLength={500} /></label><label>Validade<input name="expiresAt" type="date" /></label>
          <button className="admin-primary" disabled={busy}>Emitir vale</button>
        </form>{issuedCode && <p role="status"><strong>Código emitido: {issuedCode}</strong><br /><small>Este código completo só é apresentado agora. Guarde-o e entregue-o ao destinatário.</small></p>}</section>
        <section className="user-detail"><h2>Vales</h2>{giftCards.map((card) => <article key={card.id}><p><strong>•••• {card.codeLast4}</strong> · {card.status}</p><p>Saldo {money(card.balanceCents, card.currency)} · reservado {money(card.reservedCents, card.currency)}</p><Link href={`/vales-oferta/${card.id}`}>Detalhe e movimentos</Link></article>)}</section>
      </>}
    </>
  );
}
