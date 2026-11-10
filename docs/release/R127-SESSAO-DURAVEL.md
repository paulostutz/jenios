# Ultra R127: sessão durável, somente simulação

Candidata não publicada. Nenhuma execução real, paper externo ou cobrança é liberada. A R126 e as versões anteriores permanecem preservadas.

## Lacuna resolvida neste componente

No runtime histórico, `start()` e a retomada recalculam o prazo a partir do momento atual. A nova classe `DurableUltraRuntimeR127` acrescenta controle de sessão sobre `UltraExecutionRuntime`, reaproveitando `ExecutionLedger` e a tabela `ultra_transport`. Não cria outro banco nem muda seleção de ativos, sizing, estratégias, protocolos ou APIs.

- O primeiro Start grava a identidade de sessão, vínculo do titular/conexão, hash da configuração e prazo original antes de ativar o ensaio.
- Repetir Start retorna a mesma sessão. Não estende seu prazo nem retoma uma pausa implicitamente.
- Retomar ou recuperar após reinício exige ação explícita e conserva o início/prazo originais. Recuperação de worker respeita o lease existente.
- Duas instâncias no mesmo diário não executam Start/retomada/tick/comando simultaneamente. Um novo controlador invalida os anteriores antes de permitir escritas.
- As mutações herdadas passam por uma guarda transacional de lease, sessão e controlador. Perder o lease durante uma consulta pendente não permite pausar o novo dono.
- Configuração e orçamento são snapshots imutáveis durante a sessão. Cada observação válida do relógio do controlador ativo fica persistida; regressão temporal bloqueia o ciclo.
- Expirar ou pausar bloqueia novas entradas, sem registrar fechamento fictício. Reconciliação e comandos explícitos de redução continuam disponíveis no simulador.
- `finish()` deixa a sessão em `draining` enquanto existirem operações/comandos pendentes; só registra `ended` quando o diário confirma que não restou exposição pendente.
- Uma nova sessão exige término/expiração anterior e ausência de operações/comandos pendentes. Moedas e conta continuam separadas pelos vínculos existentes.

O prazo inclui o tempo em pausa ou preparação. Isso é uma escolha técnica conservadora para não ampliar silenciosamente a janela configurada, não uma decisão de cobrança ou direito comercial. O identificador local da sessão não é autorização de serviço nem evento faturável. Não foi implementada atribuição comercial de trades à sessão, débito de R$ 5, performance ou carteira.

## Executar sem conta

Requisito: Node.js 24. Extraia o pacote e execute:

```sh
node scripts/platform/ultra/rehearse-session-r127.mjs
```

Resultado esperado: `passed: true`, 14 cenários de ensaio, `ordersSentToBroker: 0` e todos os indicadores de execução nativa/cobrança falsos. O comando cria uma nova pasta temporária com diários e `resultado-sessao-ficticia.json`, não aceita credenciais nem aponta para diretório de uma conta real.

Para executar a suíte específica incluída:

```sh
node --test tests/platformUltraR127Session.test.mjs
```

Os testes incluem saída abrupta de processo sem fechar o diário, lease ainda ocupado, retomada após timeout, resposta perdida, expiração durante preflight, pausa durante Start, troca de controlador, perda de lease durante await, mutação de configuração durante await e relógio regressivo. Todos usam dados/objetos fictícios. Não há conexão a MT5, Profit ou Binance.

O ensaio R126 continua disponível em `scripts/platform/ultra/rehearse-r126.mjs`. Os guias antigos são históricos; a direção atual permanece conta própria de cada cliente, sem conta central. A nova camada está no pacote e na fonte, não ligada ao botão Start produtivo. Esse botão continua recusando execução.

## Limites de integração

- A sessão R127 ainda usa apenas adaptador `offline_fixture`. Não transforma o simulador em conector nativo.
- Nenhum contrato comercial, autorização de usuário, assinatura, débito, comissão ou saldo foi alterado. A frente comercial permanece independente.
- Campos locais não comprovam identidade na corretora. A integração produtiva precisa receber vínculos autenticados e fonte autoritativa, não confiar em parâmetros do navegador.
- O relógio é validado por progressão e limite. Isso não atesta a hora oficial do mercado nem substitui sincronização confiável do ambiente do titular.
- “Ended” descreve o diário conciliado do simulador. A confirmação externa de ordens, fills, posições, custos e proteção continua pendente.
- Não houve QA visual, nova tentativa de prévia, push ou deploy. R124 permanece a última versão publicada conferida.

Este avanço fecha uma lacuna de retomada e controle de sessão em simulação. O Ultra operacional ainda depende das pontes nativas, habilitação da conta/produto e validação ponta a ponta no ambiente autorizado do titular.
