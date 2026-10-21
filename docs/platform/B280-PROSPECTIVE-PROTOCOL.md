# JENIOS Platform — B280: protocolo prospectivo e bloqueio de alegações operacionais

Data: 21/10/2026. Base imutável: B279 `fb9441d3485d0c825cd3e7705c3de33fb1e74515`, CI `39621762657` aprovada. Produção: `jenios-ecossistem`, B177-R3 intocada.

## Finalidade
O B279 testou 162 cenários retrospectivos com preços spot em USD e não apresentou resiliência no cenário adverso 30/30 bps. O B280 **não reotimiza essas hipóteses nem corrige o resultado por conveniência**. Ele congela exatamente as duas famílias `EMA_CONTEXT_V1` e `CLOSED_BREAKOUT_V1`, observadas em modo direto, reverso e híbrido, exclusivamente como **18 rótulos analíticos futuros** (três ativos spot USD × duas hipóteses × três modos). Nunca são sinais, recomendações ou ordens.

## Congelamento anterior ao futuro observado
`lib/platform/research/b280-forward-protocol.mjs` contém parâmetros e hash SHA-256 do protocolo, vinculado ao commit B279 e criado em branch própria. A CI pode executar `scripts/platform/research/b280-capture-future-hour.mjs` uma vez: consulta públicos H1 por GET de BTC-USD, ETH-USD e SOL-USD, valida 960 candles fechados por par, computa apenas um contexto de estudo a partir dos candles existentes e **registra os 18 rótulos antes da abertura de um próximo candle futuro**. A diferença entre o registro e a abertura futura é de pelo menos dez minutos. O histórico usado fica registrado por SHA-256, sem redistribuição de OHLCV bruto.

O candidato de evidência inclui ID da execução GitHub Actions, commit, horário capturado, timestamp futuro e selo SHA-256 do conteúdo. O registro no GitHub proporciona rastreabilidade externa do run, mas **não é assinatura independente de cotações nem carimbo de tempo criptograficamente certificado**.

O workflow B280 é disparado no push e opcionalmente manualmente. **Não inclui agendamento recorrente automático** e não promete observações futuras já coletadas. Nova amostragem só pode ocorrer com execução posterior apropriada, mantendo os artefatos anteriores como evidência; o algoritmo nunca reescreve o registro anterior.

## Separação das fontes de dados
Os pares BTC-USD/ETH-USD/SOL-USD **não são** os pares BTCUSDT/ETHUSDT/SOLUSDT. Não há conversão implícita, funding ou simulação de margem. As credenciais dos clientes, rotas de corretoras, executor privado, JENIOS PAY e núcleos proprietários são protegidos pela CI.

## Critérios temporais e análise futura
- A previsão só pode ser arquivada após 21/10/2026 15:09 UTC, antes de um candle que **ainda não abriu** e com no mínimo dez minutos de antecedência.
- A série de origem permanece totalmente fechada, com alinhamento horário, janela igual para três ativos e identidade da fonte explicitamente não assinada.
- **O candle futuro só pode ser avaliado depois de seu encerramento + cinco minutos**, por função isolada `scoreB280FutureClosedHour`. Essa função é testada com candles fictícios, **não representa resultados efetivamente observados**.
- Custos ida-e-volta: 0/10/30 bps; slippage adverso no stop: 0/10/30 bps; stop hipotético de 1%, sem garantia de fill. Por conjunto de 18 rótulos surgirão até 162 avaliações descritivas, se e quando houver observações futuras. Ausências geram nulo, nunca sinal positivo.
- Posições vendidas, empréstimos, financiamento, livro de ofertas, latência e execução real NÃO estão validados.

## Travas estatísticas, sem autoaprovação
`lib/platform/research/b280-statistical-gate.mjs` prepara uma avaliação de cobertura e impede conclusão a partir de poucos pontos:
- pelo menos **30 dias UTC distintos**, **300 horas-alvo diferentes** e **100 observações não nulas por ativo/hipótese/modo**;
- registro anterior ao alvo com testemunho temporal externo verificável;
- segunda fonte de preços auditada, dados assinados quando disponíveis e reconciliação realista das execuções;
- intervalos estatísticos ajustados à autocorrelação, múltiplos testes e custos adversos;
- registro também de perdas, exceções e hipóteses não aprovadas.

O módulo informa cobertura meramente descritiva. Mesmo com 30 dias e 300 eventos, **não certifica vantagem**, não muda parâmetros, não habilita ordens ou deploy. Autenticação da fonte, comportamento operacional e aprovação humana continuam pendentes.

## Etapas da CI
1. `node scripts/platform/research/b280-integrity.mjs`: compara bytes com B279 e rejeita qualquer mudança fora de sete arquivos inéditos.
2. `node --test tests/platformB280ForwardProtocol.test.mjs`: teste sintético de selo, antecipação temporal, integridade dos três ativos, prevenção de vazamento e negação de scoring antes do futuro, 162 combinações hipotéticas e gate estatístico.
3. Tentativa separada de captura pública real B280. Falha de rede/qualidade produz `FAIL_CLOSED_NO_PROSPECTIVE_PREDICTIONS`; não é tratada como sucesso da amostra.
4. `npm run build` executa regressões completas e build Next.js; a aprovação da CI não implica captura bem-sucedida.
5. Arquivo GitHub artifact somente com compromisso, manifestos, hashes e documentação. Sem preços brutos redistribuídos, Pix, contas reais nem ordens.

## B281 e publicação
Somente após o primeiro candle futuro ter realmente encerrado é possível começar a comparar resultados. Repetições futuras independentes, dados de execução e aprovação explícita serão necessárias. Os resultados retrospectivos B279 permanecem negativos sob estresse; nenhuma alteração do motor proprietário foi autorizada.
