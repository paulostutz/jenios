# JENIOS R28 — diário inicial e coleta simulada

Data: 16/10/2026. Escopo exclusivo JENIOS Platform. Este é um checkpoint documental: os fontes permanecem no pacote privado em preparação, não na main.

## Base e publicação
Main conferida em 8bcdef507ee2774bc24f832e1d04608fde16aea9. Nova consulta à Vercel retornou 403 no escopo conhecido. Sem deploy, sem alterações de domínio, credenciais ou main.

## Implementação preparada
/diagnostico foi conectado a um motor de replay fictício no servidor; /platform/diario exibe os negócios e eventos. O ciclo inicial conta 15 operações ENCERRADAS, não respostas de questionário ou cliques. Intenção, preenchimento no próximo candle, cancelamento, saída, stop/alvo, custos hipotéticos e pausas são registrados. O cliente não fornece preço futuro, resultado ou identidade. A consulta é sempre por titular; início/novas entradas exigem plano vigente ou prévia administrativa. Histórico e redução de exposição simulada não são bloqueados por expiração da assinatura.

Eventos e estado possuem hashes em JSON canônico para resistir à reordenação de chaves do PostgreSQL jsonb. Gravação usa revisão concorrente e comandos idempotentes. Não se trata de trilha externamente inviolável.

A coleta termina em awaiting_methodology, SEM selecionar modo, liberar operação real ou conceder assinatura. Os parâmetros de SIM-J são escolhas explícitas de protótipo, não regras proprietárias aprovadas. O documento mestre exige implementação estrita da metodologia oficial; quinze negócios sintéticos não a substituem.

## Alteração efetiva no banco
Migração jenios_diagnostic_state_r28 aplicada: apenas public.jenios_diagnostic_state, com RLS, clientes diretos sem privilégios e serviço autorizado. Teste transacional real passou para FK, CAS, rejeição de revisão antiga/negativa, formato/tamanho, falso estado calibrated, conclusão prematura, 16 trades e acesso direto. ROLLBACK executado; consulta posterior confirmou zero registros. Nenhum dado de usuário, pagamento ou publicação foi alterado.

## Verificações até este ponto
486 testes da aplicação aprovados (77 novos) e 72 do núcleo privado. Build local concluído. 18 verificações HTTP locais passaram, incluindo fluxo de 15 fechamentos, recarga e isolamento entre duas identidades sintéticas. Os testes positivos HTTP usam autenticação e armazenamento simulados, não corretora ou conta real.

Navegação Chromium no loopback foi bloqueada com ERR_BLOCKED_BY_ADMINISTRATOR: E2E não aprovado nem restrição desativada. Advisor Supabase executado; INFO de tabela somente-serviço e alertas preexistentes documentados. A entrega final registrará pacote consolidado, manifesto, resultado final de build e demais limites.
