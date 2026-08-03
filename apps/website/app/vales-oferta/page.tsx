import Link from 'next/link';

export default function GiftCardsPage() {
  return (
    <main id="conteudo" className="account-page">
      <section className="account-card">
        <p className="eyebrow">Vales-oferta Nsabores</p>
        <h1>Ofereça sabores, escolha e liberdade.</h1>
        <p>
          Escolha o montante, indique o destinatário e conclua o pagamento. O
          vale fica disponível apenas depois da confirmação do pagamento.
        </p>
        <p>
          <Link className="button button-primary" href="/vales-oferta/comprar">
            Comprar vale-oferta
          </Link>{' '}
          <Link className="button" href="/vales-oferta/consultar">
            Consultar saldo
          </Link>
        </p>
      </section>
    </main>
  );
}
