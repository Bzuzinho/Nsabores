import Link from 'next/link';

export default function OperationsPage() {
  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Operações</h1>
          <p>Preparação, expedições, devoluções e pós-venda.</p>
        </div>
      </header>
      <section className="user-detail">
        <p><Link href="/operacoes/preparacao">Preparação de encomendas</Link></p>
        <p><Link href="/expedicoes">Expedições e tracking</Link></p>
        <p><Link href="/devolucoes">Devoluções e RMA</Link></p>
        <p><Link href="/apoio">Pós-venda e incidências</Link></p>
      </section>
    </>
  );
}
