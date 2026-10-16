'use client';
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import BankscorePaidReport from '../../components/BankscorePaidReport';
function Content(){const params=useSearchParams();return <BankscorePaidReport orderId={params.get('pedido')||''} initialCodigo={params.get('codigo')||''} initialPeriodo={params.get('periodo')||''}/>;}
export default function Page(){return <main style={{background:'#f1f5f9',padding:24,minHeight:'100vh',fontFamily:'system-ui'}}><div style={{maxWidth:900,margin:'auto'}}><Link href="/social">← Voltar à Social</Link><Suspense fallback={<p>Carregando laudo…</p>}><Content/></Suspense></div></main>;}
