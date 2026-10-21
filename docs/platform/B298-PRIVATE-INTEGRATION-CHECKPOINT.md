# JENIOS B298 — Checkpoint de convergência privada, 21/10/2026

Base comercial certificada B293: `b44d43a4fa6ff6249d61bf8b257b1a64105be33d` (CI 39680605511, Preview READY).
Base paralela de pesquisa B297: `9e9dd107e7e7a67c6d7ded6b7b1fd72cb44fdb7d` (CI 39677069427 SUCCESS; só ensaios sintéticos e contratos públicos).
Branch privada: `fix/jenios-b298-integrated-release-reconciliation-20261021`; backup antes da integração: `backup/jenios-b298-before-additive-reconciliation-20261021`.

## O que foi reconciliado
Exatamente 33 arquivos novos de pesquisa, testes e documentação, copiados usando os SHAs de blob originais, sem substituir arquivos pré-existentes. Consulte `B298-INTEGRATION-MANIFEST.json`. Workflows históricos por branch foram omitidos para impedir CI duplicada; o workflow novo B298 executa testes da pesquisa junto à suite comercial e preserva hashes. Nenhum engine.mjs/service.mjs proprietário foi incluído. O CLI privado de auditoria é preservado, mas **não é executado na CI** e não pode ligar corretora, ordem ou rede.

## Segurança
`vercel.json` desliga deploy Git automático na branch B298 e mantém todas as demais branches fora de sua restrição. Não houve modificação de PAY, Social, Universidade, núcleos B152, scripts de ordens, banco de QA ou produção. Nenhuma geração externa de IA, cobrança, operação Paper externa ou negociação real foi autorizada.

## Gate
Exigir CI B298 SUCCESS: verificação do diff aditivo, hashes dos 33 arquivos, provas financeiras B290/B291/B292 em fixtures isolados, testes B287–B297 de contrato, regressão geral/S05, build Next, HTTP localhost e verificações em navegador LP/Universidade. Criar backup certificado após êxito. Rollback da branch B298 para B293 via backup anterior, nunca da produção.

## Não certificado
Ainda faltam contas reais de QA, sessões autenticadas end-to-end, catálogo efetivamente lido no Preview hospedado, Inter mTLS e ciclo Pix, IA generativa com custo autorizado, atestação independente do motor proprietário, sinais entregues por terceiro, feed de operações da corretora, reconciliação de fills e avaliação prospectiva. Não alegar rentabilidade nem lossômetro realizado. A etapa 1 é integração técnica offline; não é liberação comercial.

## B298 R2 — Complemento certificado da auditoria de pesquisa B298 e B299

- Fonte B298 assinada: commit `e74272a83e102c79118e3df9d8566e2c07526a95`, CI 39681610853 SUCCESS.
- Fonte B299 consentimento e anti-replay: commit `53f127eb6118dd3a183ecdf3b52a5fd4e23e6419`, CI 39684586218 SUCCESS.
- Adicionadas somente 8 novas fontes de módulos, documentação, testes e scripts CLI offline, com hashes exatos no manifesto atualizado (total 41 blobs). Não foram incluídos workflows históricos, vercel.json de outras branches ou códigos proprietários.
- B298 verifica envelopes assinados Ed25519. B299 verifica consentimento assinado e prevenção local durável de duplicidade por SQLite privado; assinaturas não provam a origem da corretora nem identidade civil do titular.
- Os scripts CLI importados são manuais e permanecem fora dos caminhos de execução da CI e das rotas Next.
- Necessária nova certificação CI B298 R2 antes de considerar a Etapa 1 técnica completa.
