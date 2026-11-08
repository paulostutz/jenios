'use client';
import Link from 'next/link';
import LetterBilling from '../checkout/LetterBilling';
export default function BillingPage(){return <main style={{minHeight:'100vh',background:'#f4f3fa',padding:'30px 16px',fontFamily:'system-ui',color:'#172033'}}><div style={{maxWidth:960,margin:'auto'}}><Link href="/dashboard-logado">← Minha conta</Link><h1>Minha assinatura e cobranças</h1><p>Consulte os registros confirmados da sua conta. Não há renovação paga automática.</p><LetterBilling/><Link href="/checkout">Consultar planos da Platform e pagamentos anteriores</Link><p><Link href="/universidade">Consultar minha assinatura da Universidade</Link></p></div></main>;}
