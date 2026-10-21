# JENIOS Platform — B251 a B260 — homologação administrativa, sandbox e evidência prospectiva

Base imutável: B250 `84f111314745bf6d649cdfedf71c796c4e448fed` (CI 39575995083, SUCCESS), repositório exclusivo `paulostutz/jenios`.

## Escopo tecnicamente entregue

- **B251:** compara referência de CI/commit exata, sem afirmar que entrada fornecida pelo usuário é atestada pelo GitHub.
- **B252:** novo endpoint **GET** `/api/platform/homologacao/readiness`, somente Preview com dois flags de servidor. Exige **permissão administrativa `platform.admin` no banco exclusivo da Platform**, validada por `requirePlatformAdmin`. Nunca retorna segredos, IDs ou tokens. Desligado por padrão inclusive em Preview; produção devolve 404 mesmo com flags.
- **B253:** avaliação local de saúde das rotas, negando alegar que uma resposta de localhost seja uma sessão autenticada remota.
- **B254:** reexecuta contratos B86 de assinatura para os três planos mensais existentes. Sem inventar recorrência ou Pix já homologado.
- **B255:** diário estritamente **em memória e sintético** para idempotência e escopo de pagador/plano. Não substitui a persistência ou webhook bancário real e não ativa permissões.
- **B256:** projeta apenas status restritos de vínculos demonstrativos de conta originados do backend. Conta lida não tem permissão de negociação inferida.
- **B257:** classifica risco de ordens parciais e desconhecidas sem alterar B152, sem enviar ordem nem liberar capital com HTTP 404.
- **B258:** valida cadeia de registros sintéticos assinados em Ed25519, chave pública fixada e sequência temporal. Uma assinatura válida não prova independência do emissor, origem de dados de mercado, decisão do núcleo privado ou vantagem econômica.
- **B259:** consolida em quatro trilhas independentes — informação pública, comercial, Paper e dinheiro real — com decisões explícitas de bloqueio.
- **B260:** guarda o diff aditivo e revalida regressão completa, build, localhost, navegador, ausência de cobrança/ordens e guarda evidências reproduzíveis.

## Política de segurança

1. CI verde não é aceite do responsável do produto, aprovação do gateway financeiro ou autorização de corretora.
2. Contas, chaves, CPF, tokens e identidades reais não devem aparecer em código, logs, artefatos, GitHub ou chat.
3. O novo endpoint administrativo só opera quando `VERCEL_ENV=preview`, `JENIOS_QA_CANDIDATE_ENABLED=true` e `JENIOS_QA_ADMIN_READONLY_ENABLED=true`, com bearer de usuário administrador verificado pela Platform. **Não ativar esses flags na produção.** Não há botão de aceitação financeira.
4. Não foi instalado worker em host Linux, configurado cofre externo ou transmitida ordem externa, Paper ou Live.
5. Nenhum Pix, cobrança, concessão de acesso, renovação real ou integração financeira foi acionado.
6. Estudos privados B182 mostram desempenho histórico majoritariamente negativo, portanto **nenhuma alegação de lucratividade**.
7. Preservar Vercel `jenios-ecossistem`, produção B177-R3, até revisão do candidato e autorização específica.

## Critérios reais pendentes antes do lançamento

- Aprovação de produto e teste autenticado em Preview protegido para o caminho público informacional.
- Emissão e confirmação de eventos financeiros em **sandbox oficial** com credenciais configuradas por canal seguro e autorização de testes específica, sem cobranças reais.
- Instalação de servidor Linux privado e cofre, com custo aprovado separadamente; homologação GET da própria conta Alpaca Paper. Qualquer POST Paper exige autorização própria.
- Validação original e prospectiva do núcleo proprietário com fonte independente de mercado, custos reais, slippage, drawdown e revisão de risco.
- Revisão jurídica, termos do fornecedor, proteção de dados, autorização de marca e decisão final de publicação diferenciada por módulo.

Este checkpoint é preparação para homologação, não autorização implícita de deploy ou de dinheiro real.
