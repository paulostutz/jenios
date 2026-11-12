# JENIOS R93 — coordenação privada de recuperação sem ordens
Data: 27/10/2026. Desenvolvimento PR #22 DRAFT.

## Backups realmente consultados
- Biblioteca privada: B152 (ledger), B165–B169 (cofre e conexão), B171–B173 (normalização de ordens), R74 (núcleo sintético). Sem reconstruir.
- GitHub R92 base abddbd883e812e6f584d571c8e956b60c2cfa7b6, Vercel JENIOS Preview dpl_43mLpdATHL3F34v8NVFPqD6Rs5dT READY.
- Produção R79 a24922cc829dd1b45b87a719e9fd57ab45e6d79b mantida; nenhuma operação financeira acionada.
- Supabase Platform dedicado: 0 contas conectadas, 0 autorizações Paper R79, 0 safety R80, 0 cofre Live R83.

## Bloco implementado
- paper-private-coordinator-r93.mjs: composição PRIVADA Node de componentes existentes B152/B165/B167/B175/R80; não é servidor, cron, API nem executor.
- Validação do dono via Supabase Auth, e-mail confirmado, conexão Paper Alpaca ativa, digest vinculado, leitura recente, diagnóstico próprio do servidor e safety R80.
- Inventário obtido do ledger SQLite real, até 30 ordens; usa cofre somente quando há estado pendente.
- Recuperação somente leitura via GET do B176/R80; não faz POST, não cancela nem retransmite; UNKNOWN mantém risco reservado e exige revisão.
- Flag de isolamento web S05 ampliada: duas flags do coordenador R93 obrigatoriamente false no Preview da branch. Variáveis da Vercel configuradas false e nenhum segredo adicionado.
- Testes offline de owner/tenant, reinício, ACK simulado, UNKNOWN, cofre, recusas de env Live, erros, respostas sem segredos; CI integrada na suíte privada.

## Limites
Nenhum worker externo foi implantado. A assinatura do callback verifyDiagnostic deve vir de serviço confiável, não de navegador. O host Node futuro requer volume durável, cofre e credenciais somente no servidor, observabilidade, recuperação e avaliação independente. Não há conta Alpaca/Binance real de demonstração conectada nem recibo oficial. É proibido habilitar Live ou cobrar por este avanço.
Conservar PR Draft e rollback R79 até CI e Preview do SHA exato. CHEFE/LETTER, Social, PAY, R74 privado e app nativo intocados.