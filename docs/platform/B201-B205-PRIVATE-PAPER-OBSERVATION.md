# JENIOS Platform B201–B205 — observação dupla, risco e recuperação de ordens Paper

Referência: 20/10/2026. Base imutável B200: `3121ab13c6de8dfc11ddf7d38f496d454ca2caa1`.
Este material integra **apenas** JENIOS Platform em homologação isolada. Não substitui a API oficial de nenhuma corretora e não cria uma rota pública para negociar. Social, Gênios, Universidade, BankScore, Validador, JENIOS PAY, código privado dos robôs e produção são preservados.

## Construído

- **B201:** leitor privado de duas consultas GET oficiais Alpaca Paper para `client_order_id`. Reutiliza cofre criptografado B165, leitor de identidade B166 e preflight B196, com refresh server-role do vínculo antes de **cada** GET. Usa URL fixa `paper-api.alpaca.markets`, HTTPS, método GET, redirecionamentos proibidos, corpo limitado a 64 KiB e intervalo entre consultas. Se a corretora responder 404, ocorre erro, alteração de identidade, credencial revogada, timestamps inválidos ou payload inconsistente, o resultado é desconhecido/revisão — **nunca rejeição presumida ou reenvio**. Não exporta credenciais, identificadores externos nem corpo bruto. Mesmo com dois GETs, não certifica testemunho independente.
- **B202:** cruza, sem mutações, o registro de risco B152 (SQLite) e o diário de tentativa única B178, juntamente com a comparação B201. Detecta falta de recibo, conflito entre risco e diário, preenchimento regressivo e estado desconhecido. Nenhuma transição é gravada; não libera reservas, não recupera ordens e não repete envio.
- **B203:** inventário de reinício dos dois armazenamentos SQLite existentes. Identifica tentativas já reivindicadas, ordens PREPARED, estados ambíguos e exposição aberta. Registro preparado antes de crash **não é permissão de envio**, e uma tentativa IN_FLIGHT jamais pode ser automaticamente reclamada. Não fecha posições ou cancela ordens.
- **B204:** dossiê redigido para revisão humana. Admite somente contratos B201–B203, recusa campos de credenciais/identificadores, calcula SHA-256 dos campos explícitos e emite ações humanas pendentes. Esse hash **não é uma assinatura**; aceitar ou clicar um campo no painel não prova permissão da corretora ou liberação do produto.
- **B205:** teste de integração com SQLite e duas respostas GET simuladas, testes adversariais, controle aditivo de escopo, regressão completa e browser smoke via GitHub Actions; cria fonte e evidências com hashes quando todos os jobs forem aprovados.

## Escopo exato da homologação

Os testes usam `Response` e outras fixtures controladas. Mesmo que um teste execute a função que monta as duas URLs GET oficiais, ele **não** autentica ou consulta uma conta externa real sem credenciais e autorização privadas. O código novo não é importado por nenhuma rota Next.js e não instala um daemon/worker persistente. As flags de execução do transporte Paper permanecem inativas na CI; nenhuma ordem, cancelamento, pagamento, saque ou posição real ocorre.

### Exemplos de incidentes bloqueados

1. `GET 404` após envio ambíguo: não classificar como rejeitada, não liberar a reserva, não reenviar.
2. Parcial antiga e leitura atual inferior ao preenchido no B152: conflito crítico sem alterar o ledger.
3. Reinício depois de uma tentativa marcada IN_FLIGHT: manter `attempts=1`, exigir consulta independente à corretora e conferência operacional.
4. Revogação/rotação entre as duas consultas GET: abortar antes da segunda chamada.
5. Dados falsos de conta ou outra identidade: rejeitar o escopo.
6. Stop/alvo apresentados em fixture: não supor execução garantida nem proteção ativa na corretora.

## Etapas operacionais ainda pendentes

- Contratar/configurar **somente mediante autorização específica** um worker privado durável fora da Vercel, armazenamentos cifrados, alertas, monitoramento, rotinas de rotação/revogação, backup e revisão de limites de perda.
- Registrar por canal seguro uma conta voluntária **Alpaca Paper**, obter consentimento e permissões específicas, auditar GETs autenticados e restrições de mercado, horários e dados. A JENIOS não mantém custódia nem recebe aportes de clientes.
- Autorizar separadamente a realização de testes Paper externos, registrar ACK, rejeição, execução parcial, timeout, posições e duas pernas de proteção por chamadas oficiais. O simples mock não certifica a integração.
- Coletar e auditar amostras prospectivas do motor original, com custos, slippage, spread, funding, latência, drawdown, regimes de mercado e resultados negativos. O B182 permanece **research-only, sem prova de vantagem econômica**.
- Homologar faturamento/renovação JENIOS PAY com os prestadores responsáveis, em trilha independente da negociação; sem cobranças simuladas classificadas como reais.
- Liberar operações com dinheiro real **apenas** depois de autorização específica, análise independente de segurança/conformidade e homologação externa suficiente.

## Matriz de status confiável

| Etapa | Situação |
|---|---|
| Código de leitura, reconciliação e recuperação | Desenvolvido em QA; confirmar CI B205 |
| Testes sem rede e SQLite real | Regressão de código, sem conta externa |
| Worker privado persistente | Não implantado |
| Conta externa autenticada e permissões auditadas | Não realizada |
| Ordens demonstrativas externas | Não autorizadas/não transmitidas |
| Avaliação prospectiva independente dos robôs | Pendente |
| Cobrança comercial automática certificada | Não certificada por este bloco |
| Dinheiro real | NO_GO |

Documentação da instituição: https://docs.alpaca.markets/us/docs/orders-at-alpaca e https://docs.alpaca.markets/us/reference/getorderbyclientorderid.
