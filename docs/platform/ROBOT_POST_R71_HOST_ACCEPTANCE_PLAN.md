# JENIOS robôs — pacote de aceitação futura do host privado

Data da revisão: 24/10/2026. Base lida: `3fb6e9c4335422440d149fd969907e9eddc840c6` (R71 certificado, reconferido no fechamento deste pacote).

**Estado:** plano documental pronto; ambiente real ainda não selecionado/aceito. Nenhum serviço instalado, processo remoto iniciado, configuração hospedada alterada ou teste repetido nesta revisão. Nenhum novo ID de host privado foi encontrado nos artefatos examinados.

## 1. Conclusão executiva

O ciclo funcional privado de QA está concluído no R71: core original → observação contextual assinada → estudo integral → plano prospectivo → oito casos → aplicação limitada → decisão vinculada à geração → rollback. O próximo trabalho útil é preencher e aceitar o vínculo entre esse conjunto existente e um ambiente concreto. Repetir a bateria sintética não fornece identidade de host, durabilidade de volume, custódia, exclusão externa de escritores, identidade administrativa real ou proveniência operacional.

O pacote pode ser concluído agora como inventário de componentes, formulários sem valores inventados, matriz de evidências e sequência de execução futura. Permanece bloqueada qualquer alegação de homologação hospedada enquanto faltarem as observações reais abaixo. Deploy, merge, migração hospedada, custos, ordens, Paper externo e monitoramento de clientes continuam fora deste escopo.

## 2. Componentes existentes a reutilizar

Todos os caminhos abaixo são relativos à raiz do repositório `paulostutz/jenios`.

| Componente | Arquivos existentes | O que já está pronto | Limite da evidência |
|---|---|---|---|
| Loader do core | `lib/platform/research/robot-r67-private-core-loader.mjs` | Lê bytes privados por descritor, confere hashes fixos, compila os mesmos bytes em VM; handle com identidade interna | Não prova a identidade de uma máquina remota nem restaura a memória do runtime |
| Host R71 | `scripts/platform/research/r71-private-host.mjs`, `lib/platform/research/robot-r71-private-host.mjs`, `robot-r68-private-host.mjs` | `--check`, `--once`, `--watch`; lifecycle compartilhado, custódia, lock, parada, rechecagem e plano fixo | CLI não é instalador, unidade de serviço, inventário de host ou garantia entre máquinas |
| Arquivos privados | `lib/platform/research/robot-r68-private-files.mjs` | Diretórios/arquivos protegidos, dono, links, leitura limitada e lease | Prova local do objeto observado; não comprova custódia do provedor/volume |
| Fonte e fila R71 | `robot-r71-private-source.mjs`, `robot-r71-private-capture-outbox.mjs`, `robot-r71-durable-emitter.mjs`, `robot-private-durable-file.mjs` | Persistência antes do envio; retry exato; sessão nova; revisão/geração mínima persistida | Não detecta restauração do diretório inteiro sem testemunha externa |
| Doctor | `lib/platform/research/robot-r68-outbox-doctor.mjs` | Perfil fechado `R71_PRIVATE_EVOLUTION`, HMAC, inventário, locks, expiração e capacidade somente leitura | Nunca autoriza remover locks, promover temporários, re-assinar ou purgar |
| Identidade do destino | `robot-r70-target-snapshot.mjs`, `scripts/platform/research/r70-target-snapshot.mjs` | Comparação exata de metadata de equipe/projeto/repo/SHA/deployment/URL | JSON fornecido não vira aquisição autenticada nem atestação |
| Preflight | `robot-r70-preflight-client.mjs`, `robot-r70-preflight-http.mjs`, `robot-r70-preflight-protocol.mjs` | Desafio assinado com nonce, prazo e pins; verificação antes de captura/envio | Compatibilidade declarada via TLS não comprova host, banco ou Auth hospedados |
| Consulta/entrega R71 | `robot-r71-https-transport.mjs`, `robot-r71-private-protocol.mjs`, transporte TLS R69 | Caminhos fixos, consulta em domínio assinado separado, vínculo da resposta, três assinaturas por observação | Sem header, callback, CA ou transporte arbitrário no manifesto |
| Backend R71 | `robot-r71-runtime.mjs`, `robot-r71-http.mjs`, `robot-r71-access.mjs`, rotas `app/api/platform/...` | Admissão, consulta mínima de runtime, administração e scheduler fechados | Testado localmente com Auth explícita de fixture e PG descartável |
| Worker R71 | `scripts/platform/research/r71-cycle-worker.mjs`, `robot-r71-cycle-worker.mjs` | Tick explícito com relógio do banco, CAS e resultado `nextAtMs` | Não instala scheduler ou processo persistente |
| Banco | `db/schema/robot-r67-private-capture-store.sql`, `db/schema/robot-r71-private-evolution-store.sql` | Esquemas revisados, originais preservados, casos atômicos e histórico | Não aplicados por este plano a banco hospedado |

