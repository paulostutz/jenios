# JENIOS B301 — vínculo durável entre consentimento e evidências do B300

> **Atualização de continuidade (21/10/2026):** o texto histórico abaixo foi redigido antes da certificação remota B300. Desde então, o B300 foi certificado no commit `d31af76702e915b055b59da4b4a2059e2fa69e23`, CI [39692818829](https://github.com/paulostutz/jenios/actions/runs/39692818829) SUCCESS (120/120 contratos, 1.681/1.681 regressão, 94/94 S05 e build). A restrição de escrita foi liberada pelo conector oficial, sem deploy. O B301 permanece candidato à CI sobre esse commit; as referências abaixo à pendência B300 descrevem apenas o estado anterior. Nenhuma homologação externa ou de rentabilidade foi alcançada.\n\n**21/10/2026 UTC — candidato PRIVADO LOCAL, NÃO certificado pela CI.**

## Continuidade sem reconstrução

- Base remota certificada: B299, `53f127eb6118dd3a183ecdf3b52a5fd4e23e6419`, CI 39684586218 `SUCCESS`.
- B300: implementação pré-CI recuperada da Biblioteca `/JENIOS/Checkpoints/B300/`; 22/22 itens do manifesto conferidos; 107/107 testes locais aprovados. **A publicação parcial no GitHub foi bloqueada pelas configurações de segurança da ferramenta** antes de criar branch ou CI; B300 não é certificado remotamente.
- B301 reutiliza **sem alteração** `auditB300ReadOnlyCohort`, `verifyB299OfflineConsent`, `B299PrivateEvidenceJournal` e os validadores B297–B298. Nenhum núcleo privado foi incorporado.

## Implementado

`lib/platform/research/b301-durable-cohort-link.mjs` recebe um lote offline de B300 e uma instância genuína do diário privado B299. Antes de qualquer escrita, valida assinatura do consentimento, estado local de revogação, inexistência de importação anterior e **todas** as assinaturas/escopos e contratos do lote via auditoria pura B300. Só então grava cada comprovante no SQLite protegido do B299, aproveitando a unicidade de nonce e digest. Confere, no fim, o número de evidências registrado. Não chama o provedor, não modifica risco B152 e não envia ordem alguma.

**Limitação operacional importante:** as transações B299 são individuais. O lote B301 NÃO é atomicamente gravado de ponta a ponta. Em falha durante o lote, alguns comprovantes já podem estar consumidos e o procedimento é interrompido para **revisão humana, sem retentativa automática**. Não se adicionou API de reversão/remoção desse diário.

## Evidências de testes locais

- 10/10 casos B301: consentimento, revogação, antifraude/alteração, ausência de falsa execução, persistência após restart, repetição, cross-consent nonce/replay, falha parcial e separação entre hipótese e P&L.
- 117/117 testes combinados B297–B301 no Node.js 22, zero falhas.
- Contratos revisados somente com chaves Ed25519 geradas para testes e evidência sintética; sem dados externos.

## Limitações e NO-GO

- O diário B299 prova apenas que **a aplicação gravou e vinculou** evidências exportadas por uma chave de coletor configurada; isso **não atesta corretora, titular real, consentimento civil ou origem independente**.
- `FILLED`, `flat`, `DELIVERED` e carimbos UTC nos próprios documentos são **declarações do coletor**, não recibos externos.
- Lossômetro: hipóteses de perda/ganho permanecem hipóteses. `actualLossesAvoided` e `actualBrokerRealizedPnl` seguem `null`.
- Não foi executado login, API oficial, integração com Inter, IA generativa, provedor de mensagem, feed de ordens ou validação prospectiva externa.
- Nenhuma ordem real/Paper, nenhum pagamento, nenhuma cobrança, nenhum deploy, nenhuma alteração de CHEFE/LETTER.

## Próximos gates

1. Resolver a restrição de gravação dos dois arquivos B300 no GitHub por via aprovada. Não usar caminhos alternativos para contornar o bloqueio de segurança.
2. Certificar B300 na CI isolada; depois submeter B301 em branch distinta sem deploy.
3. Somente com ambiente externo e consentimento válidos: leituras GET autenticadas autorizadas, testemunho independente de origem/tempo, entrega real, correlação B152 durável de fills/stops/posições, e investigação prospectiva sem alegações antecipadas de lucro.

**Status B301: LOCAL_TESTS_PASSED_REMOTE_CI_PENDING. Nenhum lançamento autorizado.**