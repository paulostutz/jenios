# JENIOS R26 — ensino T.Jenio: entrega preservada

Data: 16/10/2026. Escopo exclusivo: JENIOS Platform.

## Estado da implementação
Código R25 + R26 reunido no pacote privado. Não aplicado à main e não publicado no domínio nesta etapa. A conferência final da main retornou 8bcdef507ee2774bc24f832e1d04608fde16aea9. A Vercel continuou recusando autorização (403) à equipe/projeto conhecidos; não houve tentativa de contornar o bloqueio.

## Módulo preparado
Rota /platform/aprender, com links nas áreas de gestão e operações, sem inserir o professor na Social. Incluído igualmente nos três produtos de assinatura vigentes: platform-nacional, platform-global-crypto e platform-internacional-pro. Conta e vigência conferidas no servidor; falha de verificação não libera acesso. Preview administrativo é identificado.

Professor Gênio ou Gênia com avatares humanos escolhidos pelo proprietário, mesmo conteúdo e critérios para ambos. Pesquisa inicial de experiência, objetivo e tempo disponível; avaliação de 12 questões e percurso com ritmo/revisão/prioridade de risco conforme respostas.

Cinco trilhas: fundamentos, gráficos, execução, estratégias e laboratório Hard. Quinze aulas iniciais originais e banco de quarenta questões. Aulas com objetivos, explicações, exemplos fictícios, exercícios e fontes. Comparação educativa de candles, barras, linhas e agregação de período em dados sintéticos.

Avaliações ao fim das trilhas, correção no servidor, respostas explicadas, pré-requisitos e revisões. Critério inicial: pelo menos 80% e acerto dos itens críticos; configuração pedagógica de produto, não certificação ou escala científica. Progresso individual com controle de revisão para evitar sobrescrita entre abas. Aprovação não concede permissão financeira e não substitui o diagnóstico operacional de 15 operações.

Integração opcional de professor generativo via API da OpenAI, apenas no servidor, com consentimento e limites de uso. Não configurada nem homologada ao vivo nesta entrega. Sem provedor ou consentimento, há modo guiado explicitamente identificado. Não se afirma que a IA aprendeu tudo ou que os vídeos/livros citados foram estudados integralmente.

## Alteração efetiva no banco
Migração jenios_learning_state_r26 aplicada ao projeto Supabase existente. Criou somente public.jenios_learning_state. RLS ativado; leitura/gravação direta de anon/authenticated negadas; DML do serviço autorizado. Nenhuma tabela preexistente, conta, assinatura, dado social ou registro bancário foi alterado.

Teste real transacional verificou inserção com FK, primeira atualização condicional, recusa de revisão antiga, recusa de revisão negativa, estado não-objeto e tamanho excessivo. Transação revertida por ROLLBACK; consulta posterior confirmou zero registros de aprendizagem. O advisor foi executado e os alertas preexistentes/INFO de tabela fechada foram documentados, não apresentados como auditoria sem pendências.

## Testes
- Aplicação completa: 361 aprovados, incluindo 46 de ensino; zero falhas/ignorados.
- Núcleo privado de operações R25: 72 aprovados novamente; nenhuma ordem real enviada.
- Build otimizado Next.js: aprovado com variáveis fictícias de QA.
- Navegação interativa: bloqueada no ambiente por ERR_BLOCKED_BY_ADMINISTRATOR; NÃO aprovada.
- Prévia estática em 390/1440 pixels: renderizada sem rede e sem rolagem horizontal, não equivale a E2E.
- Transporte e falhas da IA: respostas controladas, sem alegar conexão real.
- Comparação contra R24: sem alterações nos arquivos protegidos de Social, BankScore, Validador, PDF e PAY.

## Backup consolidado
Salvo na Biblioteca do proprietário: /JENIOS-Platform-R26-completo-privado.zip.
Tamanho: 3.342.030 bytes; 449 arquivos; manifesto conferido após compactação.
SHA-256: 66ae094d8e1cc59f6815d38bdb3488f43c5b29e7f564428a4f766d755c136ead.
Commit LOCAL de fontes: 40430de2902db921b833cd2fab760ec9bcbcdd1f; não confundir com commit remoto.
O núcleo proprietário continua separado e não foi enviado ao GitHub público. Pacote contém fontes completos, testes, documentação, prévias estáticas, limites, sugestões de nomes e checkpoints locais.

## Continuidade
Faltam liberação Vercel, migração do framework legado com regressão global, configuração/homologação da IA e E2E autenticado antes da liberação da escola. Revisões R25 da LP/gestão/Admin continuam no pacote sem deploy. Conta admin@jenios.com.br não foi provisionada.

Atendimento geral Gênio/Gênia, alertas WhatsApp, integração conversacional ao Hub/BankScore/Validador, diário e diagnóstico operacional persistentes, sinais atribuídos a fontes ainda não confirmadas, roteamento e homologação financeira continuam discriminados no backlog. A escola não é apresentada como conclusão desses módulos.
