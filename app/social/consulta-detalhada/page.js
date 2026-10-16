import { Suspense } from 'react';
import PaidCryptoReport from '../../components/PaidCryptoReport';

export default function DetailedConsultationPage() {
  return <Suspense fallback={<p>Preparando consulta…</p>}><PaidCryptoReport /></Suspense>;
}
