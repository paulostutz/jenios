# Ultra R117 — histórico local e acompanhamento na Platform

O capital e as credenciais permanecem no ambiente do trader. Este pacote registra operações e sincroniza resultados; não envia, cancela ou encerra ordens. O código de sincronização da JENIOS não concede acesso à corretora.

## O que está disponível

- Diário SQLite persistente: operação, estados, quantidades, preços médios, referências, custos, resultado realizado e em aberto.
- Revisões auditáveis, reenvio sem duplicação e retomada da fila após interrupção. A sincronização não apaga o diário.
- Painel em https://www.jenios.com.br/platform/ultra: por operação, período, dia e geral; ganhos, perdas e lucro/prejuízo líquido separados por moeda e demonstração/real.
- Exportação local JSON e CSV. Relatórios V1 do R116 continuam disponíveis pelo comando antigo; o novo relatório completo usa `JENIOS_ULTRA_OPERATIONS_V1`.
- Coletor MT5 somente de leitura: histórico de ordens/deals e posições do `magic` escolhido pelo trader. Requer terminal Windows já autenticado, Python e o pacote oficial MetaTrader5. Código validado com respostas simuladas; ainda precisa de validação nativa no terminal do trader.
- Binance e Profit: diagnóstico local do R116 e contrato de registros; ainda não têm coleta automática completa nesta versão. Profit depende também do SDK oficial licenciado, tipos e manual; Profit Pro isoladamente não fornece essa ponte externa.

## Instalação e conexão do histórico

Node.js 24 e, para o coletor MT5, Python compatível com o pacote oficial MetaTrader5. Obtenha o pacote Python pelo canal oficial indicado em https://www.mql5.com/en/docs/python_metatrader5. Não instale DLL de terceiros.

1. Extraia o ZIP em pasta privada no computador/VPS do trader.
2. No painel Ultra, abra “Conectar o histórico do meu robô”, selecione conector e ambiente e gere o código. Ele aparece uma única vez e vence em 90 dias. Configure-o localmente na variável de ambiente `JENIOS_ULTRA_SYNC_TOKEN`; não o compartilhe em chat, capturas, logs ou no Git.
3. Para MT5, mantenha o terminal autenticado. Configure localmente `JENIOS_MT5_ACCOUNT` com a conta esperada e `JENIOS_MT5_SERVER` com o servidor exato. Se necessário, `JENIOS_MT5_TERMINAL_PATH` e `JENIOS_PYTHON` selecionam os programas locais. O coletor não recebe senha nem faz login.
4. Crie `perfil.json`, sem credenciais:

```json
{
  "provider": "mt5",
  "environment": "demo",
  "market": "forex",
  "accountFingerprint": "0000000000000000000000000000000000000000000000000000000000000000",
  "connectionLabel": "Meu Ultra",
  "ledger": "estado/operacoes.sqlite",
  "magic": 117001,
  "days": 30,
  "positionCostsComplete": false
}
```

`magic` precisa ser o identificador real e exclusivo usado pelo robô no terminal. O número acima é apenas exemplo, não configura um robô existente. `days` define a janela consultada (1–365 dias); posições ainda abertas são recuperadas mesmo se anteriores à janela. O acumulado contém os registros efetivamente coletados e preservados no diário, não necessariamente todo o histórico anterior da conta. O coletor recusa uma janela com mais de 20 mil ordens: reduza a janela, preservando o diário.

5. Execute `node scripts/platform/ultra/operations.mjs identify perfil.json`. O comando apenas confere a identidade local e devolve a impressão da conta. Copie `accountFingerprint` para o perfil. Na coleta, conta, servidor e ambiente são conferidos novamente; trocar de conta exige outro perfil e outro diário.
6. Execute `node scripts/platform/ultra/operations.mjs mt5 perfil.json --once` para uma consulta. Confira os registros com o histórico do terminal. Para acompanhar continuamente, remova `--once`. Com o código de sincronização configurado, os registros são enviados ao painel a cada ciclo. Sem internet, ficam no diário e aguardam reenvio. Ctrl+C encerra o coletor; não interfere nas posições.
7. Use `node scripts/platform/ultra/operations.mjs report perfil.json meu-relatorio` para criar `meu-relatorio.json` e `meu-relatorio.csv`, sem substituir arquivos existentes. `sync perfil.json` reenvia a fila pendente ao painel.

## Custos e conciliação

Lucro líquido = resultado bruto realizado − taxas (incluindo rebates com sinal) − financiamento/funding (créditos têm sinal negativo). Depósitos, saques e transferências não são lucros. Posições abertas e encerramentos sem custos completos não entram no consolidado. Períodos usam o horário da Bahia, e moedas não são somadas entre si.

O MT5 coleta comissão, fee e swap dos deals da posição. Algumas corretoras debitam cobranças separadas ou posteriores. Por isso `positionCostsComplete` começa `false`. Somente use `true` após comprovar, no extrato e na documentação da corretora, que **todos** os custos desse produto estão vinculados aos deals da posição. Quando isso não for verdade, falta o adaptador específico de alocação desses custos; mantenha o resultado como pendente, sem tratar a estimativa como lucro líquido final. O painel identifica os valores como enviados pelo ambiente do trader, sem confirmação independente da JENIOS.

Posições netting com entradas de outros robôs/manuais ou reversões não são distribuídas por suposição: ficam em conciliação. O acompanhamento se refere ao `magic` configurado, não a todas as operações da conta. Um cancelamento sem execução também fica registrado; encerramentos parciais não criam uma segunda entrada.

## Registros de outros conectores e continuidade

`import perfil.json recebimentos.json` recebe um lote `JENIOS_ULTRA_OPERATIONS_V1` com `provider`, `environment`, `accountFingerprint` e `operations`. Cada operação usa o contrato estrito de `lib/platform/ultra/operation.mjs`. O lote precisa corresponder ao perfil; o importador não autentica independentemente sua origem. Importar um arquivo não conecta a corretora. Apenas adaptadores com recibos nativos completos devem alimentar resultados definitivos.

O módulo `OperationLedger` oferece uma integração atômica para o futuro executor: grava a intenção e o registro inicial na mesma transação antes do envio. Transições e revisões ficam no disco; uma resposta desconhecida não autoriza repetir a ordem. O executor dos três mercados ainda não está liberado neste pacote. Os motores anteriores, suas regras e o aceite de alavancagem foram preservados.

Encerre o coletor antes de copiar a pasta `estado` para backup privado. Não substitua um diário existente por um vazio. Para renovar o código de sincronização, revogue o anterior no painel, gere outro para o mesmo conector/ambiente e preserve o diário. O histórico permanece e o reenvio não duplica o resultado da mesma conta/operação. Revogar o código impede novos envios; não pausa o robô, não remove posições e não revoga a chave da corretora.
