# JENIOS — B75 Mobile / Hub / Interações (19/10/2026)

Base congelada e em produção: R45-B74 commit `3d9d499993b27f73f5d5a3a2ada341bfbcf6d731`.
Backup antes de editar: `backup/jenios-b74-pre-mobile-hub-b75-20261019`.
Branch isolada `fix/jenios-b75-mobile-social-hub-20261019`.

## Mobile (somente telas até 600px)
Barra lateral de ícones fixa com acesso por toque, texto em hover em dispositivos com mouse e expansão explícita para a lista completa.
Tela grande mantém o menu original. No smartphone, os botões redundantes de navegação são ocultados; feed aparece antes de ferramentas.
Menus de perfil, bloqueio, logout e edição respeitam autenticação e nunca contornam controles.

## Interações
A curtida de post usa atualização visual imediata, uma escrita remota e rollback se a escrita falhar. Contador desconhecido permanece desconhecido.
Resposta e comentário recém-confirmados pelo servidor são inseridos localmente sem rebaixar toda a thread; se o pai não existir, recarrega pelo endpoint original.
Curtida de comentário também evita refetch completo. Identidade do ticket de sessão é preservada; alteração de conta invalida operações pendentes.

## Hub
A Dashboard usa o mesmo hook `useTrendsData('/api/tendencias')` que alimenta a Social e o Hub oficial.
MegaPulse só exibe cotações verificadas com horário fresco; CoinGecko indica somente tendências de pesquisa.
Radar de Baleias usa transferências Bitcoin confirmadas ou três registros históricos qualificados, com data; jamais inventa compra institucional.
Tokens Explosivos continuam no componente NewTokenRadar e sua API original.

## Integridade e publicação
Todas as rotas de BankScore, Validador, JENIOS PAY, conta autenticada e núcleo dos robôs ficam intactas.
A alteração de segurança da CI adiciona allowlist somente dos arquivos de UI/performance autorizados e mantém o manifesto de dez APIs críticas imutável.
Sem merge ou deploy de produção antes da conclusão de CI, preview e novo backup.