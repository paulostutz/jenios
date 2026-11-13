# REVFIN002 — verificação exata da fonte Web candidata

A base desta sucessora é `e53d946e0434a6c8d2480ecf781f4b63707389b6`, árvore `83fd126ccd0d98c8d7782fe3e832659cd64f2424`. Não é a versão publicada. A sucessora não regenera nem amplia permissivamente o manifesto REVFIN001.

O arquivo `scripts/check-reverso-v2-web-baseline.mjs` contém o verificador de e53 byte a byte, blob Git `6b1d203c10f9873e908bd93b324963e11aa7c85b`. O manifesto REVFIN001 original mantém o blob `4861a42d21ec0944eb35687fc32aac7e671336c0`. Todos os guardas históricos, testes de integridade e configuração do ambiente permanecem.

O manifesto novo `REVFIN002-WEB-RELEASE.json` fixa o inventário atual inteiro por herança de e53 e identifica cada adição. Há exatamente três substituições de conteúdo, além do verificador público: a composição da UI financeira do Reverso, as duas novas entradas nominais no retorno de login e o stub do harness isolado anterior. Os caminhos e seus predecessores são explícitos; outras substituições ou adições são recusadas.

A execução primeiro valida manifesto, árvore, inventário e o verificador predecessor. A seguir executa o verificador original de e53 no inventário exato daquela base. Somente os três caminhos substituídos e o próprio verificador recebem as respectivas versões de e53. Todo caminho não alterado usa o callback `read` atual, preservando a detecção e o diagnóstico das mutações pela cadeia original. A versão atual dos três caminhos substituídos é validada separadamente contra seus hashes novos. Assim nenhuma substituição é ignorada e nenhum arquivo adicional desaparece do inventário.

Os códigos públicos `REVFIN001 verifier pin changed`, `REVFIN001 verifier source changed` e `REVFIN001 exact inventory` continuam estáveis para os testes e consumidores anteriores, acompanhados da indicação `REVFIN002 successor`. Isso preserva o contrato de diagnóstico; o conteúdo verificado é o da sucessora e o manifesto novo usa schema REVFIN002. Os demais diagnósticos da cadeia anterior vêm dos verificadores originais inalterados.

## Comandos locais

```sh
node scripts/finalize-reverso-v2-web-release.mjs
node scripts/finalize-reverso-v2-web-release.mjs --finalize
node scripts/check-reverso-v2-web-release.mjs
node --test tests/reverso-release-v2.test.mjs tests/reverso-release.test.mjs
```

O primeiro comando apenas inspeciona. `--finalize` deve ser executado somente após a conciliação e o freeze; grava apenas o novo manifesto e o verificador atual. Não faz stage, commit, push ou deploy. A lista precisa estar staged para a checagem de inventário por `git ls-files`; os testes nunca geram ou modificam manifesto.

Use o CLI separado de verificação. Os predecessores preservam inclusive seus pontos de entrada históricos; chamá-los diretamente não representa a avaliação da árvore sucessora. Os objetos Git de e53 e dos checkpoints anteriores continuam pré-requisitos do restore, além dos arquivos da candidata. A frente de entrega preserva esses objetos no bundle.

## Escopo da aprovação

Uma resposta positiva comprova a integridade da fonte candidata e a cadeia de herança. Todas as capacidades de publicação, emissão de pagamento, cobrança real, débito real, execução real e permissão de corretora permanecem falsas. O verificador não é autorização de release, não altera o gate de produção e não monta o runtime em ambiente produtivo.

A build integral e os testes de restauração são coordenados depois desta checagem. A evidência SSR de sessões fictícias não equivale à revisão visual de navegador; o checkpoint mantém essa limitação separadamente. A política comercial de custos, perdas e unidade de apuração do Reverso também permanece pendente de aprovação específica.
