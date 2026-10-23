# HP04 — retomada da homologação autenticada

Base imutável: `cdbedfccd65ade53ae0ffb46effd8a32ed7e4658`, backup FC03 de 23/10/2026, com R59 preservado. O HP04 acrescenta exclusivamente um roteiro de testes e uma CI. Nenhum componente, API de produto, algoritmo privado ou teste certificado anterior foi substituído.

Branch de testes: `research/jenios-hp04-authenticated-journey-20261023`. Deploy automático bloqueado no `vercel.json` para esta branch e seu backup. Nenhum comando de deploy ou merge faz parte do roteiro.

O primeiro job repete regressão geral, Social e build sem credenciais. O segundo depende do primeiro, da branch exata HP04, da variável existente `PLATFORM_CP69_REMOTE_QA_ENABLED=true` e da revisão do ambiente protegido `jenios-platform-auth-qa`, mantendo o revisor obrigatório e a ausência de bypass administrativo. A autorização de branch inclui somente o nome exato da nova branch, sem remover a regra anterior. O workflow antigo permanece inalterado.

O job autenticado usa apenas `jenios-platform-homologacao`, referência `xaicvhagftzjkqphnbgx`, e um servidor temporário em `127.0.0.1:3129` dentro do runner. Cria duas contas fictícias `@example.com`, confirma-as sem envio de e-mail, testa permissões, diagnósticos independentes, tentativa de cruzar identidade, validação de entrada e leitura protegida. Revoga suas sessões, exclui somente as contas que criou e verifica a limpeza e a rejeição de sessões antigas. A conta preexistente não é utilizada nem alterada.

O roteiro preserva os 15 critérios CP69 e acrescenta um token malformado e quatro verificações de sessão após a limpeza: 20 critérios previstos. Só um relatório de execução PASS pode confirmar essa contagem. Segredos, tokens, senhas, e-mails de teste e dados de contas não são incluídos nos artefatos.

Essa etapa produz evidência da autenticação e das APIs. Não deve ser confundida com observação visual da jornada no navegador, execução do núcleo original dentro da interface ou homologação comercial dos robôs. Essas fronteiras continuam pendentes enquanto não tiverem evidência própria. As evidências privadas HP03 permanecem fora deste repositório público.

Ordens reais e Paper externo permanecem zero. Produção, pagamentos e envios de e-mail ficam desabilitados. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` continuam `null`; R15 permanece prospectivo sem backfill e o guard R59 continua congelado em `0.65`.

Estado inicial: preparado para CI; autenticação atual ainda não certificada. O resultado deve ser conferido pelo SHA, pelos dois jobs e pelo artefato `AUTHENTICATED_RESULT.json`, nunca pelo resultado histórico CP69.
