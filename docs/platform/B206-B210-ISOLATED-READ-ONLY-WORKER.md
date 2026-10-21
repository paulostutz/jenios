# JENIOS Platform B206–B210 — worker de observação Paper isolado (código certificado, implantação pendente)

Data: 20–21/10/2026. Base imutável: B205, commit `d69a0c51258f3f6750dabd7458f549f0792155c8`.
Escopo exclusivo: JENIOS Platform. **Não** publica produção, ativa corretora, instala infraestrutura, executa ordem externa, retreina robôs ou realiza cobrança.

## Entregas de engenharia (novas, aditivas)

- **B206:** barreira executável GET-only com lista exata de endpoints Alpaca Paper, orçamento máximo de 5 chamadas oficiais por ciclo. Exige ambiente privado isolado, cofre já existente B165, flags Paper de leitura, um segredo adicional distinto do transporte B179 e um comprovante HMAC de leitura válido por até 120 segundos. Nunca autoriza POST/DELETE, `Live`, saques, retries ou custódia. O comprovante técnico é uma autorização **interna de leitura**, não prova de consentimento legal ou aprovação da corretora.
- **B207:** banco SQLite durável para auditoria de leituras, separado do livro de risco B152 e outbox B178. Escopo armazenado em HMAC por proprietário/conexão/ordem/ciclo. Evita concorrência, reaproveitamento de auditId e execução automática após crash/timeout. Guarda somente códigos e digest SHA-256 sanitizados. Exige diretório e arquivos restritos ao proprietário. Retomar um ciclo exige **novo** auditId e nova aprovação humana.
- **B208:** orquestra uma única auditoria privada, sem transmitir ordens: valida usuário e conexão com B175, leitura de conta B196/B166, 2 GETs B201, livro/outbox B202, inventário de reinício B203 e relatório sanitizado B204. Pausa **somente novas entradas no ledger local** B152 quando existe estado incerto ou exposição; não cancela, fecha nem protege a posição externamente. Falhas levam a estado `FAILED_CLOSED` e relatório sem credenciais.
- **B209:** entrypoint de operador `--status` e `--once`. Nunca lê credenciais de argumentos ou imprime dados do fornecedor. `--once` requer adapter **externo ao GitHub**, assinado no fluxo privado e protegido (arquivo `.mjs` pertencente ao usuário do processo, permissões 0600). Não abre serviço HTTP nem cria daemon ou scheduler automaticamente.
- **B210:** regressão CI completa, proteção de escopo, verificação de rotas não executáveis, browser smoke existente e backup da fonte pública (sem núcleo proprietário, chaves ou material de conta real). Corrigida exclusivamente uma condição de corrida no **teste legado** B152 (`child.once('exit')` passou a aguardar `child.once('close')` para que o stdout do worker seja integralmente recebido antes de `JSON.parse`); nenhum código do ledger, limite ou execução foi modificado.

## Separação de ambientes e credenciais

Os controles a seguir devem existir **somente** em um host privado aprovado; a Vercel, inclusive Preview, é explicitamente bloqueada no worker:

`JENIOS_PRIVATE_PAPER_REHEARSAL=true`, `JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT=true`, `JENIOS_PRIVATE_PAPER_READ_OBSERVER=true`, `JENIOS_PRIVATE_PAPER_OBSERVER_WORKER=true`.

`JENIOS_DEMO_VAULT_KEY_B64` usa o cofre existente B165; `JENIOS_PAPER_OBSERVER_KEY_B64` deve ser gerado por um gerenciador de segredos no worker (32 bytes aleatórios codificados em Base64) e deve ser distinto das chaves de pagamento, B179 e demais sistemas. Nenhuma chave deve ser colada no chat, GitHub, CI ou relatório. `JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED` e `JENIOS_PRIVATE_PAPER_EXECUTOR` permanecem desligados. Não usar `NEXT_PUBLIC_` para segredos.

### Diretórios locais

Diretórios de SQLite devem ter permissões 0700 e ser de propriedade da conta dedicada do worker. O `risk.sqlite` B152, `dispatch.sqlite` B178 e `observer.sqlite` B207 são **três registros distintos**. O sistema exige durabilidade operacional e backup seguro fora do repositório; nunca copiar dados reais para artifacts de CI.

### Adapter privado `--once`

A execução depende de um módulo externo e de confiança disponibilizado pelo operador via variável `JENIOS_PRIVATE_OBSERVER_ADAPTER_PATH`. Este arquivo deve ficar fora do repositório, sob propriedade do usuário do processo e com permissões 0600. Deve exportar `createTrustedObserverScope()` retornando `{ input, deps }`:

- `input`: sessão autenticada e escopo do proprietário, vínculo Alpaca Paper obtido por serviço privado, identificador/ativo/quantidade de ordem, proof do despacho e inventário de intents recuperados de armazenamento seguro, `auditId` único e grant HMAC de leitura emitido pelo responsável operacional.
- `deps`: instâncias existentes `ledger` B152, `journal` B178 e `auditStore` B207, callback server-role `refreshConnection()` e a função de leitura oficial B166 (ou padrão), mais relógio confiável. O entrypoint fecha essas três instâncias ao sair.

Para verificar *apenas* a configuração, num host privado provisionado: `node scripts/platform/connections/b209-private-observer-cli.mjs --status`. Para observação pontual depois da autorização operacional de leitura e configuração do adapter: usar `--once`. **Nenhum desses comandos instala um worker, configura uma corretora ou concede autorização de negociação.** Qualquer orquestração contínua requer instalação e monitoramento reais separados e aprovação explícita de infraestrutura.

## Política de incidentes

- `HTTP 404` da ordem ou falha de rede = resultado desconhecido. **Jamais** converter em rejeição, reduzir reserva, reordenar ou reenviar automaticamente.
- Reinício entre `claim` e a leitura oficial = auditId bloqueado, sem retomada automática. Nova verificação exige intervenção humana e novo grant.
- Incerteza ou exposição encontrada antes do GET = pausa local das **novas entradas**; a pausa não cancela ordens, não altera proteções na corretora e não zera posições.
- Evidência B204 é uma projeção não atestada do ensaio; SHA-256 é integridade, **não** assinatura, prova de provedor, desempenho, proteção efetiva ou ordem executada.
- Nenhuma estratégia original é modificada e os três modos continuam sujeitos ao mesmo livro B152. A avaliação B182 não certificou vantagem econômica líquida consistente.

## O que NÃO está concluído

1. Nenhum worker foi implantado num servidor persistente; `--once` é um entrypoint instalável, não um serviço em execução.
2. Nenhuma chave autenticamente provisionada nem conta Paper externa acessada; os testes usam respostas fictícias e `fetch` injetado.
3. Não há autorização específica para enviar uma ordem Paper externa nem ordens de dinheiro real; não existe endpoint público de envio.
4. Não há homologação independente de direitos de mercado, escopos de chave, condições comerciais da instituição, licenças, supervisão 24h, plano de contingência ou resultado prospectivo dos robôs.
5. Não houve deploy, merge, migração de banco, compras, cobranças, alterações Letter/Chefe ou qualquer intervenção na Social, Gênios, Universidade, BankScore, Validador e JENIOS PAY.

## Critérios para próximo passo

Após CI verde e backups: operador provisiona infraestrutura privada e cofre por canal protegido, revisa os termos da corretora, autentica uma conta Paper voluntária e inspeciona GETs reais com escopos mínimos. Um piloto de envio Paper **continua exigindo aprovação separada**, controles operacionais externos e evidência independente. Dinheiro real: NO_GO.
