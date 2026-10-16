# R18 — Recuperação de senha

Login agora inclui Esqueci minha senha. /recuperar-senha solicita e-mail por resetPasswordForEmail e exibe confirmação genérica. /redefinir-senha valida usuário não anônimo, solicita nova senha e confirmação, trata links inválidos/expirados e atualiza com updateUser. Após atualização, encerra a sessão local e orienta novo login.

Requisitos da senha seguem o cadastro: 12 caracteres, maiúsculas, minúsculas, número e símbolo. Não há armazenamento de senha nem envio pela aplicação para terceiros além do serviço de autenticação Supabase.

Testes de navegador simulam solicitação, redirecionamento, link expirado, confirmação divergente e atualização. Nenhum e-mail real foi enviado nem senha real alterada. Falta homologar o e-mail completo e conferir a URL /redefinir-senha da publicação em Authentication > URL Configuration no Supabase; redirectTo depende da lista permitida. Referência oficial: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail .

## Bloqueio Vercel/BankScore
Plugin instalado, porém consulta às variáveis do projeto jenios-ecossistem na equipe jenios retornou HTTP 403 forbidden. A listagem de equipes da conexão retornou lista vazia. CLI não está disponível. Nenhuma credencial/configuração do projeto foi alterada. É necessário conceder à conexão acesso à equipe correta, ou ajustar manualmente a credencial server-side ausente na prévia, já identificada na R17.

## Verificação concluída

Build de produção aprovado. Teste de navegador aprovado com serviço de autenticação simulado: solicitação e retorno, link expirado, sessão pelo callback de recuperação, senhas divergentes e atualização. As 12 rotas sociais verificadas continuam respondendo 401 ao visitante. Evidências em docs/evidencias-r18/. O teste aguarda a hidratação antes de preencher e abre o callback em documento novo, como no acesso por e-mail.
