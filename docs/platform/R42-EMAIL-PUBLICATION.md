# R42 — implantação dos e-mails JENIOS

## Escopo e origem

Release `release/jenios-email-r42-20261024`, derivada da produção efetiva
`caaffece04649a6dc1ca6c8012d7502887771529`, e não da branch de desenvolvimento completa.
Backup anterior: `backup/jenios-email-before-r42-20261024-caaffece`.

A publicação foi solicitada expressamente pelo titular em 24/10/2026. O titular
reafirmou que confirmação do primeiro e-mail e recuperação de senha já foram
testadas e estão nos backups. O aceite manual histórico registrado no B49 é
preservado. Este bloco não exige nova repetição desses testes nem altera o fluxo
Auth em produção.

O manifesto `R42-PRODUCTION-BASELINE.json` verifica 818 arquivos da produção
sem alteração. Apenas a navegação do Admin e a identificação da branch exata
de release são ajustadas entre os 820 arquivos herdados. Os demais arquivos
são os recursos de e-mail e sua validação. Dependências, checkout, robôs,
integração bancária e vínculo existente da Platform são preservados.

## Entregas

- Reutiliza logo, paleta, assinaturas e dez templates Auth do B305 já aprovados.
- Confirmação financeira somente com comprovação bancária e titular verificados.
- Boas-vindas, eventos de assinatura e marcos educacionais com evidência persistida.
- Régua de vencimento D-3, D0, D+1 e D+7, com identificação do ciclo correto.
- Recuperação de carrinho, relacionamento e Radar com consentimento, preferências,
  supressão de bounce/complaint e limite de frequência.
- Dispatcher privado com lotes pequenos, prioridade para mensagens essenciais,
  corte de ativação, reservas duráveis e tratamento conservador de resultado incerto.
- Admin de e-mails com indicadores e Radar em `/admin/emails/radar`:
  rascunho, revisão, aprovação/agendamento e arquivamento, com autorização Master,
  controle de versão e auditoria na mesma transação.

O Radar precisa de uma edição editorial aprovada com fontes. Esta release não
cria notícias fictícias nem contrata geração por IA. Os templates adicionais
de onboarding, resumo mensal e NPS são preservados sem atribuir a eles eventos
automáticos que ainda não estão integrados à produção.

## Operação

O agendamento usa o `pg_cron` e o `pg_net` já instalados no Social de produção
`igayfjorjmucthlfoasf`, a cada cinco minutos. O novo segredo exclusivo do
dispatcher é armazenado como sensível na hospedagem e criptografado no Vault.
O job anterior de tendências permanece independente. Nenhum upgrade de plano
de hospedagem é necessário para esta decisão.

Defaults configuráveis: 40 reservas de aplicação/dia, 1.000/mês; marketing
até 10/dia e 250/mês; lote de uma mensagem por fila/invocação. Essas reservas
não representam a quota global do provedor, que pode incluir SMTP Auth ou
outros sistemas. Uma mensagem conserva sua reserva idempotente; retries que
atravessam o dia são contabilizados no período correspondente.

Marketing só é liberado com webhook assinado pronto. Agendamento, gates,
configuração de credenciais, resposta do endpoint e entrega externa são
evidências diferentes: nenhum valor de configuração certifica recebimento.
O corte de ativação impede o disparo em massa de filas históricas.

## Verificação e publicação

O workflow `jenios-email-r42.yml` verifica a produção preservada, as regressões,
o build Next e as migrações em PostgreSQL 17 descartável. Os testes SQL locais
usam PostgreSQL 16 descartável e não criam usuários/pagamentos em produção.
O artefato do workflow contém o ZIP da fonte exata e seu SHA-256.

Este documento acompanha o candidato de código. O checkpoint final registra
o SHA efetivamente publicado, o deployment, a aplicação das migrações, a
configuração real e o resultado observado do agendador. Até esse registro,
não se deve interpretar a existência do código como ativação remota.
