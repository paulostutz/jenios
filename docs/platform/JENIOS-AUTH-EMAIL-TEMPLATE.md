# JENIOS — Templates institucionais do Supabase Auth

## Identidade aprovada
Todos os templates usam o mesmo padrão visual aprovado no teste de e-mail JENIOS:
- violeta `#7c3aed`;
- verde `#10b981`;
- fundo `#f8fafc`;
- logo oficial JENIOS;
- assinatura institucional;
- nenhuma marca interna de desenvolvimento aparece ao cliente.

## Templates preparados
| Fluxo Supabase | Arquivo | Assunto recomendado |
| --- | --- | --- |
| Confirm sign up | `jenios-confirmation.html` | `JENIOS | Confirme sua conta` |
| Reset password | `jenios-recovery.html` | `JENIOS | Redefina sua senha` |
| Change email address | `jenios-email-change.html` | `JENIOS | Confirme seu novo e-mail` |
| Reauthentication | `jenios-reauthentication.html` | `JENIOS | Código de verificação` |
| Password changed notification | `jenios-password-changed-notification.html` | `JENIOS | Sua senha foi alterada` |
| Email changed notification | `jenios-email-changed-notification.html` | `JENIOS | Seu e-mail foi alterado` |
| Sign-in method linked | `jenios-identity-linked-notification.html` | `JENIOS | Novo método de acesso vinculado` |
| Sign-in method removed | `jenios-identity-unlinked-notification.html` | `JENIOS | Método de acesso removido` |
| Verification method added | `jenios-mfa-enrolled-notification.html` | `JENIOS | Nova verificação adicionada` |
| Verification method removed | `jenios-mfa-unenrolled-notification.html` | `JENIOS | Verificação removida` |

## Variáveis obrigatórias preservadas
- confirmação/recuperação/troca de e-mail: `{{ .ConfirmationURL }}`;
- troca de e-mail: `{{ .NewEmail }}`;
- reautenticação: `{{ .Token }}`;
- alerta de troca de e-mail: `{{ .OldEmail }}` e `{{ .Email }}`;
- identidade vinculada/removida: `{{ .Provider }}` e `{{ .Email }}`;
- MFA: `{{ .FactorType }}`.

## Aplicação no Supabase hospedado
A aplicação final é feita em **Authentication → Email Templates** e **Security notifications** no projeto `jenios-social-homologacao`.
O conector atual não expõe a alteração dessas configurações de Auth, portanto os arquivos ficam versionados e certificados antes da publicação manual.

A documentação oficial do Supabase também permite edição via Management API usando um access token do painel; nenhum token administrativo é armazenado no repositório.

## Estado
A recuperação de senha da aplicação já usa `resetPasswordForEmail(...)` e redireciona para `/redefinir-senha`.
Os templates deste bloco não alteram SMTP, remetente, domínio, pagamentos ou produção.
