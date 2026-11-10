# JENIOS Ultra R125: candidato local, não operacional

**Candidato não validado para operação. Não publicado. Nenhuma conta real conectada, ordem enviada ou cobrança ativada nesta entrega.**

## Origem preservada

A base é a versão publicada R124, commit `d63f26ca9ddb9987f74cd62aabe0f42bc181ab63`. Os arquivos adicionais de R118–R120 foram recuperados do checkpoint `ccfca5dc3182da0ca5af8bf38992b1d811b77533`, sem modificar seus manifestos, fontes ou pacotes históricos.

O manifesto R125 registra somente substituições explícitas sobre os blobs da R124 publicada e arquivos novos. O verificador mantém os manifestos R118–R120 e R124 fixados e rejeita alterações não inventariadas. O teste legado R115 troca somente sua importação da política atual necessária para acompanhar a rota HTTP; não reescreve a matemática nem estratégias históricas.

O ZIP é montado a partir do pacote R120 preservado. Seu `LEIA-ME.md` passa a se chamar `GUIA-R120.md`; os guias anteriores continuam históricos. Este documento define o estado e escopo atual. O pacote acrescenta o relatório local R124, módulos de configuração/rotas/escopo/relatório R125, CLI local, inspetor MT5 e testes de leitura com terminal fictício. `INTEGRIDADE.json` contém o SHA-256 de cada arquivo empacotado. Nenhuma credencial, estado de conta, banco local, SDK nativo ou executável de corretora é incluído.

## Escopo atual e preferência de corretora

A preferência é concentrar na **Genial**, evitando duas contas quando houver uma integração adequada e comprovada:

- Mini índice e mini dólar da B3: contratos reais WIN/WDO com vencimento, por MT5 ou Profit, conforme acesso e habilitação do titular. O nome do terminal não prova elegibilidade de uma conta ou instrumento.
- Cripto na Genial: rota nativa/API ainda pendente de comprovação. A seleção pendente não é convertida silenciosamente em outra corretora.
- Binance é uma **alternativa opcional**, com seleção explícita e conta separada quando aplicável. Spot e USDⓈ-M Futures são produtos diferentes; Futures depende da elegibilidade concreta da conta, produto e jurisdição. Não é presumido disponível para contas brasileiras.
- Forex e ações comuns estão fora das novas configurações Ultra. Fontes, relatórios e acesso histórico não são apagados ou reinterpretados como execução autorizada.

Não se presume obrigação de aprovação individual de cada robô pela corretora. Isso também não significa que este código, a conta, o instrumento ou uma rota externa já estejam homologados.

## Direção do produto ainda não implementada

A direção atual é reservar contas individuais exclusivamente aos outros robôs JENIOS e usar a conta de Paulo para Ultra/Kivoryn. A interface individual preservada neste candidato **ainda não implementa essa direção e não deve ser publicada como produto concluído**. Não houve alteração nos outros robôs.

Este candidato preserva os dados e credenciais no ambiente do titular. **Não implementa uma conta central para clientes operarem, gestão de recursos de terceiros, segregação de custódia ou autorização multiusuário.** Separar usuários e dispositivos na plataforma não comprova separação das posições, ordens, custos ou resultados na corretora.

A conta pretendida já está definida; o papel dos clientes e o arranjo oficialmente autorizado ainda precisam ser esclarecidos antes de qualquer ativação ou captação. O documento de checkout `R125-ACCOUNT-MODEL.md` registra essa distinção separadamente e não integra o pacote do cliente.

## O que funciona sem uma conta

- A CLI `client-r125.mjs` valida um plano exportado, informa as rotas escolhidas e mantém `executionAvailable=false`. Não provisiona credenciais nem envia ordens.
- Os módulos de relatório reutilizam a contabilidade já existente. MT5 é transporte: um relatório B3 homogêneo e explícito pode passar pelo caminho de validação B3; não se infere mercado só pelo símbolo.
- O escopo novo exige evidência de instrumento e elegibilidade. Uma evidência sintética usada em teste nunca autoriza execução.
- O inspetor `mt5_readiness_r125.py` é somente leitura e seus testes usam objetos fictícios. Não foi executado contra uma conta ou terminal reais.

Todos os indicadores de liberação permanecem falsos: `liveExecutionAllowed=false`, `externalPaperAllowed=false`, `nativeValidated=false`, `productionPublished=false` e `billingAllowed=false`. A elegibilidade de corretora/conta permanece pendente. Resultado offline satisfatório não certifica operação nativa, proteção de posições ou resultado financeiro.

## Reproduzir o candidato sem terminal

Requisitos: Node.js 24 e Python 3. Execute a partir da raiz do ZIP extraído, sem instalar dependências de corretora:

```sh
node --input-type=module -e "await import('./lib/platform/ultra/client/plan-r125.mjs'); await import('./lib/platform/ultra/client/report-r125.mjs'); await import('./lib/platform/ultra/scope-r125.mjs')"
python -B scripts/platform/ultra/test_mt5_readiness_r125.py
```

Para inspecionar um plano já exportado pelo aplicativo, mantido localmente:

```sh
node scripts/platform/ultra/client-r125.mjs plan /caminho/local/plano.json
```

A CLI não aceita senha ou chave. Um plano legado incompatível exige revisão explícita; não transforma Forex em B3 nem confirma acesso automaticamente. Os testes de inventário de fonte e UI/HTTP precisam do checkout completo e não são testes do pacote isolado.

No checkout, a verificação focada do empacotamento e inventário é:

```sh
node --test tests/platformUltraR125Integrity.test.mjs
```

## Inspeção MT5 não é ativação

`R125-GENIAL-MT5.md` descreve as fontes oficiais, dependências e limites do inspetor. Importar o módulo não abre o terminal. A execução deliberada com `--inspect-terminal` em Windows pode inicializar o MT5 e reutilizar a última conta/credenciais salvas, conforme o SDK oficial; não existe promessa de conexão estritamente `attach-only`.

Essa inspeção real só deve ser iniciada pelo titular no ambiente correto. Este trabalho não a iniciou, não alterou permissões e não configurou acesso persistente. Não cole credenciais em conversa, plano, repositório ou servidor do aplicativo.

Profit continua dependente da distribuição oficial licenciada e de versões/arquitetura compatíveis. A licença Profit não é um pré-requisito presumido para usar MT5. Permanecem pendentes as conexões nativas aplicáveis, validação de elegibilidade, conciliação de conta e custos, proteções, reconexão e um modelo operacional autorizado. O Ultra autônomo não está concluído.
