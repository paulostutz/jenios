# JENIOS Platform — B281, conferência auditável do primeiro candle futuro

**Data:** 21 de outubro de 2026. Base congelada B280: `e5c9671c3e926b380cef91ba5f21c22d59ac22de`, CI `39625425333` (sucesso). Produção original B177-R3 não alterada.

## Evidência original preservada antes do desfecho
O arquivo versionado `docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json` é a **cópia do artefato real do B280**, não uma reprodução de previsões após o fato. A verificação B281 exige que o arquivo tenha os mesmos horários, 18 registros, compromisso SHA-256, commit e run registrados publicamente no B280:
- SHA do registro: `3261fc220699d41c2e07ffd76f8d774b76ff9fd506ffed3e1ac066c2ec23f912`
- Commit: `e5c9671c3e926b380cef91ba5f21c22d59ac22de`
- Run GitHub: `39625425333`
- Registro: `2026-10-21 15:25:02.989 UTC`
- Candle-alvo: `2026-10-21 16:00:00–17:00:00 UTC`
- **Primeiro instante elegível para coleta: 2026-10-21 17:05:00 UTC** (14h05 no fuso America/Bahia, 21/10/2026).

A cópia do arquivo precisa passar pelo hash interno imutável e pelo código original `inspectB280SealedForecast`. O mero registro GitHub de execução antes do alvo é uma evidência cronológica pública razoável, **não um timestamp criptográfico com testemunha independente**.

## Comportamento no momento da CI
O workflow B281 inicia com `node --test` e `npm run build` para validar o código e proteger os módulos existentes. Em paralelo lógico, a etapa de rede é independente:
- **Antes de 17:00 UTC:** `PENDING_TARGET_CANDLE_CLOSE`, nenhum GET, nenhuma avaliação.
- **Das 17:00 até antes de 17:05 UTC:** `PENDING_FIVE_MINUTE_SAFETY_WINDOW`, nenhum GET, nenhuma avaliação.
- **A partir de 17:05 UTC:** `READY_FOR_READ_ONLY_SOURCE_QUERY`. O coletor pode fazer uma consulta HTTPS GET por ativo BTC-USD, ETH-USD e SOL-USD à fonte spot pública da Coinbase, sem credenciais.
- Se um ativo não possuir exatamente o candle-alvo de 16h UTC, se o candle estiver duplicado, inválido ou não puder ser consultado, grava-se `FAIL_CLOSED_NO_VALID_FORWARD_RESULT`. Os outros dois ativos não permitem inventar o terceiro.
- Quando houver três candles completos, não contraditórios, a função original B280 calcula **162 cenários matemáticos descritivos** (18 hipóteses × nove fricções). O relatório arquiva SHA-256 dos candles e estatísticas em unidades R, **não candles brutos**.
- CI aprovada significa código aprovado, não sucesso de consulta ou vantagem estatística. O relatório de rede deve ser lido separadamente.

## Avaliação: modelo, limites e risco
Os pares são **spot em USD**. Não são equivalentes a contratos USDT e não podem ser usados nos robôs proprietários. O modelo hipotético de uma hora aplica stop de 1% e custos ida-e-volta de 0/10/30 pontos-base e slippage adicional de 0/10/30 pontos-base. Não modela livro de ofertas, financiamento de posição vendida, latência real, execução parcial ou impacto da ordem. Uma amostra futura de uma única hora não valida vantagem: o gate B280 continua exigindo ao menos 30 dias, 300 horas e 100 observações úteis por combinação, mais fonte independente e controle de múltiplos testes.

A fonte REST pública utiliza arrays `[time, low, high, open, close, volume]`, no máximo 300 candles por pedido conforme a documentação Exchange. B281 limita a consulta a uma janela de 2 horas, só usa o candle das 16h e rejeita valores não finitos, timestamp desalinhado, preços inconsistentes, volume nulo, pares diferentes, HTTP não aprovado ou rate limit. A resposta HTTPS não inclui assinatura de cotação; logs de CI não certificam a autenticidade do mercado.

## Backups, execução futura e veracidade
Este bloco **não instala um cron, não executa ordem em Paper nem ativa um serviço de monitoramento**. O workflow possui `workflow_dispatch` para execução explícita posterior ao fechamento. O resultado ainda não pode ser declarado observado antes da janela temporal. O runner arquiva o estado `PENDING` se rodar cedo, e os testes usam dados **sintéticos isolados**, jamais apresentados como resultado real.

Mantêm-se inalterados: Universidade (15 aulas ilustradas e 13 aprofundamentos), Social, Gênio/Gênia, JENIOS PAY, BankScore, Validador, integrações, núcleos proprietários, Letter e Chefe. **Sem deploy**, Pix, cobranças ou ordens.

## Critérios para B281 homologado
Escopo aditivo estrito: snapshot original versionado, módulo de validação, runner, testes, documentação, script de integridade e workflow CI, num total de sete arquivos. CI deve ter sucesso com commit igual ao checkpoint, sem drift de nenhum arquivo protegido. Se a captura ainda não for temporalmente possível, certificar o código, registrar o snapshot e manter a avaliação observacional como **pendente**, não concluída.
