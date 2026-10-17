# JENIOS S04 — critérios obrigatórios de homologação e proteção

Versão base de homologação S03: `eda27e9e3635083a64386e6e3b3b9c04f0d346d9`.
Último deployment de produção S02 verificado: `dpl_7vDVvGwfT6HKYf8n37EoBk9ccf24`, commit `af86e69e5a0d5f344e89e2403210ff9fb5062315`.

## Regra de execução

- Branch de desenvolvimento isolada; `main` sem merge. Vercel somente prévia, target `null`.
- Nenhuma execução de SQL na instância ativa `jenios-social`; as propostas ficam em `supabase/review-only`.
- Não criar Supabase branch ou outra infraestrutura com cobrança sem autorização adicional.
- Não ativar trial nem o processamento real da exclusão; nenhum Pix, pagamento ou operação de mercado.
- Sem alteração dos blobs SHA1 de APIs financeiras, BankScore, Validador, Pay, rotas originais de vídeo e utilitário atual de transcodificação.

## Identidade e cadastro — B02

- Validação cliente e normalização canônica do @, nome e e-mail. `user_metadata` não concede permissão.
- Verificação de disponibilidade é um indício **não uma reserva**. Unicidade atômica depende do índice e trigger SQL S03, ainda não aplicados.
- Homologação pendente: banco separado, migração auditada, 2 inscrições simultâneas reais e autenticação por e-mail, sem manipular usuários de produção.

## Trial — B03

- HTTP só é acessível quando `JENIOS_TRIAL_ENABLED=true` **e** `JENIOS_TRIAL_ACTIVATION_APPROVED=true`, com verificador independente, HMAC pepper e serviço Postgres.
- Sem provedor a verificação falha fechada. Não aceitar CPF, `verified:true` ou papel de usuário do navegador.
- O ledger gera um registro de 168 horas e nenhuma cobrança. Ainda não integra os entitlements pagantes. Nunca usar como prova de acesso real.
- LGPD: digest HMAC de CPF continua sendo dado pessoal pseudonimizado; exigir finalidade, prazos, acesso, recurso e política de rotação. A migração do S03 é somente proposta.

## Privacidade — B04

- Cadastro pode pedir exclusão, cancelar pendente e reabrir solicitação cancelada; sempre exige sessão recente.
- Reabertura usa RPC `social_reopen_deletion_request_v1`, disponibilizada **apenas** após migração revisada em staging.
- Exclusão definitiva de usuário, arquivos, pagamentos ou dados de terceiros não é realizada. A fila precisa de operador, inventário de retenção e protocolo de auditoria.

## Vídeo — B05

- O vídeo original pode tocar sem a conversão; transcodificação otimizada permanece opt-in.
- Teste FFmpeg sintético local passou; NÃO é comprovação do executável `ffmpeg-static` na Vercel.
- API de diagnóstico separa `disabled`, `unavailable` e `binary-present-unverified`. Não divulga caminhos locais nem credenciais.
- Exige testes futuros com upload e playback em iOS/Android, falhas de rede, conteúdo real autorizado e logs Vercel.

## Relatórios — B06

- As rotas de BankScore, Validador e admin não foram modificadas. Testes de autorização verificam perfil Social persistido, auth, permissões administrativas e cabeçalhos PDF.
- Acesso completo exige conta Social cadastrada e sessão; não alterar o preço/catálogo da plataforma ou JENIOS PAY.
- Requer ensaio real de PDF, download no navegador e auditoria com usuários do staging antes de promover.

## B07 / critérios para próximo release

- Aprovar regressão completa com dependências originais no build Vercel.
- Verificar hash de rotas críticas; revisar logs, status `READY` e target `null`.
- Salvar checkpoints B01–B07, manifesto do SHA do commit, hash do ZIP, logs de teste e rollback do S02.
- Se provedor de identidade, banco staging ou teste real de vídeo estiverem pendentes, a meta de 65% fica condicionada e o status de produção é **NO-GO**.