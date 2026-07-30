import { GiftCardPurchaseSuccess } from '../../../components/gift-card-purchase-success';

export default async function GiftCardPurchaseSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ purchaseId?: string; paymentId?: string }>;
}) {
  const params = await searchParams;
  if (!params.purchaseId || !params.paymentId) {
    return (
      <main id="conteudo" className="account-page">
        <section className="account-card">
          <p>Referência de compra inválida.</p>
        </section>
      </main>
    );
  }
  return (
    <main id="conteudo" className="account-page">
      <GiftCardPurchaseSuccess
        purchaseId={params.purchaseId}
        paymentId={params.paymentId}
      />
    </main>
  );
}
