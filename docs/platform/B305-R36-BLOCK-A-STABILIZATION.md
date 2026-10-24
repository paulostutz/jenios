# B305-R36 — Bloco A: estabilização e contratos de jornada

Data: 24/10/2026. Base: c18eec737d67e2e884cbfb81b288f88b9089695c (R35).
Backup pré-alteração: backup/jenios-b305-r35-before-block-a-20261024.
Escopo: administração e testes de contratos de acesso/aprendizagem. Sem robôs, CHEFE, LETTER ou Work.

## Correção e observabilidade
- A contagem de jenios_email_preferences_b305 seleciona user_id, coluna existente no esquema QA, em vez de id.
- O teste de contrato rejeita colunas inexistentes; a versão R35 falhou nesse teste antes da correção.
- O painel consulta a RPC existente jenios_email_preflight_b305(), sem criar migração nem replicar objetos.
- O preflight expõe somente booleanos. allRequired é recalculado: não se aceita esse campo isolado sem os 17 objetos confirmados.
- RPC ausente, erro ou resposta malformada bloqueiam a prontidão. Contagem com erro não vira fila vazia saudável.
- O painel distingue presença de objetos de homologação real e descarta dados antigos quando a atualização falha.
- Acesso Master, GET-only, no-store e proibição de controles de envio são preservados.

## Testes de jornada
Integração em processo usando os módulos reais de autorização, serviço de aprendizagem, repositório, diagnóstico e acesso da Platform, com Auth e armazenamento substituídos por fixtures locais.
- Sessão ausente, expirada, anônima ou do projeto errado é recusada.
- user_metadata e perfis operacionais não concedem acesso à Central Master.
- Admin-preview da Universidade permite trilhas livres, sem nota, placement ou onboarding obrigatório.
- Progresso persiste entre requisições da fixture e não atravessa usuários.
- Escritas concorrentes com revisão desatualizada são recusadas.
- Identidade injetada, aula inexistente e corpo excessivo são recusados.
- Diagnóstico vinculado ao usuário validado, sem alteração da metodologia ou dos modos dos robôs.
- Cadastro desligado não chama signUp; recuperação usa rota Platform; sessão expirada não altera senha; logout limpa somente dados locais próprios.

## Limite de aceite
Esses testes NÃO equivalem a login com Supabase hospedado, leitura de e-mail de recuperação, persistência em dispositivo ou jornada comercial de assinante.
Nenhuma conta, assinatura, pagamento, permissão real ou credencial foi criada. Os testes da Universidade usam admin-preview na fixture, não comprovantes financeiros fabricados.
Ainda é necessário validar a jornada hospedada com identidades QA pelo fluxo oficial e autorização específica para mensagens reais, antes de considerar o Bloco A integralmente homologado.

## Segurança operacional
Não abrir gates, não modificar produção, não efetuar cobranças/envios/ordens ou chamadas pagas.
Sem mudança de banco nesta revisão. O preflight verifica presença, não todas as permissões ou os fluxos externos.
CI e Preview devem ser lidos para o commit exato antes de declarar certificação. Evidências locais e logs de CI são complementares.
