# JENIOS R45-B92 — núcleo protegido original: auditoria privada e ponte desacoplada

**O código proprietário NÃO foi copiado ao GitHub da Social.** O arquivo fonte original R45-B52/B53 foi aberto somente em ambiente isolado e suas rotinas de modos, risco e seleção causal foram identificadas por caminho e SHA-256.
A suíte privada recuperada incluiu `robots`, `simulator`, `coordination` e `causal-selector`: 167/167 testes offline aprovados, sem rede nem broker. Evidência completa, lista de hashes e protocolo de extração serão salvos em pasta privada da Biblioteca, não no repositório.

Novo contrato público `lib/platform/private-core-bridge.mjs` trata envelopes JSON de um FUTURO runtime privado segregado, exige HMAC de 32+ caracteres, SHA-256 conhecido do motor, timestamps recentes, três modos com o mesmo hash de observação e `realExecutionAllowed=false`.
O resultado atual, mesmo com envelope assinado, assume `privateCoreLoaded=false` e `runtimeBytesVerified=false`; um segredo que assina a mensagem não prova que o código binário foi executado no runtime certo.
**Sem implantação do runtime privado**, não há ligação operacional aos motores originais e NÃO se atribui acurácia, P&L, elegibilidade paga, ordens nem capital.
O assinador de fixture é bloqueado em produção e só serve a testes. Nenhum segredo real foi criado e nenhuma nova infraestrutura foi contratada.
Os três modos demonstrativos B80 e o replay B83 permanecem explicitamente separados das saídas dos robôs originais.

Critério futuro B92 pleno: hospedar um runtime privado autorizado, validar o arquivo exato (hash) dentro dele, atestar a proveniência da observação e gerar comparação prospectiva cega de saída; só então integrar os resultados sem revelar algoritmo.