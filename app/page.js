'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/lp'); // Redireciona direto para a Landing Page do ecossistema
  }, [router]);

  return (
    <main style={{ backgroundColor: '#090d16', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial' }}>
      <h2>Carregando JENIOS Ecossistema HFT...</h2>
    </main>
  );
}