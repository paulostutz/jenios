# R64 — Integração operacional validada em QA

## Estado e continuidade

**Classificação: QA_OPERATIONAL_INTEGRATION_CERTIFIED.** A CI de referência [40109756044](https://github.com/paulostutz/jenios/actions/runs/40109756044) concluiu com SUCCESS sobre o commit `5c6a82edf6aedc2e2d61fc7fb8d8fc0e891272da`. A certificação abrange integração em QA com replay assinado; não equivale a ativação operacional em produção.

Base consultada: backup R63 certificado, commit `a5a42b9e67b56786d1f0aeeddc5cd7f348a2275c`, CI 40106514889 SUCCESS. O R64 acrescenta observação, persistência, orçamento interno e relatório; os arquivos dos algoritmos R12–R63 permanecem inalterados.

A pré-aprovação do proprietário para melhorias automáticas permanece registrada. Este bloco mantém as restrições de produção, merge, deploy, ordens reais, Paper externo e custos não autorizados.

## Fluxo implementado

O coletor de QA assina um envelope minimizado. O servidor verifica assinatura, origem, escopo e tempo antes de armazenar o recibo. A rotina diária congela os recibos do dia local anterior, calcula o estudo e, quando existe autorização e orçamento interno explícitos, pode solicitar uma hipótese ao analista. O resultado e seu uso são gravados antes de aparecer no admin.

O caminho R64 usa exclusivamente **SIGNED_QA_REPLAY**. Não converte eventos para SYNTHETIC_FIXTURE nem chama o motor de promoção R63. Suas hipóteses não mudam os robôs. A demonstração R63 de 750→500 ms continua no seu domínio sintético original.

## Origem e evidência

- O servidor fixa uma origem e um escopo pseudonimizado; o corpo não escolhe conta, administrador ou destinatário.
- Ed25519 verifica integridade sob a chave pública configurada. Isso não comprova atividade de corretora nem consentimento independente de cliente.
- O schema é fechado, sem texto livre, credenciais, nomes, e-mails, conta bruta, preços ou valores financeiros.
- Captura até admissão: máximo 120 segundos. Ocorrência até captura: máximo 24 horas, explicitamente como replay de QA.
- O primeiro recibo de um evento é preservado. Mesmo evento e conteúdo são idempotentes; conteúdo conflitante ou sequência regressiva são recusados.
- O estudo agrega até 5.000 recibos. O analista recebe no máximo os 48 eventos mais recentes, identificados como amostra; os totais completos permanecem separados.

A inspeção de um recibo histórico verifica sua estrutura e digest dentro da persistência confiável. Não substitui a verificação de assinatura na admissão de uma nova requisição. O estudo não é uma nova atestação independente da origem.

## Persistência e execução diária

O SQL de revisão em **db/schema/robot-r64-operational-store.sql** prepara eventos, ciclos e orçamento interno. Ele não foi aplicado a um Supabase existente. O adaptador usa o cliente administrativo exclusivo da Platform, sem fallback para Social ou Pay.

Cada ciclo é único por escopo e período. O snapshot inicial é imutável; uma retomada usa exatamente esse snapshot. Eventos tardios não reescrevem relatórios concluídos.

A aquisição do ciclo concede uma reserva de execução de 60 segundos e uma geração crescente. Relógios de lease e orçamento vêm do PostgreSQL. Reservar orçamento e conceder o despacho é uma transação. Um processo antigo não pode concluir usando uma geração vencida, e apenas um despacho pode ser concedido por ciclo.

Quando uma chamada despachada tem resultado incerto, a reserva financeira permanece retida e o ciclo exige reconciliação. Não há repetição automática da inferência. Uma falha após a chamada, mas antes de persistir, não expõe uma análise como concluída.

Tabelas e RPCs possuem grants e revokes explícitos, RLS e execução somente pelo papel de servidor. As funções usam SECURITY INVOKER e relações qualificadas. O service_role ignora RLS; portanto, seu isolamento por conta depende também do escopo verificado no servidor, das chaves e dos predicados SQL.

## Analista e orçamento próprio

O estudo interno não debita carteira, franquia ou créditos dos clientes. Reaproveita as funções puras de precificação e os padrões transacionais já existentes, com registro interno próprio.

O transporte preparado usa a Responses API em endpoint fixo, store:false, schema estruturado estrito, sem ferramentas, sem redirecionamento e sem retry. Uma consulta de contagem de tokens precede a inferência; requisições HTTP e inferências são contadas separadamente.

Limites: 8.000 tokens de entrada, 700 de saída, resposta limitada em bytes e prazo total de 10 segundos. O modelo deve estar na lista aprovada e a política de tarifa deve ter aprovação recente, dentro de 30 dias. A tarifa é um snapshot versionado já existente; este bloco não afirma ter verificado preços ou disponibilidade atuais do provedor.

O uso retornado deve conter os contadores exigidos pelo contrato atual, incluindo cache e reasoning. Uso ausente, modelo inesperado ou resposta ambígua não são tratados como custo zero. Uma hipótese inválida, quando o uso é confirmado, continua sendo contabilizada, mas não é apresentada como hipótese admitida.

Ficam registrados fingerprint, modelo, versão da tarifa, ID e digest da resposta, uso, custo em nanoUSD e resultado normalizado. A saída de modelo não concede autoridade de promoção, ordens ou deploy. Nenhum provedor pago foi acionado nesta implementação.

## Rotas e admin

- POST /api/platform/robot-observations: entrada de envelope assinado.
- POST /api/platform/internal/robot-observation-cycle: rotina diária com credencial própria; não aceita seleção de escopo, modelo, orçamento ou relógio no corpo.
- GET /api/platform/admin/robot-observations: leitura protegida por requirePlatformAdmin e autenticação dedicada da Platform.
- /platform/homologacao/robos/observacao: prévia de QA que lê o relatório persistido, sem fabricar dados nem executar o ciclo.

O feed administrativo tem projeção fechada: não expõe chaves, snapshots brutos, prompts ou campos privados inesperados. A interface mostra observações por robô, ocorrências, hipóteses, situação da análise, custo auditado quando disponível e ciclos aguardando reconciliação.

O fechamento é diário às **09h de America/Sao_Paulo**, sobre o dia local anterior encerrado. O estágio reflete evidências, sem percentual inventado de perfeição. Detalhes técnicos ficam no admin; transparência sobre dados dos clientes e mudanças relevantes permanece necessária.

O login real do proprietário e um admin publicado não foram exercitados. A prévia só aceita dados de QA e permanece bloqueada em produção.

## Configuração preparada, não ativada

O host deve fornecer a configuração exclusiva da Platform e as variáveis server-side:

- JENIOS_ROBOT_R64_ENABLED=true, com todos os gates R61 de preview/QA e execução real/Paper desabilitada.
- JENIOS_ROBOT_R64_SCOPE_ID e JENIOS_ROBOT_R64_SOURCE_ID pseudonimizados.
- JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY da origem autorizada.
- JENIOS_ROBOT_R64_SCHEDULER_TOKEN privado.
- Para análise paga futura: JENIOS_ROBOT_ANALYST_PAID_ENABLED=true, JENIOS_ROBOT_ANALYST_MODEL e OPENAI_API_KEY, além da política interna aprovada no banco.

Nenhuma dessas variáveis foi criada ou alterada em um serviço existente. A configuração padrão do orçamento permanece desabilitada e com limite zero.

O comando node scripts/platform/research/r64-operational-worker.mjs --once executa uma tentativa explícita. --watch mantém um processo local que verifica o horário a cada minuto, sem sobreposição. Nenhum cron ou serviço foi registrado nesta sessão.

## Verificação observada

A CI de referência executou todos os gates abaixo em Node 22.23.3. As contagens de direcionados e gerais se sobrepõem; não devem ser somadas como testes distintos.

| Gate | Resultado |
| --- | --- |
| Direcionados R12–R64 | 519/519 PASS |
| Gerais | 2.325/2.325 PASS |
| Social | 94/94 PASS |
| PostgreSQL descartável | 32/32 PASS |
| Navegador R61–R63 preservado | 52/52 PASS |
| Integração R64 HTTP, banco e navegador | 31/31 PASS |
| Build | PASS |
| Páginas estáticas geradas | 76/76 |

Os 77 testes novos também passaram localmente em Node 24.22.1. Os gates acima não tiveram falhas ou casos pulados no run de referência.

### O que o ensaio integrado comprovou

Sete eventos assinados atravessaram a API Next e foram persistidos em PostgreSQL real descartável. O fechamento diário passou pela rota HTTP com relógio real, gravou um único relatório e manteve o resultado em nova tentativa. A API administrativa retornou exatamente o relatório gravado; recarregar a prévia preservou o conteúdo.

O ensaio verificou 401 sem identidade, 403 para membro sem permissão, 401 para usuário anônimo, credencial própria do agendador, assinatura adulterada, origem não configurada, replay idempotente, conflito e indisponibilidade do banco com resposta 503. O retorno do banco recuperou o mesmo relatório, sem fabricá-lo durante a falha.

A fronteira Supabase Auth/PostgREST foi **explicitamente simulada por um gateway HTTPS local**. A CA efêmera foi confiada por NODE_EXTRA_CA_CERTS; a verificação TLS não foi desativada. As funções SQL rodaram em PostgreSQL descartável sob service_role. Isso não certifica login de conta real ou conexão a um Supabase publicado.

As 32 verificações SQL cobriram permissões/RLS, isolamento de escopo, aplicação repetida do schema sem apagar histórico, imutabilidade de snapshots, concorrência entre conexões, despacho único, orçamento mensal, reconciliação e expiração de lease enquanto uma transação aguarda lock. O worker não consegue aprovar a própria política paga.

Na passagem integrada, a geração paga permaneceu desabilitada: zero requisições ao provedor, zero inferências, reserva zero e liquidação zero. O adaptador do provedor e seus resultados de uso/custo foram avaliados por contratos injetados nos testes unitários; nenhuma chamada OpenAI real foi certificada.

Os quatro robôs apareceram na prévia. Playwright 1.56.1 e Chromium 141.0.7390.37 confirmaram os tamanhos 375 e 320 pixels sem overflow horizontal. A captura mobile e os logs de servidor foram revisados. Não houve erro de página ou tentativa de tráfego proibido pelo navegador. Os testes HTTP do servidor exerceram as mutações de fixture previstas; a restrição de rede instrumentada se refere ao navegador.

O relatório de referência exibiu 7 observações, 3 ocorrências e **0 mudanças aplicadas pelo R64**. A avaliação automática sintética R63 foi repetida e preservou o ajuste de 750 para 500 ms, com zero false allows e sem regressão de false blocks nos seis casos sintéticos registrados. Isso demonstra o mecanismo restrito do R63, sem certificar benefício econômico real.

### Evidências e rastreabilidade

- [Checkpoint R64](evidence/ROBOT_R64_OPERATIONAL_INTEGRATION_CHECKPOINT.json).
- [Aceitação PostgreSQL R64](evidence/ROBOT_R64_POSTGRES_ACCEPTANCE_EVIDENCE.json).
- [Aceitação HTTP, banco e navegador R64](evidence/ROBOT_R64_RUNTIME_ACCEPTANCE_EVIDENCE.json).
- [Casos de navegador anteriores repetidos no R64](evidence/ROBOT_R64_PRESERVED_BROWSER_EVIDENCE.json).
- [Evolução sintética anterior repetida no R64](evidence/ROBOT_R64_PRESERVED_EVOLUTION_EVIDENCE.json).
- [Ledger consolidado](evidence/ROBOT_MASTER_PERFORMANCE_LEDGER.json).

Artefato de referência: ID 12566032946, 860.146 bytes, SHA-256 `873e6ed7f2038f30b9180b46b6150f3acd3f315bd33c0a8c74ded461f8b06849`. O hash do ZIP foi conferido e os arquivos foram extraídos por lista permitida. A retenção temporária do artefato GitHub termina em 07/11/2026; os relatórios JSON estão preservados no repositório com o commit de origem original.

Duas tentativas anteriores foram preservadas no checkpoint: a CI 40109540039 recusou o workflow antes de iniciar jobs, corrigido movendo runner.temp para o ambiente dos steps; a CI 40109611001 passou 519 direcionados e parou na seleção de serviço do cliente psql, corrigida removendo PGSERVICE/PGSERVICEFILE herdados. A CI de referência completa passou depois dessas correções.

A revisão visual identificou apenas a concordância de “1 observação de QA”. O commit consolidado corrige o texto e a expectativa literal do teste de navegador, sem alterar o algoritmo dos robôs.

### Regra do fechamento certificado

A branch de pesquisa é `research/jenios-robot-r64-operational-integration-20261024`. O backup `backup/jenios-robot-r64-operational-integration-certified-20261024` só pode ser criado após outra CI completa com SUCCESS sobre o commit consolidado. O ref do backup e a Actions run bem-sucedida para seu SHA identificam o fechamento final; as evidências de referência mantêm o SHA de origem e não são reatribuídas ao commit posterior.

O ledger recebeu somente a nova seção operationalObservationIntegration; seus 12 campos históricos anteriores foram preservados. As configurações anteriores da Vercel também foram preservadas, com exclusões exatas para as duas branches R64. A consulta do commit de referência retornou zero tentativas de deploy.

## Limites que permanecem

A ativação em host autorizado, aplicação revisada do SQL no ambiente dedicado, credenciais e orçamento operacional, coleta autorizada de clientes, reconciliação administrativa de custos incertos e política de retenção/arquivamento permanecem fora deste bloco. O login real do proprietário e um admin publicado não foram homologados.

A assinatura comprova integridade sob a origem configurada; não é prova independente de corretora ou consentimento de cliente. A janela de replay é explícita e não transforma os eventos em coleta prospectiva. Um ciclo já concluído não é reescrito por eventos tardios.

R15 permanece sem backfill; actualBrokerPnl, actualLossesAvoided e realTradeAccuracy continuam null. Ordens reais, Paper externo, chamadas pagas e débitos em carteira de cliente permanecem zero. Produção, merge e deploy não foram executados. Performance comercial não está certificada.
