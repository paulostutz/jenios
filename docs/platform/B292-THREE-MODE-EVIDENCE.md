# JENIOS B292 — integração de contratos de evidência dos três modos

Base certificada B291 `694b627fbe21f169bb17b9cecbe15ebd76a43d9e`, CI 39659642881. Somente novos arquivos de pesquisa offline. **Não há integração aos motores proprietários**.

- **Híbrido:** conecta a leitura já existente de candles fechados (EMA12/26, RSI, estocástico, ATR, volume, rompimento) ao classificador B291, que devolve apenas contexto ou espera. Nenhum preço de entrada, stop, meta, ativo recomendado ou ordem é inventado.
- **Manual:** valida cronologia do sinal recebido, registro e entrega declarados; alerta educativo após sequência de perdas verificadas. Não verifica provedor real de entrega.
- **Reverso:** valida transformação de comando fornecido, veto de megatendência e ciclo de cancelamento/fechamento. Não acessa contas de corretoras.
- **Gênios:** apenas texto explicativo estático sobre o contexto já calculado; nenhuma chamada a modelo generativo nem autonomia de execução.

## Evidências ainda necessárias para a certificação funcional real

1. Exportador autorizado **somente leitura** de eventos genuínos dos motores privados e de operações do próprio cliente; identidade SHA do executável.
2. Registro externo de entrega efetiva dos sinais, timestamps e controle de duplicidade.
3. Teste de integração com B152 e fluxo de ordens isolado, sem enviar ordem real ou Paper.
4. Verificação de cotações independentes, custos e amostras prospectivas; Lossômetro deve distinguir contrafactual de resultado observado.
5. Testes de IA generativa sob limite de custos e respostas ancoradas, sem permissão para enviar comandos.

Esta CI não demonstra rentabilidade nem desempenho do núcleo proprietário. Não promover produção, não criar cobrança e não misturar CHEFE/LETTER.
