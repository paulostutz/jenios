# Ultra R129 — composição local da R128 com a UM001

Esta candidata liga a sessão durável e os registros atribuídos da R128 à preparação mensal e à reserva fictícia da UM001. Reutiliza o motor, as estratégias, a reconciliação e os contratos existentes. A execução deste pacote é exclusivamente local, com dados fictícios.

**Nenhuma ordem externa, API de demonstração, cobrança, carteira ou débito real é habilitado.** Uma aprovação no laboratório não autoriza operação financeira. Os nomes dos planos isentos permanecem pendentes e não são escolhidos pelo pacote.

## Bases preservadas

- R128 conciliada: `ac3ea769faa89eff81f0942990a4370a73340e37`.
- UM001: pacote `ULTRA_MENSAL_UM001_CODIGO_TESTES_20261110.zip`, SHA-256 `4c6d40d296885ee3c2b7bdbb911fbf54ae7ac703fda336861d105c2e3b8b29d9`.
- Letter: dependências originais do CB016 e da candidata mensal UM001, copiadas sem alterações e identificadas no documento `R129-LETTER-MONTHLY.md`.

Os arquivos e guias históricos da R128 e de ambas as R127 permanecem no pacote. A candidata acrescenta as pontes R129; não substitui suas implementações.

## Executar o ensaio integrado

Requer Node.js 24, incluindo `node:sqlite`. Extraia o ZIP para uma pasta nova. Não é necessário instalar SDK, fornecer credenciais, conectar corretora ou informar saldo de carteira.

Na raiz extraída, execute:

```sh
node scripts/platform/ultra/qualify-r129.mjs ./resultado-r129
```

A pasta de saída precisa estar vazia ou não existir. O ensaio grava diários SQLite fictícios e o relatório `R129-OFFLINE-MONTHLY-INTEGRATION.json`. Os diários são somente evidência local; não são carteiras nem livros contábeis de produção. Para repetir, use outra pasta vazia.

O relatório identifica a plataforma de origem, a conta fictícia, o ambiente, a moeda, as revisões e as etapas exercitadas. Os resultados financeiros são dados sintéticos, sem promessa de retorno.

Para executar apenas os testes da composição acrescentada:

```sh
node --test tests/platformUltraRecordsMonthlyR129.test.mjs tests/platformUltraR129StartCycle.test.mjs tests/platformUltraLetterMonthlyR129.test.mjs tests/platformUltraR129MonthlyJourney.test.mjs
```

## O que a composição faz

### Registros e revisão

A ponte consome páginas do registro atribuído, valida a identidade e a continuidade antes de incorporá-las e conserva cada revisão original. A última revisão válida substitui a projeção da mesma operação no relatório UM001. A reentrega de uma página ou evento não acrescenta outro resultado.

Conta, conexão, ambiente, moeda, produto, estratégia, sessão, quantidades, preços, horários, referências de execução, custos e origem permanecem disponíveis. O relatório não atribui ao Ultra registros excluídos ou sem vínculo. Detalhes nativos de execuções não presentes no feed continuam identificados como pendentes.

Origem incerta, lacunas de páginas, execução desconhecida e custos incompletos impedem uma conclusão financeira. A ausência de dados ou uma falha não é convertida em resultado ou saldo zero.

### Start e retomada

O vínculo de Start usa conta, titular, ciclo, intenção e primeiro início explícitos. Um ciclo pode conter várias negociações. Repetição, reconexão e retomada conciliam a mesma reserva fictícia de R$ 5 na autoridade UM001 compartilhada.

A pausa da sessão R128 é retomável; a fase tarifária da UM001 já é terminal. A ponte preserva ambas: retoma a sessão e consulta a reserva existente, sem reabrir o registro tarifário nem criar outra taxa. Uma nova instância não toma o cache local como confirmação financeira. Pendências verdadeiras de plano, ativação ou saldo fictício não são apagadas por repetição do comando.

### Apuração e Letter

Ganhos, perdas e custos confirmados entram no resultado geral do conjunto declarado de contas do mesmo cliente, ambiente e moeda. Cada conta continua identificada. A preparação aplica 20% ou 10% conforme a condição explicitamente configurada na fixture; mês com prejuízo não gera performance. Assinatura e Start continuam separados.

Não há compensação presumida entre meses nem conversão entre moedas. Regras, cobertura ou custos não confirmados mantêm a apuração pendente. O fuso usado no ensaio é `America/Bahia`, herdado da UM001; o calendário contratual de cobrança ainda depende de confirmação.

Para uma conta, o ensaio reutiliza a preparação e a autoridade fictícia da Letter. Enquanto há obrigação fictícia pendente, o runtime bloqueia novas aberturas. Consulta, conciliação, cancelamento e redução de posições continuam disponíveis. Somente uma confirmação válida da mesma autoridade fictícia pode liberar esse bloqueio.

Para várias contas, o cálculo geral preserva o conjunto e desconta as perdas. A obrigação da Letter UM001 ainda contém uma única conta de corretora. Por isso a emissão multicontas permanece pendente, sem fabricar conta consolidada, criar faturas por conta ou registrar uma dívida para contornar essa limitação.

## Limites da evidência

O harness pode atestar a cobertura dos seus próprios dados fictícios, com vínculo e referências explícitos. Esse atestado é separado dos registros de origem e não converte `nativeValidated`, `brokerAuthenticated` ou a cobertura nativa em verdadeiros. Pendências operacionais como custos ausentes, conflitos ou páginas incompletas não são resolvidas por esse atestado.

O ensaio local não comprova conexão nativa com Binance, Genial, Profit ou MT5, licença, elegibilidade de conta, execução externa, proteção de posições ou cobrança em produção. A integração cripto da Genial e a futura Exchange Kivoryn mantêm os limites registrados nos checkpoints anteriores.

Nenhuma validação visual foi realizada. A recusa anterior permanece respeitada, sem navegação, captura, DOM ou caminho alternativo.

## Documentação de interface

- `docs/release/R129-RECORDS-MONTHLY-INTERFACE.md`: feed, revisão, projeção e cobertura.
- `docs/release/R129-START-CYCLE.md`: intenção, reserva, retomada e gates.
- `docs/release/R129-LETTER-MONTHLY.md`: cálculo geral, dependências originais e laboratório Letter.
- `INTEGRIDADE.json`: SHA-256 de cada arquivo do pacote, exceto o próprio inventário.

O checkpoint de entrega informa separadamente os comandos executados, os resultados observados e as dependências que continuam abertas. A candidata não foi publicada e não ativa cobrança.
