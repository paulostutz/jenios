# R64 — Preparação da integração operacional dos robôs

## Estado e continuidade

Implementação em pesquisa, aguardando CI completa. Base consultada: backup R63 certificado, commit `a5a42b9e67b56786d1f0aeeddc5cd7f348a2275c`, CI 40106514889 SUCCESS. O R64 acrescenta a integração de observação, persistência, orçamento interno e relatório; preserva os algoritmos e resultados R12–R63.

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

## Verificação e pontos ainda abertos

Os 77 testes locais novos passaram. A CI deve repetir as baterias R12–R63, os testes R64, Social e build; executar SQL em PostgreSQL descartável com conexões independentes; preservar os 52 casos de navegador e validar o novo caminho HTTP e visual.

A fronteira Supabase Auth/PostgREST do ensaio será explicitamente simulada. O banco PostgreSQL usado nas transações será real e descartável, com credenciais de fixture. Isso não equivale a homologar uma conta administrativa real ou um Supabase publicado.

Permanecem pendentes a ativação em host autorizado, aplicação revisada do SQL no ambiente dedicado, credenciais e orçamento operacional, coleta autorizada de clientes, reconciliação administrativa de custos incertos e política de retenção/arquivamento. O R64 não comprova rentabilidade.

O checkpoint e o ledger serão consolidados com os resultados observados. O backup certificado só será criado após uma nova CI completa sobre o commit consolidado. R15 continua sem backfill; métricas reais permanecem nulas e ordens reais/Paper externo permanecem zero.
