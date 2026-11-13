# REVFIN001 — fechamento exato da fonte web

Base publicada preservada: `0edbbef8c4b6bd5c9a6f5fb5e93c33eb7f11ce47`, árvore `c86e7eaef0a3c96efdb2daedf40ecccfcc56af32`.

Esta extensão verifica o conteúdo da candidata Reverso. Não publica, não concede acesso, não emite cobrança e não autoriza negociação. A aprovação de conteúdo não substitui os testes funcionais, a conciliação comercial ou o gate de produção.

## Preservação

`scripts/check-reverso-web-baseline.mjs` é a cópia byte a byte de `scripts/check-ultra-owner-web.mjs` nessa produção. Seu blob original é `70cbd74e9af932d630f3c03ed8744f11bc9ace68`.

O checkpoint local de histórico `2c8ba6ed56178add03b1cebcab88599e27abb3c4`, árvore `068b4dc3eae6e5d45c3ec35d42459eaca638f423`, também é preservado. Seu verificador foi copiado integralmente para `scripts/check-reverso-web-history.mjs` (blob `ac41d6c1a3f4164991246aca17aa787360af5928`) e seu manifesto para `docs/release/REVFIN001-HISTORY-WEB-PREDECESSOR.json` (blob `5ebd3fecf1ea3e9bee28f2694e303024d9f5a818`). O sucessor executa esse verificador com callbacks de leitura e inventário da árvore exata daquele checkpoint; ele executa, por sua vez, o predecessor publicado e toda a cadeia anterior. A prova histórica não aprova a fonte nova: o sucessor confere separadamente todos os bytes e o inventário da candidata atual.

As substituições funcionais da base publicada ficam limitadas a seis caminhos explícitos:

| Caminho | Alteração delimitada |
| --- | --- |
| `lib/pay/catalog.mjs` | Duas ofertas inativas do Reverso, sem reescrever os produtos anteriores |
| `tests/payCatalog.test.mjs` | Prova do catálogo ampliado |
| `app/dashboard-logado/page.js` | Link para a área Reverso do cliente |
| `app/platform/admin/robos/page.js` | Link para a área Reverso do Admin |
| `lib/pay/letter-billing-cb006.mjs` | Seleção explícita do RPC isolado e recusa do plano Reverso como acesso geral quando a opção estiver ativa |
| `lib/platform/monthly-billing.mjs` | Seleção explícita do RPC isolado no preparo da assinatura Platform |

Os dois consumidores preservam, respectivamente, os blobs publicados `b166c75c01111339ee00b1c06afd96b6b34a9588` e `f44dee0b3195a781218cee9eafd4e6d93be89f92`. A seleção nova depende de `JENIOS_REVERSO_PLAN_ISOLATION_V1==='true'`; por padrão, os nomes e o comportamento anteriores permanecem. Não há fallback do RPC isolado para o RPC anterior. O helper adicional é aceito somente no caminho exato `lib/platform/reverso/subscription/isolation-rpc-v1.mjs`, sem abrir o diretório para adições genéricas. A opção não configura ambiente, migra SQL, ativa produtos ou autoriza cobrança.

Adições do Reverso recebem inventário e hashes explícitos. Arquivos ausentes, adicionais inesperados, entradas duplicadas, alteração de manifesto, código do verificador, predecessor ou fontes são recusados. A normalização exclusiva do pino do manifesto permite fixar também o código do verificador sem dependência circular entre os dois hashes.

## Fechamento após o trabalho terminar

Não gere o manifesto enquanto código, testes ou documentação ainda estiverem mudando. O script de revisão não aceita alterações a arquivos herdados fora dos seis caminhos delimitados. A migração do verificador aceita somente o par exato de verificador e manifesto do checkpoint `2c8ba6e`, ou o template sucessor já conhecido. Código de guarda desconhecido não é substituído. Mudanças de ambiente, autorização de release, autenticação, cliente financeiro central, Ultra, carteira, configuração Vercel e comando de build permanecem fora desta extensão.

1. Conclua e revise a implementação, os testes e a conciliação da candidata.
2. Rode `node scripts/finalize-reverso-web-release.mjs`. Sem argumentos, o comando mostra somente o inventário proposto; não altera arquivo algum.
3. Confira a lista exata de adições e as seis substituições. Uma adição fora do escopo permitido exige revisão explícita; não remova o filtro para fazê-la passar.
4. Rode `node scripts/finalize-reverso-web-release.mjs --finalize`. O script grava somente `docs/release/REVFIN001-WEB-RELEASE.json` e o novo `scripts/check-ultra-owner-web.mjs` com o pino exato.
5. Revise o diff e inclua no índice Git somente os arquivos revisados. O verificador de inventário usa `git ls-files`; arquivos finais ainda não adicionados ao índice serão recusados.
6. Execute `node scripts/check-reverso-web-release.mjs`, `npm test` e `npm run test:release-s05`, além das validações funcionais da integração. O manifesto não declara que essas baterias já passaram.
7. Se qualquer fonte mudar depois disso, a verificação deve falhar. Revise a alteração e repita o fechamento; não atualize hashes apenas para ocultar uma falha.

O gerador não faz `git add`, commit, push, merge, deploy ou comunicação externa. Arquivos temporários e logs devem ficar fora da árvore de fonte revisada. Documentação de Reverso pode ficar em `docs/reverso/`; seu conteúdo também será fixado pelo manifesto.

Uma restauração precisa conter os objetos Git da base publicada e do checkpoint local `2c8ba6e`, além dos predecessores copiados. A ausência desses objetos bloqueia a prova; não é substituída por um arquivo ou commit inventado.

A entrada de terminal separada `check-reverso-web-release.mjs` chama o mesmo verificador importado pelos testes e pelo gate. Ela evita executar isoladamente os blocos de terminal históricos dos predecessores, preservados sem edição. Não invoque diretamente `check-ultra-owner-web.mjs` para esta verificação; as importações existentes continuam iguais.

## Publicação permanece separada

`lib/release/environment-scope.mjs`, `lib/release/ultra-production-source.mjs`, `scripts/check-s05-env-scope.mjs`, os testes de ambiente e o comando `npm run build` permanecem intactos. O gate continua conferindo projeto, provedor, branch aprovada, SHA do checkout, fonte limpa, banco, chaves, schema e aprovações existentes. A branch de trabalho REVFIN001 não recebe uma autorização de publicação por este manifesto.

Os campos `publicationApproved`, `actualExecutionAuthorized`, `realDebitAuthorized`, `liveExecutionAllowed`, `realBillingAllowed` e `paymentIssuanceAllowed` ficam **false** no manifesto e no resultado do verificador. Qualquer tentativa de alterar esses valores é recusada. Uma futura publicação requer sua própria conciliação e autorização; nenhuma ativação financeira pode ser deduzida do sucesso do checker.
