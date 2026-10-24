# B305 R41 — Master, primeiro acesso e alteração do próprio e-mail

## Objetivo e base

Continuação do R40 certificado no commit `c159e40bd78ae324be2a7403956693cb81994817`.
O titular escolheu o endereço de acesso e pediu poder alterá-lo posteriormente
pelo Admin. A execução permanece na branch B305 e nos serviços de homologação.

Backup anterior: `backup/jenios-b305-r40-before-master-r41-20261024-c159e40`.
O fonte R40 foi recuperado do artefato completo e conferido por SHA-256
`78a912c854034cf8e25ffda339085c5d2cdeaca1d86a0c201a3a507a57ef4997`.

## Comportamento disponível

- `/admin/login` normaliza o e-mail e oferece **Primeiro acesso / Esqueci minha senha**.
- `/admin/recuperar-senha` solicita a recuperação pelo Auth. O retorno fixo é
  `/admin/redefinir-senha`; a volta ao painel é `/admin/login`.
- `/admin/meu-acesso` usa o controle Master existente. Mostra o e-mail atual,
  o endereço pendente e o identificador da conta; solicita a mudança com
  `auth.updateUser({email}, {emailRedirectTo})` e confirmação normal do Auth.
- O papel Master permanece em `app_metadata`/UUID. A troca de e-mail não altera
  permissões, histórico, identidade ou outra conta.
- Os caminhos Social de recuperação continuam `/recuperar-senha`,
  `/redefinir-senha` e `/login`. Nenhuma URL arbitrária de retorno é aceita.

## Proteção da identidade nas operações assíncronas

O helper valida a conta pelo Auth e captura UUID/token reais da sessão corrente.
As atualizações de e-mail e senha usam um cliente descartável do SDK pinado
`@supabase/supabase-js`/`auth-js` 2.117.3, inicializado pela API pública `setSession`
com a mesma sessão válida, sem persistência, renovação automática ou leitura da URL.

O transporte permite apenas GET/PUT de `/auth/v1/user` do projeto configurado,
exige o Bearer capturado e bloqueia refresh, Auth Admin e outros destinos. Há
conferência da identidade antes do envio e depois da resposta, inclusive durante
a leitura tardia do corpo. Tokens com menos de 120 segundos de validade são recusados.
O cliente é liberado por `auth.dispose()`, sem encerrar outra sessão do navegador.

A interface invalida operações ao trocar sessão, perder a identidade, desmontar
ou revalidar o acesso. Campos sensíveis são limpos após a operação. Recuperação
não usa mais `updateUser` ou `signOut` no singleton após uma espera, o que poderia
atingir a conta seguinte. Mensagens não expõem payloads do provedor nem anunciam
confirmação ou logout que ainda não ocorreram.

## Criação inicial do Master

A busca anterior confirmou ausência do endereço escolhido no Social QA e no
Platform QA. Somente o Social QA `rebzztxlzofxpfwjvbee` recebeu a conta Master.
A criação utilizou a API oficial Auth Admin, não SQL sobre `auth.users`.

O módulo operacional `scripts/admin/master-provision-r41.mjs` foi implantado
temporariamente com escopo fixo, Bearer aleatório de 256 bits, hash no servidor e
prazo máximo de 15 minutos; a implantação utilizada teve validade de 10 minutos.
O módulo recusa contas preexistentes inesperadas e busca o marcador da operação
em todos os endereços para não recriar o e-mail antigo depois de uma troca.

O Auth criou a conta não anônima com `role: master` em metadados protegidos e
`email_confirm:false`. Nenhuma senha foi fornecida: o Auth gera uma senha aleatória
internamente, e o titular define a sua pela recuperação verificada. A operação
não envia convite, não gera link de sessão nem confirma e-mail por administração.
O UUID e o papel foram verificados novamente pela API e por leitura do banco.

A função `jenios-r41-master-provision` foi imediatamente substituída pela versão 2,
inerte, com `verify_jwt:true` e resposta `BOOTSTRAP_CLOSED`. Seu código não lê
credenciais nem acessa Auth. O token temporário foi removido do ambiente local.
A função permanece registrada apenas como encerrada; não foi excluída fisicamente.
Nenhum segredo ou endereço do titular foi incorporado ao código do produto.

## Pré-requisitos administrativos restaurados

A inspeção encontrou `jenios_admin_permissions` e `jenios_admin_audit` ausentes no
Social QA. Isso impediria o registro de auditoria após salvar a configuração do
Inter. A migração R41 replica somente esses pré-requisitos já definidos no R23,
sem instalar os módulos de tendências do R23.

Migração aplicada: `20261024172157_jenios_b305_master_admin_r41`.
O arquivo foi criado pela CLI oficial e alinhado à versão registrada pelo serviço.
As tabelas têm RLS, nenhuma permissão para `anon`/`authenticated`, referências a
`auth.users` e índices das chaves estrangeiras. `service_role` pode ler/inserir
auditoria, mas não atualizá-la nem apagá-la; pode ler/inserir/remover concessões.

O teste SQL versionado realiza uma inserção real de auditoria como `service_role`
sob rollback e consulta a matriz de privilégios. Foi concluído com zero registros
de teste remanescentes. A variante inicial maior recebeu erro de transporte MCP
`Invalid or expired requestState`; a verificação foi concluída pela variante
menor reproduzível, sem testes destrutivos. Os dois novos avisos INFO de RLS sem
política são esperados para tabelas acessíveis somente ao backend; não houve
adição de permissão de navegador.

## Verificação e limites

O workflow B305 preserva as regressões R36–R40, acrescenta os testes R41 de conta,
recuperação, bootstrap e SDK real com transporte exclusivamente local, e executa
a regressão completa e o build Next. O artefato `JENIOS_B305_R41_FULL_SOURCE`
contém o fonte integral, commit e SHA-256. O checkpoint externo registra o resultado
final da CI, o Preview pinado e as verificações hospedadas.

O cadastro administrativo foi criado e permanece aguardando confirmação legítima
do titular. Entrega do e-mail, lista de redirects autorizados do Auth e SMTP
customizado **não estão certificados**: essas configurações não são expostas pelo
conector e o painel do Supabase apresentou a tela de login. Isso não demonstra
configuração incorreta; demonstra ausência de evidência nesta execução.

Para o aceite final, o titular deve solicitar a recuperação, abrir o link recebido,
definir sua senha e entrar no Admin. Depois pode solicitar a alteração em
**Meu acesso**, concluir as confirmações e verificar o acesso pelo novo endereço.
Os redirects devem autorizar a origem efetiva do Preview para
`/admin/redefinir-senha` e `/admin/meu-acesso` antes de certificar esse percurso.

O R40 continua oferecendo o formulário Inter (Client ID, Client Secret, ZIP de
certificado/chave e chave Pix). As credenciais bancárias e o teste real autenticado
ainda dependem do titular. Nenhum Pix/cobrança, pagamento, e-mail transacional ou
robô foi ativado por R41. Não houve implantação ou alteração no ambiente de produção.
