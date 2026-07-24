import type { Metadata } from 'next';
import { ProductShowcase } from '@/components/product-showcase';

export const metadata: Metadata = {
  title: 'Loja',
  description:
    'Explore a seleção demonstrativa de tábuas, queijos, cabazes e vinhos Nsabores.',
};

export default function StorePage() {
  return (
    <main id="conteudo">
      <header className="store-hero">
        <p className="eyebrow">Loja Nsabores</p>
        <h1>Uma seleção pequena no tamanho. Grande no sabor.</h1>
        <p>
          Produtos de demonstração escolhidos para mostrar como será a futura
          experiência de compra Nsabores.
        </p>
      </header>
      <ProductShowcase />
      <aside className="store-note">
        <strong>Catálogo em preparação</strong>
        <p>
          Preços, disponibilidade e compra são demonstrativos. Ainda não
          aceitamos encomendas ou pagamentos através do website.
        </p>
      </aside>
    </main>
  );
}
