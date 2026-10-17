# JENIOS Platform R41 — checkpoint público sanitizado
**Registro:** 17/10/2026 UTC. **Escopo:** apenas trilha de pesquisa de robôs de negociação JENIOS. Não se refere à LETTER.

## Base de pesquisa preservada
- Branch base: `research/jenios-r41-futures-1h-5m-heldout` no commit `cdc8caeb46dc7ae17b6550184b723e744f6ffa5c`.
- Produção `main` observada: `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10`, não alterada.
- ZIP oficial de dados USD-M 1h/5m: SHA-256 `412ddd8f4caef7dfdbc633940ab831519ad5eabe41e2db2f6087a114e8152b76`.
- A base possui 90 arquivos mensais (ZIP + CHECKSUM) e 427.752 candles normalizados em 6 séries.
- Backtest histórico offline concluído: 6.595 sinais / 2.150 oportunidades pareadas com tempo máximo de permanência fixo.
- QA privada: 432/432 testes do núcleo; 870/870 arquivos da R40 idênticos por SHA-256. Os 674 testes da aplicação referem-se ao checkpoint anterior, não a uma nova execução R41.

## Limitações e gate
- Estudo exploratório, retrospectivo; intenções dos operadores foram **inventadas**, sem registro real de clientes.
- Comparação originalmente testada foi retificada depois de conhecer os dados: seleção de entradas com cooldown fixo independentemente das saídas contrafactuais. Resultados anteriores permanecem no backup privado; não se trata de confirmação pré-registrada.
- Os resultados de 5 minutos não demonstraram viabilidade econômica sob as taxas e slippages assumidas. Funding real, livro de ofertas, fills e liquidação não foram modelados.
- **GATE = NO_GO** para dinheiro real, deploy e alegação de rentabilidade ou perdas efetivamente evitadas.

## Backup privado NÃO versionado publicamente
- Biblioteca privada: `/JENIOS-Platform-R41-completo-privado(2).zip` (940 arquivos; motor proprietário, evidências e fontes históricas).
- SHA-256 do backup: `3535896957ae902b57f52935be3707c6ef46e3791d42cc4c177e4e8306336c0f`.
- PDF: `/RELATORIO-VALIDACAO-ROBOS-R41(2).pdf`, armazenado na Biblioteca privada.
- **NUNCA** incluir ZIP privado, dados de cliente, motores, segredos, logs internos, APIs ou código proprietário neste repositório público.

Este checkpoint não altera API, Banco Inter, Supabase, Social, BankScore, JENIOS PAY, main, merge ou produção. Não habilita trading.