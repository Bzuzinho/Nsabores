import type { ReactNode } from 'react';

export interface ServiceShellProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
}

export function ServiceShell({ children, eyebrow, title }: ServiceShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-stone-50">
      <section className="w-full max-w-3xl rounded-3xl border border-amber-200/20 bg-stone-900 p-10 shadow-2xl">
        <p className="mb-3 text-sm font-semibold tracking-[0.3em] text-amber-300 uppercase">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          {title}
        </h1>
        <div className="mt-6 max-w-xl text-lg leading-8 text-stone-300">
          {children}
        </div>
      </section>
    </main>
  );
}
