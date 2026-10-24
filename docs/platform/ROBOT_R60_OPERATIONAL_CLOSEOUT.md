# ROBOT-R60 — Fechamento operacional e limites da evidência

## Base preservada

O bloco parte do backup `backup/jenios-robot-r59-final-research-certified-20261023`, commit `f7dd8f4a0db658dcd3bd957bc403c397d08f7621`, aprovado na CI `39957136366`.

A certificação de pesquisa R12–R59 permanece preservada. R60 não altera os módulos de decisão, os dados prospectivos R15 ou os parâmetros certificados. O guard de alinhamento continua em 0,65 e as métricas reais continuam nulas. O teste legado de bloqueio de deploy R5 foi adaptado para verificar a execução efetiva do comando curto, preservando as mesmas exclusões exigidas anteriormente.

## Correções deste bloco

### 1. Impedir deploy de pesquisa e backup

A configuração anterior tinha um `ignoreCommand` de 2.121 caracteres; o schema da Vercel aceita no máximo 256. Isso produziu tentativas de preview em erro, sem publicação do commit R59.

O novo comando tem 39 caracteres: `node scripts/vercel-ignore-research.mjs`. O script não depende de pacotes, credenciais ou rede. Saída 0 significa pular o build; saída 1 mantém a política normal da branch.

O arquivo `vercel.json` preserva as exclusões exatas existentes e acrescenta exclusões nativas para `fix/jenios-robot-*`, `research/jenios-robot-*`, `backup/jenios-robot-*`, além das refs exatas do R60 e de seu backup. O script funciona como uma segunda proteção e pula o build quando não consegue verificar a identidade da branch ou a política do repositório.

A ref R60 deve ser criada diretamente no commit que já contém estas proteções. Não criar uma branch nova sobre a configuração antiga antes de aplicar a correção. O backup deve apontar diretamente ao commit final aprovado. Nenhuma configuração global de projeto, domínio ou ambiente de produção é alterada.

Referências oficiais consultadas em 24/10/2026:

- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/docs/project-configuration/vercel-json
- https://openapi.vercel.sh/vercel.json

### 2. Remover resultados e confirmações sem evidência

`/engenharia-reversa` apresentava logs e valores de lucro fixos e afirmava executar inversões. Agora inicia sem registros; o botão adiciona somente um exemplo local claramente identificado, sem análise de mercado, sinal, ordem ou ganho. O conteúdo desaparece ao recarregar.

`/risco` afirmava atualizar a infraestrutura, embora os campos estivessem somente no estado React. Agora descreve um rascunho local e volátil. Revisar os parâmetros não ativa proteções, não grava dados no servidor e não envia nada à corretora. Editar um campo retira a confirmação anterior.

Essas mudanças corrigem a fronteira entre demonstração e execução. Elas não conectam as páginas aos módulos R56–R59 e não autorizam transporte real ou Paper externo.

### 3. Tornar a aceitação verificável

O guia `ROBOT_R60_MANUAL_ACCEPTANCE.md` contém 14 cenários, com 11 inicialmente `NOT_EXECUTED` e 3 `BLOCKED_INTEGRATION`. Não há aprovação manual fabricada.

A leitura do código mostrou que a Mesa registra intenções ilustrativas; o Híbrido do laboratório usa replay B80; os guardas certificados R56–R58 ainda não têm integração demonstrada nesse fluxo; e o fluxo visual UltraFast não foi localizado nas telas auditadas. Pesquisa aprovada não equivale a homologação dos quatro robôs na interface.

## Validação e salvamento

O workflow `jenios-robot-r60-operational-closeout.yml` executa os novos testes de bloqueio de deploy e de honestidade de interface, toda a bateria direcionada R12–R59 e `npm run build`, que inclui testes gerais, regressão Social e geração das páginas. Transportes real/Paper permanecem desabilitados; o workflow usa apenas variáveis de QA e não contém etapa de deploy.

As contagens, a execução de referência e a classificação final deste bloco são registradas em `evidence/ROBOT_R60_OPERATIONAL_CLOSEOUT_CHECKPOINT.json`. O ledger recebe uma seção operacional separada; o histórico e a classificação da pesquisa R59 são preservados.

Uma aprovação da CI demonstra os testes automatizados e o build desse commit. Não equivale a sessão de navegador, teste de corretora, certificação de lucro ou autorização de produção.

## Pendências reais para a próxima fase

1. Integrar, em homologação identificada e sem transporte externo, os módulos certificados aos fluxos do operador, reaproveitando a lógica existente.
2. Executar o roteiro de interface nesse ambiente e registrar evidências por commit e cenário.
3. Tratar qualquer validação futura em corretora como etapa separada, mediante autorização específica, sem preencher retroativamente o R15 e sem substituir os resultados sintéticos.

Enquanto isso, `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` continuam `null`; performance comercial e rentabilidade real permanecem não certificadas.