**Dois cuidados de reutilização:**

- `scripts/platform/research/r68-declared-handoff.mjs` e `robot-r68-declared-handoff.mjs` examinam configuração R64/R65/R67 e a matriz administrativa antiga. Podem fornecer verificações parciais existentes, mas não têm cobertura integral dos campos R69/R70/R71. Uma saída `configurationComplete` desse módulo não certifica R71.
- `scripts/platform/research/r68-cycle-supervisor.mjs` envolve o tick R65. Não deve ser instalado ou apresentado como scheduler R71. Para R71 já existe o tick próprio; a composição de agendamento/respeito a `nextAtMs` deve ser definida no host/controlador real. Não é necessário reescrever agora o supervisor sem conhecer esse ambiente.

## 3. Dados exatos ainda necessários

| Área | Dados que faltam | Evidência adequada a anexar | O que não substitui a evidência |
|---|---|---|---|
| Host | Provedor/conta/workspace, ID imutável de serviço/VM/container, região, operador responsável, sistema/runtime, revisão do programa executado, usuário de execução | Metadata autenticada do recurso escolhido e observação local vinculada ao mesmo recurso/instante | Nome informal, IP isolado, caminho em `/tmp`, unit de exemplo ou PID sozinho |
| Processo | Comando/entrada R71 efetivos, cwd, supervisor escolhido, configuração de réplicas, processo pai/controlador e comportamento de reinício | Configuração do controlador e observação da execução; nenhum segredo nos logs | Arquivo de serviço ainda não instalado ou sucesso de uma CLI temporária |
| Volume | ID do volume, montagem real, filesystem, persistência após reinício/substituição, diretório da fila e proprietário, capacidade | Metadata do volume + vínculo observado ao processo e plano de retenção/backup | A string `persistent_private_volume` ou a existência de uma pasta |
| Custódia | Quem provisiona/guarda Ed25519 e HMAC; caminhos protegidos; fingerprint público; política de backup/recuperação | Modos/proprietários e correspondência criptográfica local, procedimento de custódia do ambiente | Ler valores secretos em chat, formato de PEM/JWT ou declaração de “seguro” |
| Exclusão | Todos os escritores/emissores possíveis; mecanismo para excluir instâncias antigas antes de recuperação | Ação/estado observável do controlador ou fence externo para o recurso concreto | Lock file, idade do lock, processo aparentemente morto ou timeout |
| Testemunha | Local independente que detecte rollback de toda a fila/estado; autoridade e procedimento de reconciliação | Identidade do recurso externo, valor monotônico e vínculo a revisão/digest observados | Outro arquivo dentro do mesmo diretório restaurável |
| Fonte | `scopeId`, `sourceId`, fingerprint Ed25519 aceitos; dono dos dados; componente que emitirá decisões e posições; proveniência, tempo, consentimento/escopo | Contrato e observação da fonte real sem clientes enquanto não autorizado | Trocar o rótulo de fixture por “operacional” ou assinar contexto arbitrário |
| Destino QA | Equipe/projeto/repo/SHA/deployment/URL únicos, ambiente preview, proteção de acesso compatível | Resposta completa de control plane + comparador R70 + desafio ao peer TLS | Alias de branch, último deployment, sufixo `.vercel.app`, ou resposta HTTP200 isolada |
| Backend/banco | Projeto QA aceito, isolamento, inventário de configuração herdada completo, vínculo de credenciais ao projeto, inventário dos esquemas | Metadata autenticada sem segredos e, em escopo autorizado, aplicação/aceite hospedado | Catálogo histórico, nome “homologação” ou resposta de metadata truncada |
| Administração | Contas reais Platform admin/membro/relatórios, token expirado/inválido, origem canônica, autor de rollback | Matriz real nos endpoints selecionados, com relatório mínimo e eventos auditáveis | Sessão injetada, claims declarados ou Auth gateway de fixture |
| Scheduler | Recurso/controlador identificado, comando/endpoint R71, política de wake, token exclusivo e desligamento observável | Configuração e invocação vinculadas ao ambiente, sem expor token | Endpoint implementado, cron de outro domínio ou supervisor R65 |

