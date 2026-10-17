# JENIOS R41 — validação histórica congelada dos robôs

**Data:** 16/10/2026 (UTC). **Checkpoint documental:** código privado NÃO enviado ao repositório público. Nenhuma alteração de produção, Banco Inter, Social ou trading real.

## Protocolo anterior à coleta
- Compromisso de pesquisa publicado no commit [b43a752e961426bb561a11063248657fc142c338](https://github.com/paulostutz/jenios/commit/b43a752e961426bb561a11063248657fc142c338), antes de baixar o novo lote de dados.
- Fonte registrada: Binance Vision USD-M (futuros), BTCUSDT/ETHUSDT/SOLUSDT, intervalos 1h/5m, julho/2025–setembro/2026; janelas 2025H2, 2026Q1 e 2026Q2Q3.
- 90 arquivos mensais ZIP e 90 CHECKSUM associados, com SHA-256 correspondente, 427.752 candles; conciliação de 12 candles 5m para cada OHLCV horário exata nos três ativos.
- Embora o protocolo preceda esta coleta, os preços são **históricos**, não negociações prospectivas. Checksums confirmam integridade dos snapshots obtidos, não um extrato bancário ou confirmação da exchange de ordens executadas.

## Validação e resultados
- Código de sinais proprietário `engine.mjs` preservado da R40 com SHA-256 `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea`. A otimização de busca temporal provou equivalência; não foram alterados sinais para favorecer retorno.
- **6.595 oportunidades hipotéticas**, 6 grupos mercado/intervalo (BTC/ETH/SOL, 1h/5m). Resultados demonstrados por histórico real com execuções simuladas, custos fixos e sem funding.
- **Cinco minutos:** BTC direto −8,30%, oposto −8,18%; ETH direto −8,26%, oposto −6,67%; SOL direto −8,27%, oposto −7,47%. O benchmark não operar fica em 0%. São carteiras separadas e sujeitas a risco/trades distintos.
- **Uma hora:** BTC direto −2,83%, oposto −0,48%; ETH direto −0,73%, oposto +0,40%; SOL direto +0,98%, oposto −1,44%. Não há replicação convincente.
- Diferença média oposto−direto ao agrupar os ativos: 1h +0,197 R/sinal, intervalo semanal descritivo 95% [−0,408, +0,850]; 5m +0,042 R/sinal [−0,072, +0,156]. Ambos **incluem zero**. Sinais se sobrepõem, mercados correlacionados, múltiplos estudos; não é prova de eficácia.
- `chooseMode` real também testado com **intenções fictícias**. Modo híbrido piorou resultados hipotéticos em BTC5m 180, ETH5m 221 e SOL5m 211 decisões; não são registros de clientes.
- Política experimental causal de pesquisa distinta do robô comercial usou apenas sinais encerrados; obteve retorno de carteira negativo nos três mercados 5m.
- Taxa-base de 10 bps por lado + slippage de entrada e saída, com estresse extra 10/25/50 bps por lado: resultados líquidos pioram. Regras atuais cobram slippage adicional nas saídas por stop/gap/tempo, documentadas. Não foram simulados funding real, liquidação, spread variável, ordem no livro, rejeição de corretora ou market impact.
- **Gatilho de 8%** não é teto garantido de perda: em alguns backtests o desvio resultante passa de 8% antes do bloqueio de novas posições.

## QA efetivamente executado
- **471 testes do núcleo privado**, 0 falhas / 0 ignorados, após estabilização da suíte;
- **674 testes da aplicação**, 0 falhas;
- **355 arquivos** na verificação de sintaxe; Next.js 16/Webpack build aprovado com placeholders QA não funcionais;
- Verificação portátil dos 90 arquivos oficiais e SHA-256; 6 conjuntos normalizados e 1h/5m íntegros;
- Duas auditorias independentes de cálculo coincidem em seis símbolos/frequências; repetição determinística dos resultados BTC1h idêntica byte a byte;
- PDF de cinco páginas renderizado e revisado. Nenhum pedido/pagamento/ordem real executado.

## Backups privados da R41
- Pacote cumulativo **JENIOS-Platform-R41-FINAL-VALIDADO.zip**, Biblioteca `/JENIOS-Platform-R41-FINAL-VALIDADO.zip`;
- **82.442.843 bytes, 955 entradas ZIP** (954 arquivos de conteúdo mais manifesto). Integridade ZIP e SHA-256 dos 954 arquivos verificados;
- SHA-256 do pacote: `2c2d981db751f9c35f0b89640322356fa7af263aa84e1062059e24c2d84eb11c`;
- ZIP da fonte oficial `JENIOS-R41-90-ARQUIVOS-USDM-VERIFICADOS.zip`: 45.455.671 bytes, SHA-256 `412ddd8f4caef7dfdbc633940ab831519ad5eabe41e2db2f6087a114e8152b76`;
- Laudo PDF na Biblioteca: `/JENIOS-R41-Relatorio-Historico-Robos.pdf` e incluído no pacote privado.
- O núcleo de pesquisa e os históricos NÃO foram enviados ao GitHub público por este checkpoint.

## Próxima prova que falta
A política adaptativa comercial não foi aprovada: resultados intradiários no papel negativos, incerteza inclui zero, intenções de clientes não observadas. A próxima fase deve ser **piloto prospectivo sem dinheiro real** com intenção original e recomendação do robô registradas externamente antes do mercado, execução em ambiente de demonstração, dados de spread/funding/margem, estatísticas líquidas e validação de risco. Não retreinar ou ajustar retroativamente usando a janela R41 e depois chamá-la de holdout.

**Estado definitivo da R41:** `technicalQA=PASS`, `marketProfitabilityVerified=false`, `realCustomerLossAvoidedProven=false`, `brokerExecutionHomologated=false`, `liveExecution=NO_GO`, `publicPlatformDeployment=NO_GO`. GitHub main permaneceu no SHA `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10` (R35).
