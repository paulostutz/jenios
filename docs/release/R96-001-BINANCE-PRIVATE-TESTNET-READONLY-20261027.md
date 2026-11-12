# JENIOS R96.001 — Binance Spot Testnet privado, somente leitura
Data: 27/10/2026. Projeto JENIOS, PR #22 DRAFT.
## Reutilização de backups
Confirmados B165–B169 (cofre, autenticação e leitor Binance B166), B171–B173 (propostas/observações), R74 (núcleo sintético), R93 (integração de recuperação Alpaca) e R95 (preflight local do host). Nenhum conector foi reconstruído.

## Evidências anteriores
R95 SHA `f6e086405340694e45a39a49d482a7aa7d48ca9d`, GitHub Actions run 40560731467 SUCCESS, 112/112 privados, 1774/1774 gerais, 94/94 Social. Vercel JENIOS Preview `dpl_E8sbnEm8UY7MJxgtZZCTgRxHkjZj` READY.
Produção R79 SHA `a24922cc829dd1b45b87a719e9fd57ab45e6d79b` preservada, sem merge.

## Entrega R96
- `binance-private-readonly-r96.mjs` consulta somente Binance Spot TESTNET usando reader B166, cofre AES-256-GCM B165 e repositório service-role B167, após verificar sessão titular da Platform, conexão Testnet ativa, digest HMAC e leitura oficial recente.
- Nenhum ID externo bruto ou chave é retornado; saldos spot não são posições de futuros e consulta GET não certifica direitos de negociação, proteção OCO/stop ou capacidade de enviar ordens.
- Guarda explícita impede web/Vercel, produção, flags Live/Paper POST e pagamentos.
- Testes com respostas sintéticas e assinatura HMAC conferida, identidade divergente, proprietário forjado, UID ausente, conta revogada e recusa de execução.
- S05/R84 e variáveis específicas na Vercel obrigatoriamente desabilitam as duas flags R96 no Preview web.
- Nenhuma migração, conta, API pública, Pix, cobrança ou ordem externa foi criada.

## Gates pendentes
A conexão autêntica Binance Testnet depende de cadastro próprio voluntário, credenciais somente no cofre da área privada e recibos oficiais em ensaios separados. O worker persistente pago ainda não foi provisionado; R95 não certifica mount entre deploys. Kill switch, recebimentos, reconciliação e revisão independente continuam obrigatórios antes de executar ordens e, especialmente, qualquer Live.
Conferir CI e Preview do SHA exato desta entrega antes de classificar como testada. Preservar CHEFE/LETTER, R74 e produção R79.