## 4. Identificadores já conhecidos: candidatos, não aceite de host

Os inventários versionados registram:

- Vercel: projeto `jenios-ecossistem`, ID `prj_44ipBY3R9sHlQDAXY7NUn1zDguw4`, equipe `team_yDZgXm0NnWvHwT6xUijH3xn0`; repositório `paulostutz/jenios`, ID registrado no control plane R70 `1408041119`.
- Supabase histórico: `jenios-platform-homologacao`, ID `xaicvhagftzjkqphnbgx`, região registrada `sa-east-1`. O inventário R69 não comprovou isolamento dedicado aos robôs nem instalação R64/R65/R67. Isso é uma observação histórica; não foi reconsultado nesta revisão.
- Arquivo histórico R45: `JENIOS-Platform-R45/nucleo-privado/server.mjs`, SHA256 `0ed6ae3a730ce6b9378ff0021f81e2434b454cd3f9a7ed1c5f5f129369db337e`, e proxy `JENIOS-Platform-R45/app-completa/lib/platform/research-proxy.mjs`, SHA256 `fc4bba8fa68daa907f0ea9d94fdb79c8e1a6af60e0a57ef0d5ffecaafe4ba0e9`. São bytes/integração histórica, não identificação de uma instalação atual. Não fornecem a fila R71 e não devem ser reinstalados para substituir o lifecycle existente.

Nenhum desses IDs identifica um host privado persistente aceito. A ausência no inventário examinado não prova inexistência em outro ambiente. Nenhum serviço de outro produto nem observador Paper foi selecionado como substituto.

Fontes de proveniência: `docs/platform/evidence/ROBOT_R69_TARGET_INVENTORY.json`, `ROBOT_R70_CONTROL_PLANE_EVIDENCE.json`, `ROBOT_R71_TARGET_INVENTORY.json`. A consulta global de metadata de ambiente está marcada como truncada; a consulta vazia de overrides de uma branch não exclui variáveis herdadas.

## 5. Formulários prontos sem identidade inventada

### Manifesto que o código já aceita

Onze campos, sem extensões de transporte, código, versão ou booleano da política. Os placeholders abaixo são deliberadamente inválidos e precisam ser substituídos por dados aceitos; este texto não é configuração de ativação.

