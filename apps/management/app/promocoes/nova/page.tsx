import Link from 'next/link';
import { PromotionsAdmin } from '../../../components/promotions-admin';

export default function NewPromotionPage() {
  return (
    <>
      <p>
        <Link href="/promocoes">Voltar às promoções</Link>
      </p>
      <PromotionsAdmin />
    </>
  );
}
