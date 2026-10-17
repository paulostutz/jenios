# JENIOS Platform R43 — checkpoint publico sanitizado
**Data:** 2026-10-17 UTC. **Escopo:** APENAS pesquisa offline dos robos de negociacao da JENIOS Platform; projeto LETTER excluido.

## Evidencias verificaveis sem codigo proprietario
- Base publica: `research/jenios-r43-verified-mark-price` em `c03b39ee0110d5365bd8ea275a34abe3281ef9bc`.
- Binance Vision USD-M: 90 arquivos mensais oficiais de `markPriceKlines` (BTCUSDT/ETHUSDT/SOLUSDT, 1h e 5m, julho/2025 a setembro/2026), todos ZIP+CHECKSUM SHA-256 conferidos. A coleta detectou **lacuna de 29/06/2026 nos seis arquivos de junho**, apesar dos hashes oficiais corretos.
- Emenda pre-documentada: 6 arquivos DIARIOS oficiais do mesmo dia, ZIPs e CHECKSUMs auditados; recomposicao documental sem estimativa de preco, mantendo intactos os arquivos mensais defeituosos. Cobertura final: **427.752 candles de mark price**.
- Auditoria mensal: https://github.com/paulostutz/jenios/actions/runs/38990006932 — execution success with partial data defect intentionally reported. Recuperacao diaria: https://github.com/paulostutz/jenios/actions/runs/38990294042 — success, six official daily checksums.
- SHA256 do artefato GitHub Actions mensal: `311a1faec2b7fd620a376582e23f3df5336cf08806746d11a4007d57b9acc22b`; diario: `9e95a89d028be7ddfc5304b63a22de7ab2fa760b0d56c97c2f550a5d4b94ed69`.
- Pesquisa privada R43: 6.595 sinais retrospectivos, 2.150 oportunidades pareadas sobre dados ja examinados, intencoes humanas **sinteticas**; 485/485 testes do nucleo, nenhuma falha, nenhum teste ignorado.
- Copia R42 imutavel: **1.062/1.062 arquivos herdados iguais SHA256**; testes de aplicacao da R40 (674 no antigo registro) **nao reexecutados nesta R43**.

## Resultado e limites
- Em 5 minutos o hibrido continua desfavoravel nas tres series de ativos; ganhos relativos isolados ou de pequena amostra NAO comprovam retorno.
- Funding oficial foi convertido com PRECO DE ABERTURA DO CANDLE MARK como proxy (nao tick de liquidacao/settlement real).
- Margem de manutencao e alavancagem so em HIPOTESES; maximas/minimas mark sao alertas de possivel cruzamento e nao liquidacoes comprovadas.
- Ainda NAO ha decisao real do cliente, fills, spread realizado, comissao/tier observado, tabela historica completa de manutencao, verdadeiro teste prospectivo ou rentabilidade verificada.
- Gate FINAL: `liveTrading=false`, `financialEdgeVerified=false`, `clientLossAvoidedVerified=false`, `deploy=false`, `merge=false`, `releaseGate=NO_GO`.

## Arquivo de recuperacao privado, fora do GitHub
- Biblioteca privada: `/JENIOS-Platform-R43-completo-privado.zip` (1.088 membros, 1.087 arquivos de conteudo, manifesto SHA256 de cada arquivo).
- SHA256 ZIP: `2fcef8ffa121148509fb92b08d63a600cddf6fb495f94e933659b71eebec134b`.
- PDF privado: `/RELATORIO-VALIDACAO-ROBOS-R43.pdf`. NUNCA publicar motor privado, ativos de cliente ou credenciais no GitHub.
- Producao `main` conferida: `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10`, NAO alterada.

Proxima etapa (R44): piloto prospectivo somente em papel, snapshots autenticos de livro, taxas por tier, regras historicas de margem e revisao estatistica independente ANTES de qualquer reconsideracao do gate.