```json
{
  "schema": "JENIOS_R71_PRIVATE_HOST_CONFIG_V1",
  "coreDirectory": "/CAMINHO_PRIVADO_A_DEFINIR/core",
  "outboxDirectory": "/CAMINHO_PRIVADO_A_DEFINIR/outbox",
  "privateKeyFile": "/CAMINHO_PRIVADO_A_DEFINIR/source.pem",
  "hmacKeyFile": "/CAMINHO_PRIVADO_A_DEFINIR/outbox.hex",
  "commandsFile": "/CAMINHO_PRIVADO_A_DEFINIR/commands.json",
  "scopeId": "PENDENTE",
  "sourceId": "PENDENTE",
  "sourceKeySha256": "PENDENTE",
  "origin": "PENDENTE",
  "targetPinsFile": "/CAMINHO_PRIVADO_A_DEFINIR/target-pins.json"
}
```

`scopeId` e `sourceId`: prefixos `scope:`/`source:` mais 16 hex minúsculos; fingerprint: SHA256 dos bytes SPKI DER da chave pública Ed25519. Diretórios/arquivos fora do checkout e cwd, protegidos 0700/0600, proprietário da execução, sem symlinks/hardlinks. O HMAC é arquivo com 64 hex minúsculos, não argumento de CLI ou valor em relatório. Preservar a chave HMAC correspondente à fila existente; não gerar outra para contornar uma recusa.

Pins já aceitos, oito campos exatos:

```json
{
  "schema": "JENIOS_R70_TARGET_PINS_V1",
  "origin": "PENDENTE",
  "projectId": "PENDENTE",
  "deploymentId": "PENDENTE",
  "commitSha": "PENDENTE",
  "scopeId": "PENDENTE",
  "sourceId": "PENDENTE",
  "sourceKeySha256": "PENDENTE"
}
```

O destino deve ser a origem HTTPS exata de deployment preview escolhido. O perfil R70/R71 admite `.vercel.app` ou loopback literal de aceitação local; não admite origem HTTPS genérica ou `localhost`. Uma rede com outro tipo de destino exige decisão de contrato posterior, não um alias improvisado.

Arquivo de comandos vazio para preparação: `{"schema":"JENIOS_R71_PRIVATE_HOST_COMMANDS_V1","commands":[]}`. Vazio não torna `--watch` somente leitura: esse modo cria sessão, consulta rede e pode capturar automaticamente um plano pendente. Para diagnóstico sem efeitos, usar exclusivamente `--check`.

Quando houver cenários QA autorizados, cada comando tem apenas `{operationId,scenarios,positionContexts}`. `operationId` é estável (`op:` + 32 hex); máximo20 comandos. Cenários:3..60, incluindo Manual/Híbrido/Reverso, com `id,mode,intent,horizon,paused?`. Contextos: `[{scenarioId,positionOpen:boolean}]`, mesma ordem. Não incluir a versão da política, callbacks, candles, posições de clientes ou instruções executáveis.

### Separação de configuração

