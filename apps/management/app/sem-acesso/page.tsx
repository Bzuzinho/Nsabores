'use client';

import { useRouter } from 'next/navigation';
import { useManagementAuth } from '@/components/management-auth';

export default function ForbiddenPage() {
  const auth = useManagementAuth();
  const router = useRouter();
  return (
    <main className="management-login">
      <div>
        <h1>Sem acesso</h1>
        <p>Esta aplicação está reservada à equipa Nsabores.</p>
        <button
          className="admin-primary"
          onClick={() => void auth.logout().then(() => router.push('/login'))}
        >
          Terminar sessão
        </button>
      </div>
    </main>
  );
}
