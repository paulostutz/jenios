# JENIOS S03 — Escopo executado e limites de homologação

**Referência de produção congelada:** release af86e69e5a0d5f344e89e2403210ff9fb5062315, deployment dpl_7vDVvGwfT6HKYf8n37EoBk9ccf24.

Esta branch é **preview/homologação**, não substitui `main` nem produção. Os módulos da Platform B52 e seus algoritmos de estratégia **não fazem parte deste repositório público**.

## B01 — baseline, segurança e mobile
- A produção e o rollback anterior foram identificados por commit e deployment.
- Os oito objetos Git das APIs sensíveis (mídia/video, BankScore, Validador, JENIOS PAY, admin e bibliotecas críticas) foram congelados por SHA-1 do blob Git e têm testes de regressão que impedem alteração inadvertida.
- Prévia HTML isolada da LP e do portal foi verificada pelo Chromium em 7 larguras (320, 360, 390, 430, 768, 1024, 1440); esses resultados **não são testes da Vercel publicada**.
- Acesso HTTP direto à produção e à prévia via browser no container ficou bloqueado por política do ambiente (`ERR_BLOCKED_BY_ADMINISTRATOR`), sem contornar a restrição.

## B02 — @ público e cadastro
- Fluxo de login/cadastro real integrado ao Supabase, deixando de apresentar um login fictício na rota `/cadastro`.
- Política de @ normalizado, sugestão de alternativas e teste de concorrência simulada no servidor.
- Arquivo SQL de referência com índice canônico único, trigger de cadastro atômico e RPC pública limitada: **não aplicada ao Supabase de produção**.
- Antes da migração, a disponibilidade é fail-closed (HTTP 503) e a inscrição com @ fica bloqueada intencionalmente; nunca alegar que há disponibilidade sem consulta real ao banco.

## B03 — relatórios BankScore e token
- Além do JWT válido, o relatório gratuito no pré-lançamento exige `profiles.id` correspondente ao usuário. Usuário somente com registro auth mas sem perfil Social não acessa.
- As rotas de PDF, APIs financeiras, consulta pública, permissões admin e checkout não foram alteradas.
- A ausência de perfil ou falha de banco bloqueia o relatório sem criar pedidos, pagamentos ou privilégios.

## B04 — vídeo
- O player usa o vídeo original imediatamente quando entra no viewport. Transcodificação fica opcional e em segundo plano, nunca bloqueando a reprodução; não muda o arquivo original.
- A transcodificação só é acionada com `NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO=true` **depois** de testar FFmpeg no runtime. Por padrão desativada, pois Vercel registrou aviso de script de instalação não autorizado para `ffmpeg-static`.
- Nenhum endpoint de upload, vídeo, autenticação ou armazenamento existente foi modificado.

## B05 — teste de sete dias por pessoa
- Serviço de concessão central e único baseado em identidade CPF **verificada por provedor externo**, sem confiar em CPF autodeclarado, e HMAC com segredo server-side.
- SQL revisão apenas para ledger transacional com `subject_digest` único e `user_id` único; 168 horas exatas, sem cobrança.
- Sem provedor de identificação de pessoa, segredo HMAC e migração aprovada, o serviço fica indisponível; **não existe teste grátis público ativado**.
- CPF não fica no ledger; o digest é dado pessoal pseudonimizado sob a LGPD. Retenção, oposição e finalidade devem ser revistas formalmente antes de uso real.
- Módulos de cobranças, assinaturas e execução real continuam desabilitados como anteriormente.

## B06 — privacidade/exclusão
- Fila de **solicitação** de exclusão e endpoint de **cancelamento apenas enquanto pendente**, limitado ao próprio titular autenticado, com revalidação da sessão.
- A conta não é apagada; nenhum dado, postagem, arquivo, pagamento ou histórico é excluído automaticamente.
- A extensão da RLS permitindo cancelar pedido próprio está em SQL staging/review e **não aplicada** ao ambiente de produção.

## Critérios de release
1. Build remoto e testes automatizados aprovados.
2. Migrações de homologação testadas em instância separada, não na produção.
3. Homologação real de cadastro com @, vínculo Social, vídeos, relatórios e permissões.
4. Revisão de segurança, privacidade e suporte sobre CPF e processamento de exclusão.
5. Publicação futura **somente após nova autorização**.

**Não contabilizar como concluídas:** migrações não aplicadas, operações reais, pagamentos, teste grátis público, exclusão definitiva, testes de navegador remoto não executados.