- Host R71: gates QA herdados R67, `JENIOS_ROBOT_R68_HOST_ENABLED`, `JENIOS_ROBOT_R69_HTTPS_ENABLED`, `JENIOS_ROBOT_R70_PREFLIGHT_ENABLED`, `JENIOS_ROBOT_R71_ENABLED`; todos com opt-in explícito para execução. Geração paga, ordens e Paper continuam false. `--check` pode observar configuração desabilitada sem executar.
- Receptor Next: gates R67/R70/R71, metadata real `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`, `VERCEL_PROJECT_ID`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_URL`; fonte pública R67 configurada e distinta da R64/R65.
- Backend/admin/scheduler: configuração Platform de banco/browser, `JENIOS_ROBOT_R71_ADMIN_ORIGIN` e `JENIOS_ROBOT_R71_SCHEDULER_TOKEN` exclusivo. Chave privilegiada do banco e token administrativo/scheduler não entram no manifesto do host nem no remetente de observações.

### Comandos preparados para o ambiente que vier a ser aceito

Os exemplos abaixo não foram executados nesta revisão. Os caminhos continuam pendentes; a execução futura exige configuração protegida e o escopo QA autorizado. A inspeção offline não precisa da flag de VM, pois não carrega nem executa o core:

```bash
node scripts/platform/research/r71-private-host.mjs --check --config /CAMINHO_PRIVADO_A_DEFINIR/host.json
```

Para executar o core original, a flag `--experimental-vm-modules` pertence ao processo Node e vem antes do caminho da CLI. O loader exige `vm.SourceTextModule`; omitir a flag no runtime certificado causa recusa. Escolher um dos modos abaixo conforme o controlador aceito; não executar ambos como uma sequência de preparação:

```bash
node --experimental-vm-modules scripts/platform/research/r71-private-host.mjs --once --config /CAMINHO_PRIVADO_A_DEFINIR/host.json
node --experimental-vm-modules scripts/platform/research/r71-private-host.mjs --watch --config /CAMINHO_PRIVADO_A_DEFINIR/host.json
```

Ambos os modos de execução podem criar sessão, consultar o receptor, capturar decisões e transmitir a fila. A flag de VM não habilita gates, escolhe o destino ou instala um serviço. O diretório de trabalho e o SHA devem ser os do checkout aceito; os arquivos privados permanecem fora dele.

O worker R71 já existente é uma CLI separada de tick do backend. Aceita somente esta invocação, sem argumentos adicionais, com sua configuração fornecida pelo ambiente protegido do backend:

```bash
node scripts/platform/research/r71-cycle-worker.mjs
```

Esse comando pode inicializar ou avançar o estado durável QA e deve ser tratado como ação mutável autorizada. Não é inspeção, host de captura nem agendamento. Não precisa da flag de VM, porque não carrega o core privado; não recebe chaves ou tokens na linha de comando. O controlador futuro deve consumir o resultado do tick e respeitar `nextAtMs`, sem substituir o worker R71 por um supervisor R65.

## 6. Sequência futura de aceitação, usando os componentes existentes

1. **Selecionar recursos e fechar proveniência.** Preencher host, volume, fonte e alvo QA com IDs e evidências reais. Registrar o SHA integral esperado e a data de cada observação. Não declarar valores faltantes como verificados.
2. **Inspeção local offline.** Com arquivos protegidos já presentes no host autorizado, executar `node scripts/platform/research/r71-private-host.mjs --check --config /CAMINHO_PRIVADO_A_DEFINIR/host.json`. Reutiliza o doctor; não cria VM, sessão, lock, captura ou rede. Exigir `coreFiles.bytesMatchPinnedHashes=true`, `doctor.observationStable=true`, `doctor.inventoryComplete=true`, snapshot validado quando presente (ou `snapshot.present=false` para uma fila nova), nenhum lock presente, nenhum temporário e `unrecognizedEntries=0`. O snapshot existente deve passar HMAC/fonte; snapshot ausente não pode ser anunciado como HMAC de registros verificado. Para execução futura, exigir também `qaConfigurationValid=true`. Não decidir apenas por um texto de status ou código de saída. Isso ainda não aceita o host externo.
3. **Comparar o destino a metadata completa.** Usar `node scripts/platform/research/r70-target-snapshot.mjs --snapshot /CAMINHO_PRIVADO_A_DEFINIR/target-snapshot.json` com aquisição autenticada preservada separadamente. O código2 do comparador mantém a homologação pendente mesmo quando as declarações são consistentes. Não usar outro SHA/alias como fallback.
4. **Conferir o peer.** Após seleção e autorização do alvo, usar o cliente R70 existente para o desafio antes de qualquer captura. Guardar somente metadados/digests sanitizados. Não substituir essa chamada por `--once`: esse modo também pode executar o core, criar sessão e transmitir.
5. **Banco e identidade, em escopo que autorize hospedagem.** Aplicar somente esquemas revisados no projeto escolhido; executar a matriz administrativa real. A chave da fonte autentica observações/consulta; ela não substitui o administrador. Inicializar o estado R71 por tick administrativo/scheduler explícito ou pela CLI `node scripts/platform/research/r71-cycle-worker.mjs`, sem argumentos, antes de esperar que a fonte leia uma versão ativa.
6. **Aceitar persistência/processo no host escolhido.** Executar o percurso já certificado com a CLI R71 real e a flag Node `--experimental-vm-modules`, volume escolhido e receptor QA escolhido. Registrar reinício, retry exato, parada, retenção de lock órfão e ausência de mudanças não autorizadas; não multiplicar casos sintéticos. Comprovar exclusão externa antes de qualquer recuperação e uma testemunha independente contra rollback integral do diretório. O doctor permanece somente leitura.
7. **Vincular o scheduler R71.** Identificar o controlador efetivo e sua política de wake usando o tick/`nextAtMs`; comprovar que host e receptor estão prontos antes de abrir planos temporais. Um histórico que perde a janela é rejeitado, nunca preenchido retroativamente. Nenhum supervisor R65 é automaticamente promovido para R71.
8. **Tratar dados operacionais como contrato próprio.** O loader/captura R71 atual exige o caminho sintético B297. Uma integração real precisará localizar e aceitar o hook de decisão/dados existente, sua proveniência e o vínculo de contexto; não consiste em trocar um arquivo de cenários por dados de clientes. Separar esse domínio das evidências QA e preservar os invariantes dos quatro robôs. O modo Manual continua sob controle do operador; UltraFast segue R61/R65.

Passos2–4 são verificações aplicáveis a um ambiente selecionado, mas não foram executados contra host/destino reais nesta revisão. Passos5–8 dependem das decisões e autorizações que este escopo não fornece. Nenhum sucesso local concede aprovação automática para os seguintes.

## 7. O que pode ser encerrado agora

**Pode:** salvar este pacote junto ao próximo checkpoint de preparação, manter o R71 certificado encerrado, registrar os campos pendentes com status explícito, vincular manifest/doctor/preflight/backend já existentes e entregar ao responsável uma única solicitação concreta pelos identificadores do ambiente e sua proveniência. Não é necessário testar novamente as estratégias nem criar outro runner, outra fila, novo contrato de assinatura ou instalador sem host definido.

**Não pode ser concluído por inferência:** aceitar host/volume, certificar Auth hospedada, aplicar migrações, ativar scheduler, ligar dados de clientes ou habilitar custos. Se esses recursos já existem fora dos artefatos examinados, o próximo dado útil é sua identificação e evidência de vínculo, não uma reconstrução.

Critério de conclusão desta etapa documental: cada requisito tem componente reutilizável, campo/evidência faltante, responsável a indicar e próximo passo definido; nenhuma flag `operationalReady`, `hostedAuthenticationCertified`, `customerMonitoringActive` ou `privateOperationalSourceActive` é promovida.

## 8. Referências lidas nesta revisão

- `docs/platform/ROBOT_R68_PRIVATE_HOST_READINESS.md`.
- `docs/platform/ROBOT_R69_HTTPS_INTEGRATION.md` e `docs/platform/evidence/ROBOT_R69_TARGET_INVENTORY.json`.
- `docs/platform/ROBOT_R70_TARGET_PREFLIGHT.md` e `docs/platform/evidence/ROBOT_R70_CONTROL_PLANE_EVIDENCE.json`.
- `docs/platform/ROBOT_R71_PRIVATE_EVOLUTION.md`, `docs/platform/evidence/ROBOT_R71_PRIVATE_EVOLUTION_CHECKPOINT.json`, `docs/platform/evidence/ROBOT_R71_TARGET_INVENTORY.json`.
- Implementações de host, arquivos privados, handoff, doctor, preflight, gates e fonte citadas no mapa.

Este subplano resulta de leitura documental e de código. As consultas remotas somente leitura feitas no fechamento estão registradas no inventário principal. Nenhum segredo, instalação, migração ou nova bateria de testes foi necessário para elaborar este plano.
