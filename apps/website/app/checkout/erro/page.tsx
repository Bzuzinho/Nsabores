import Link from 'next/link';

export default function CheckoutErrorPage() {
  return (
    <main id="conteudo" className="account-page">
      <section className="account-card">
        <p className="eyebrow">Encomenda</p>
        <h1>Não foi possível concluir</h1>
        <p>
          Não foi possível concluir o registo da encomenda. Reveja os dados e
          tente novamente.
        </p>
        <Link href="/checkout">Voltar ao checkout</Link>
      </section>
    </main>
  );
}
