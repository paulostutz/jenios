# JENIOS R38.3 — validação privada dos robôs e loss contrafactual evitado
**16/10/2026 — checkpoint documental, sem publicação**

## Estado da produção
- GitHub `main` consultado antes deste checkpoint: `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10` (R35).
- Social R34 e proteção de checkout R35 permanecem sem mudança; **R36–R38 são pacotes privados**, não enviados à `main`.
- Nenhuma API, conta, ordem, cobrança, credencial ou banco real foi modificado.
- A tecnologia de negociação com dinheiro real continua bloqueada (`executionEnabled=false`, `releaseGate=NO_GO`).

## R38.3: refinamentos concretos
- Validação estrita da sequência temporal de candles no motor de replay; rejeita candles inválidos, duplicados, fora de ordem e séries com gaps na importação.
- Importador offline para OHLCV UTC e conversor para arquivo de 12 colunas da Binance Vision, com trilha SHA-256 e checagem de timeframes fechados.
- Pesquisa pareada com decisões originais hipotéticas vs intervenção `preserve`, `reverse`, `abstain`, orçamento nominal igual, custos e slippage.
- Pesquisa em cenário completo inclui perdas brutas hipoteticamente evitadas, ganhos adicionais, degradação, lucros sacrificados e novas perdas. Erros da adaptação são expostos.
- Auditoria recusa contabilidade inconsistente e alteração de lados/horários mesmo que o hash local seja recalculado.
- Relatório determinístico PDF/Markdown/CSV/JSON e manifesto de integridade; diferencia sintético, histórico ainda não verificado, e prova externa de intenções.
- Teste propositalmente adversarial com 4 cenários **100% INVENTADOS**: perdas brutas hipoteticamente evitadas R$220; ganho sacrificado R$380; novas perdas R$110; saldo líquido **-R$80**. Este exemplo prova que o relatório não deve selecionar somente resultados positivos; **não demonstra performance de mercado da JENIOS**.

## Bateria concluída (logs no pacote)
- **190 testes do núcleo privado aprovados**, 0 falhas/0 skips.
- **674 testes da aplicação preservada aprovados**, 0 falhas/0 skips.
- **355 arquivos da aplicação verificados na sintaxe**, build Next.js concluído com QA fictício.
- **35.000 cálculos determinísticos de risco** são executados como parte dos testes R38; não são backtests com dados de corretora.
- **501 arquivos da aplicação da R37 idênticos byte a byte**. Todos os 739 arquivos anteriores foram preservados.
- O motor privado `engine.mjs` foi modificado apenas para rejeitar dados inconsistentes e impedir estatísticas não finitas; regras de geração de sinais não foram alteradas para produzir falsa rentabilidade.
- Não foram obtidos nesta sessão arquivos históricos Binance com checksums oficiais, nem intenções reais de clientes datadas antes dos movimentos do mercado.

## Backup permanente
- Biblioteca: `/JENIOS-Platform-R38-completo-privado.zip` (arquivo integral cumulativo R25–R38).
- Tamanho **8.870.562 bytes**, **768 entradas** ZIP, **767 arquivos** no manifesto.
- SHA-256 do ZIP: `e8335ed8136f47910a51937a26450c960ac1e663b983a0582c661a48f682eb5f`.
- ZIP integral, CRC e SHA-256 dos 767 arquivos verificados; não inclui node_modules ou builds.
- Contém motor privado, app R37, logs, testes, relatório PDF e exemplo sintético. **Não publicar este ZIP ou o motor privado no GitHub público.**

## Critérios de validação ainda pendentes
1. Ingestão de meses de cotações reais (BTC/ETH/SOL e cenários variados) com checksums originais, taxas verificáveis e escolha do instrumento spot/futuros.
2. Versão/ajustes congelados antes de holdout, com teste independente fora da amostra e custos conservadores.
3. Log autenticado e datado **antes da decisão** da intenção original de cada operador, recomendação do robô e execução ou bloqueio atestados pela corretora, nunca só pelos hashes locais.
4. Estatísticas de *uplift* líquido pareado, lucros sacrificados, perdas novas, intervalos por sessão e resultados sequenciais sem sobreposição de ordens.
5. Piloto prospectivo em ambiente de demonstração, com supervisão de risco e revisão independente.

**Status:** pesquisa técnica/QA avançou e passou, mas **perdas reais de clientes evitadas e rentabilidade adaptativa não estão comprovadas**. Uso de dinheiro real: NO-GO. Este checkpoint não aciona deploy.
