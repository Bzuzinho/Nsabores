import Link from 'next/link';
export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <h1 className="text-5xl font-semibold">Sabores para revender</h1>
      <p className="mt-6 text-lg text-stone-600">
        Condições comerciais, preços profissionais e acompanhamento para lojas,
        garrafeiras e espaços gastronómicos.
      </p>
      <Link
        href="/revendedores/candidatura"
        className="mt-8 inline-block rounded bg-stone-900 px-6 py-3 text-white"
      >
        Quero ser revendedor
      </Link>
    </main>
  );
}
