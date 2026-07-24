import Link from 'next/link';

export default function CheckoutErrorPage() {
  return (
    <main id="conteudo" className="account-page">
      <section className="account-card">
        <p className="eyebrow">Pagamento</p>
        <h1>Não foi possível concluir</h1>
        <p>
          A encomenda mantém-se pendente e pode repetir o pagamento em
          segurança.
        </p>
        <Link href="/checkout">Tentar novamente</Link>
      </section>
    </main>
  );
}
