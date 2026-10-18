# JENIOS S05-B42 — Executar a certificação autenticada sem tocar na produção

## Ambiente permitido
- Repositório: paulostutz/jenios.
- Branch: release/jenios-s05-integrada-homologacao-20261018.
- Prévia: URL Vercel isolada da branch, terminando em \`-jenios.vercel.app\`.
- Banco: projeto \`rebzztxlzofxpfwjvbee\` (jenios-social-homologacao).
- Produção \`jenios.com.br\` e Supabase \`igayfjorjmucthlfoasf\`: **NÃO utilizar**.

## Pré-requisitos do teste (nunca registrar no código, chat ou relatório)
Duas contas sintéticas de teste **já existentes** no Supabase isolado, confirmadas por e-mail e com perfil criado pelo trigger de cadastro, cada uma com senha conhecida apenas pelo operador autorizado. Credenciais não devem ser de usuários ou clientes reais.

Configure as variáveis de ambiente no terminal/sandbox isolado, sem deixar valores em logs:
\`\`\`sh
export S05_PREVIEW_URL='https://jenios-ecossistem-<preview-id>-jenios.vercel.app/'
export S05_STAGE_PUBLISHABLE_KEY='<publishable key do projeto de homologação>'
export S05_TEST_A_EMAIL='<identidade sintética A>'
export S05_TEST_A_PASSWORD='<senha sintética A>'
export S05_TEST_B_EMAIL='<identidade sintética B>'
export S05_TEST_B_PASSWORD='<senha sintética B>'
npm run test:e2e:s05
\`\`\`

O teste verifica **onze etapas reais**: dois logins independentes, publicação server-side, novo login de A e feed persistido, grade do perfil, leitura por B, proibição de B excluir, comentário e curtida de B, arquivamento privado, desarquivamento e exclusão pelo próprio autor.

**Limpeza automática:** o post criado tem marcador \`JENIOS-S05-E2E-NONPROD-\` e é excluído pela conta A. Se a limpeza falhar, o script registra somente \`S05_E2E_CLEANUP_REQUIRED_FOR_SYNTHETIC_POST_ONLY\` e exige reconciliação manual da publicação fictícia. Nunca apague registros pelo identificador de outra conta.

## Segurança
- O script **não cria contas**, não conhece service-role, não lê dados financeiros e recusa domínios que não sejam Vercel Preview.
- O emissor de tokens de Auth é fixo no Supabase de homologação; tokens do projeto isolado não autenticam no banco de produção.
- O script não armazena senhas, tokens JWT, e-mails, CPF, resultados pessoais ou uploads de mídia.
- Falha fechado quando as variáveis ou contas de teste não estão presentes.
- Os testes automatizados da rotina usam um servidor HTTP inteiramente simulado e não substituem a execução real acima.

## Gates adicionais antes de publicar
1. Certificação real E2E em homologação, incluindo *upload assinado de mídia* sob autorização testada separadamente.
2. Revisão da migração aditiva do projeto de produção, backup/rollback do banco e análise das permissões RLS. **Nunca aplicar o SQL \`supabase/release-review\` automaticamente.**
3. Verificar configuração final de variáveis Vercel de **Production** separadamente das onze variáveis exclusivas de Preview.
4. Confirmar BankScore e Validador gratuitos com perfil Social; PDF válido, zero cobranças, conteúdo idêntico ao laudo existente.
5. Testar em iOS/Android reais, confirmar integridade dos dez arquivos de API protegidos.
6. Somente então permitir deployment de **Production**, nunca promover a prévia com credenciais de staging.

## Estado atual
- B42: simulação HTTP de dois usuários aprovada; execução real ainda sem contas de teste disponíveis.
- Produção S02 intacta: commit \`af86e69e5a0d5f344e89e2403210ff9fb5062315\`.
- Não declarar 75% nem deploy completo sem evidências.
