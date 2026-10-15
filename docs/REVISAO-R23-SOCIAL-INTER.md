# Revisão R23 — Vídeos, alertas e administração

Branch: `codex/social-r16-teste`. Preserva a consulta pública e os cálculos do BankScore.

## Vídeos

- Novos vídeos são enviados diretamente ao Storage; o servidor prepara uma versão MP4 H.264/AAC com faststart, até 720p e 30 fps. Apenas a URL processada entra na publicação.
- Uploads grandes continuam usando TUS. A interface diferencia envio de preparação. Uma falha na preparação preserva o caminho já enviado para repetir somente essa etapa.
- Vídeos antigos vinculados a posts acessíveis podem receber a mesma versão de reprodução sob demanda, com verificação de sessão e acesso ao post. O arquivo original não é apagado.
- O player carrega metadados somente perto da área visível, pausa fora dela e ao reproduzir outro vídeo. A mídia não viaja no JSON do feed.
- Evidência real: arquivo de 23.073.779 bytes, 3840×2160 a 120 fps e 2,79 segundos convertido em 722.755 bytes, 1280×720 a 30 fps. Redução de aproximadamente 97%. Conversão local; a primeira preparação no servidor ainda depende do tamanho e da complexidade do vídeo.
- O processamento aceita somente contêineres de vídeo locais, sem protocolos de rede do FFmpeg, com limite de duração, tamanho, tempo e limpeza de temporários.

## Alertas do Hub

- Botão “Ativar alertas” em Tendências de busca, MegaPulse, Movimentações de baleias e Tokens Explosivos, no Hub e na lateral da Social.
- Conta autenticada obrigatória. Preferências individuais persistidas. O usuário pode desativar qualquer módulo.
- Tokens Explosivos vazio passa a convidar para receber avisos. Os critérios e limites permanecem acessíveis pelo botão de ajuda, sem o parágrafo extenso no estado vazio.
- Novidades chegam à Central de Notificações da conta. Esta revisão não envia e-mails nem notificações push do navegador.
- Verificação agendada a cada três minutos, eventos únicos e intervalo mínimo de 30 minutos por usuário/módulo. A primeira leitura cria a referência inicial sem notificar conteúdo antigo. Baleias históricas e cotações vencidas não geram alertas atuais.
- Credencial interna aleatória armazenada no Vault; o banco armazena seu hash para autenticar o worker. O agendamento aponta para o endpoint da versão publicada. Não há credenciais no código ou no backup.

## Administração

- `/admin/consultas`: laudos completos de BankScore e cripto, incluindo PDF, sem exigir compra para administradores com `reports.run`.
- `/admin/cobrancas`: gestão existente de produtos e pedidos, agora aceita a permissão `finance.manage`; inclui diagnóstico da conexão Inter.
- `permissions.manage` permite autorizar e remover acesso a consultas ou gestão financeira por @. A conta proprietária `@paulostutz` recebeu essas três permissões no servidor.
- Usuários não concedem permissões a si mesmos. Conferência ocorre no servidor com sessão validada. Operações administrativas são registradas em auditoria.

## Inter: o bloqueio observado e como conferir

As imagens mostram `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, `INTER_CERTIFICATE` e `INTER_PRIVATE_KEY` restritos à branch `preview-social-jenios`. A Social atual usa `codex/social-r16-teste`. Essa configuração não torna as credenciais disponíveis automaticamente na branch atual.

1. Na Vercel, abra o projeto `jenios-ecossistem` e as variáveis de ambiente.
2. Disponibilize as quatro variáveis Inter para Preview / `codex/social-r16-teste`, conservando o escopo antigo se ainda necessário. Use Secret.
3. Confira também `INTER_PIX_KEY`, com a chave Pix cadastrada na conta Inter, como Secret; e `JENIOS_PAY_PROVIDER` com valor `inter_pix`, como Config, nesse mesmo escopo. `INTER_ACCOUNT_NUMBER` é opcional, quando a integração exigir a conta.
4. Certificado e chave privada devem conter os PEM completos, com BEGIN/END e quebras de linha. Não são caminhos para arquivos.
5. Faça redeploy e abra o novo deployment. No painel de cobranças, use sua sessão e clique em “Testar conexão com o Inter”.
6. O teste verifica presença, validade e correspondência do certificado e faz autenticação/consulta Pix. Não emite cobrança.
7. Depois, use uma compra da Social para validar emissão, pagamento e atualização do pedido. A confirmação exige resposta bancária compatível com valor, Txid e destinatário; não há baixa manual que simule pagamento.

Pedidos, cobranças e pagamentos já são persistidos no Supabase e consultados no admin. Criar outra carteira ou guardar credenciais no formulário administrativo não resolve a ausência das variáveis no deployment. A implementação direta Inter usa mTLS e solicita `cob.read cob.write`; essas permissões também precisam estar habilitadas na integração do banco.

**Nenhuma cobrança bancária real foi criada ou paga nesta revisão.** O acesso de gestão Vercel disponível na sessão não permitiu conferir ou alterar as variáveis remotamente. O painel novo permite ao proprietário verificar o ambiente sem revelar os valores.

## Validação e limites

- Testes automatizados de permissões, deduplicação de alertas, rejeição de histórico/vencidos e retentativa de upload, além da suíte de regressão existente.
- PostgreSQL local: preferências privadas, impossibilidade de autoatribuir acesso, notificações protegidas, primeira leitura silenciosa, deduplicação, intervalo mínimo e cancelamento da assinatura.
- Conversão do arquivo real e build de produção aprovados.
- Navegador usa contas sintéticas e respostas controladas para testar o fluxo de conta, alertas, laudos administrativos, diagnóstico e reprodução do MP4 real. Não equivale a uma operação bancária real.
- Migrações aplicadas: `20261015234626_social_alerts_admin_r23` e `20261015234654_trend_alert_scheduler_r23`.
- Futuros intradiários e integração de domínio seguem fora desta revisão. MegaPulse só publica movimentos que atendam à verificação de atualidade existente.
