# S04 — o que ainda impede 65% e o próximo deploy de produção

## Status desta entrega

- O S04 é uma **prévia não promocionável**. `jenios.com.br` permanece no S02.
- Os progressos técnicos ficam separados de validação jurídica, financeira, banco real e E2E.
- Sem migração de produção, sem novos recursos com custo, sem checkout, sem robô de investimento em produção.

## Gate 1 — Supabase staging isolado (pendente)

Não há branch de desenvolvimento do projeto Supabase (`jenios-social`) na consulta de metadados de 17/10/2026.
Será necessária a autorização sobre eventual custo e o fornecimento/acesso a um projeto de homologação.
Sequência: aplicar em staging a proposta S03 de identidade e fila; executar pré-condições; ensaiar contas sintéticas e concorrência real; aplicar proposta S04 de reabertura/auditoria; testar rollback, RLS e isolamento; registrar evidências.
**Não executar esses testes no banco ativo.**

## Gate 2 — 7 dias por pessoa (pendente)

O endpoint S04 integra o contrato de verificação por HTTPS, HMAC por CPF verificado e RPC atômica, mas fica desabilitado por padrão. Antes de lançar: contratar/autorizar um provedor de identificação, validar vinculação da prova à sessão atual e custo, proteção de abuso/cotas, governança LGPD e retenção do digest, e ensaiar no staging.
O ledger de trial não altera subscriptions e nem entitlements pagos. Isso ainda precisa de solução e homologação próprias, sem cobrar automaticamente após 168 horas.

## Gate 3 — exclusão efetiva (pendente)

Solicitação, cancelamento e reabertura estão preparados para staging. Não existe eliminação automática implementada, porque posts, mídias, relações, pagamentos, suporte e trilhas legais exigem política formal de retenção e exportação antes de operações destrutivas. O banco de staging deverá validar auditoria sem vazamento para outros usuários. Após a política, um operador autorizado deverá testar purge controlado sintético e prazo de execução.

## Gate 4 — vídeos e FFmpeg (pendente)

A transformação FFmpeg com um MP4 sintético foi realmente executada no container local e o resultado foi inspecionado por ffprobe. Na Vercel, o pós-install do ffmpeg-static era alertado; a API read-only mostra somente se o binário é identificável, sem validar codec ou capacidade de CPU. Exigir testes de upload de vídeos autorizados, Safari iOS, Android e logs de processamento Vercel antes de marcar resolvido.

## Gate 5 — BankScore e Validador (pendente)

Testes de autorização e proteção de rotas passaram com bancos simulados. PDF real, sessão Supabase, download mobile e auditoria admin exigem staging e navegadores autenticados. As APIs não foram alteradas para evitar regressões. Nenhum pagamento real foi emitido.

## Gate 6 — release

Quando os gates acima forem atingidos: revisar o diff, executar testes automatizados completos, smoke E2E em navegador real, avaliação de segurança, backup completo e aprovação expressa de deploy de produção. Até lá, **NO-GO para produção**.