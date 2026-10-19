// Rota de compatibilidade: a seleção do modo agora é feita pelo laudo inicial.
// Não executa ordens e não altera o motor original.
import { redirect } from 'next/navigation';
export default function MesaOperacaoPage() {
  redirect('/mesa-operacoes');
}
