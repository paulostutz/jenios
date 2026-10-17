# JENIOS Platform R44 — checkpoint publico, sem motor privado
**Data:** 2026-10-17 UTC; exclusivo dos robos JENIOS, sem misturar com LETTER.

## Evidencias
- Origem: branch de pesquisa `research/jenios-r44-archive-depth-qa`, SHA `5618c130a568f5f47c4e7848ee0fa054583f0137`.
- Protocolo forward anterior a captura SHA `a730c2614369c152deaf57e0b7cb6a2eda20bb14`.
- [GitHub Actions forward public read-only](https://github.com/paulostutz/jenios/actions/runs/38991726868) — **FAIL** devido a 10 respostas HTTP 451 do endpoint Binance USD-M `fapi.binance.com`. Zero snapshots validos, zero operacoes ou sinais reais. Nenhuma fonte foi substituida para encobrir a falha.
- [GitHub Actions archived bookDepth](https://github.com/paulostutz/jenios/actions/runs/38992246949) — **PASS**, seis fontes oficiais ZIP+CHECKSUM SHA-256 auditadas (BTC/ETH/SOL, 02 e 06/09/2026).
- Arquivos `bookDepth` agregados possuem 2.880 snapshots por dia por ativo, mas as bandas implícitas +0,2% têm somente 3 (BTC), 2 (ETH) e 4 (SOL) valores distintos no dia 06/09 vs. 2.880 / 2.880 / 2.879 no dia 02/09. Os tres registros de 06/09 estao em quarentena para qualquer inferencia de qualidade; nenhum arquivo de banda serve como preenchimento, VWAP ou spread executavel.
- Estudo historico com essas duas datas foi escolhido APOS um problema publicamente reportado (`binance/binance-public-data#496`); **nao** e holdout independente.
- Regressao privada R44: **556/556 testes do nucleo aprovados, 71 novos**, 0 falhas; integridade SHA256 de **1.088/1.088 arquivos herdados da R43** verificada. Testes completos Next.js da aplicacao nao reexecutados aqui.

## R44 privado, nunca publicar no GitHub
- Biblioteca privada: `/JENIOS-Platform-R44-completo-privado.zip`.
- Arquivo ZIP de 81.077.635 bytes, **1.119 membros** (= 1.118 arquivos de conteudo + manifesto).
- SHA256 ZIP `70b3d1c3dd3ebd36fc5d5f12f25f5a43a3e2c4e5ae07f6bfec1dc59d59b19d46`.
- ZIP CRC e SHA256 de cada item validado, inclusive os codigos e bancos de dados de pesquisa originais.
- O codigo privado contem `market-observation-r44.mjs` e `forward-paper-journal-r44.mjs` somente no backup nao publicado.
- PDF na Biblioteca: `/RELATORIO-VALIDACAO-ROBOS-R44.pdf`.

## Declaracao obrigatoria
- **Nao existe amostra prospectiva valida de sinais reais nesta revisao.** Nao afirmar retorno, Sharpe, rentabilidade comprovada ou perdas de cliente evitadas.
- Os cenarios do estimador L2 usam fixtures de teste, nao fills. O diario SHA256 nao tem carimbo externo irrefutavel.
- `realTrading=false`; `moneyTrading=false`; `deploy=false`; `merge=false`; `privateCorePublic=false`; `financialEdgeVerified=false`; `releaseGate=NO_GO`.
- Aplicacao e banco de dados em producao nao alterados; main permanece no SHA `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10`.

Próximo gate R45: fonte licita de livro de ordens corrente, pre-registro externo de intenções e sinais, paper piloto com varias sessoes, fills/custos observados, regras de margem e revisao independente. Sem bypass de HTTP 451.
