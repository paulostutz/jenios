# JENIOS R27 — atendimento Gênio/Gênia e atualização técnica

Data: 16/10/2026. Escopo: JENIOS Platform. Checkpoint documental; os fontes novos permanecem no pacote privado, não aplicados à main.

## Produção e preservação
Main conferida novamente em 8bcdef507ee2774bc24f832e1d04608fde16aea9. Vercel retornou 403 no escopo conhecido da equipe/projeto. CLI Vercel indisponível. Não houve deploy, alteração de domínio/variáveis ou tentativa de contornar autorização. Fontes de Social, APIs BankScore/Validador/PDF/PAY e núcleo de pesquisa privado foram preservados; o framework compartilhado foi atualizado apenas na aplicação preparada, exigindo homologação global antes de publicação.

## Implementação no pacote
Rota /platform/assistente. Escolha entre os dois avatares humanos Gênio/Gênia, com os mesmos critérios, dúvidas de uso e 12 artigos originais de suporte. Links nas áreas de gestão/operação/ensino, sem inserir o assistente na Social. Atendimento geral autenticado; a escola mantém sua própria regra de assinatura nos três planos.

Consultas por botões confirmados: Hub, cadastro de instituições, BankScore básico/síntese do laudo completo/PDF e Validador básico/detalhado/PDF. Reutilização dos handlers originais, com token do mesmo usuário e sem ampliar permissões, refazer API, criar cobrança ou marcar pagamento como aprovado. Resultados não são enviados ao modelo; geração de resposta de suporte opcional via OpenAI depende de configuração e consentimento.

Conversa somente na aba; preferências e contadores por titular no servidor com controle de revisão concorrente. Limites iniciais 30 consultas/hora e 100/dia. O modelo não tem ferramentas de execução. WhatsApp, monitoramento contínuo e ordens reais permanecem inativos. Perguntas sem fonte ou que solicitem melhor operação personalizada não recebem cotação ou sinal inventado. Primeira versão de suporte, não agente com memória longa nem conclusão do robô operacional.

## Atualização técnica preparada
Next.js 16.4.2, React/React-DOM 19.3.1, Supabase JS 2.117.3 fixados com lockfile. outputFileTracingIncludes atualizado de posição preservando caminhos de mídia; build Webpack. Comando next lint removido; verificação de sintaxe separada e não apresentada como lint integral.

GitHub Actions 38904243430 / artefato 12047054749 resolveu somente dependências públicas sem segredos ou código proprietário. npm audit do artefato retornou zero alertas na resolução; não é prova de ausência de vulnerabilidades da aplicação. O cache foi instalado com ignore-scripts e não contém binário ffmpeg-static de produção: instalação padrão e conferência do artefato de vídeo ainda obrigatórias antes do deploy.

## Alteração efetiva no banco
Criada somente public.jenios_assistant_state no Supabase existente, migração jenios_assistant_state_r27. RLS ativado, clientes anon/authenticated sem privilégios, DML do serviço autorizado. Guarda preferências/contadores, não conversas, laudos, credenciais ou operações.

Teste transacional real: inserção com FK, atualização condicional, rejeição de revisão antiga e negativa, de estado não-objeto e de tamanho excessivo, verificação de privilégios. Rollback executado; consulta posterior confirmou zero registros. Nenhuma tabela de negócio preexistente, conta, assinatura, pagamento ou publicação foi modificada. Advisor executado: INFO esperado de tabela somente-serviço e alertas preexistentes registrados, não tratados como auditoria sem pendências.

## Testes e limites
- Aplicação: 409 aprovados, zero falhas/ignorados; inclui 48 novos testes de atendimento.
- Núcleo privado: 72 aprovados novamente, sem ordens reais.
- Sintaxe: 307 arquivos; build otimizado concluído.
- HTTP local: 16 verificações aprovadas, com ambiente fictício de QA.
- Função original de transcodificação: vídeo sintético 1 segundo convertido para H.264/1280x720/faststart com FFmpeg local explicitamente injetado. Não equivale a empacotamento do ffmpeg-static ou reprodução no iPhone.
- Navegador interativo: ERR_BLOCKED_BY_ADMINISTRATOR; E2E NÃO homologado, sem desativar restrições.
- Prévia estática em 390/1440 px inspecionada sem rolagem horizontal; não é produção.
- IA/provedores de consultas testados com respostas controladas, não com conta ou credenciais reais.

## Backup integral
Salvo na Biblioteca do proprietário: /JENIOS-Platform-R27-completo-privado.zip.
Tamanho: 3.848.463 bytes; 506 arquivos; manifesto de integridade verificado após compactação.
SHA-256: a270898a91a8d78037b236bd3e751c31a0cb0146c41634a02927acfd54de7aa0.
Commit LOCAL dos fontes: 5968f8837df5bad3a841b991b060cc7c7c05921c, não confundir com commit remoto ou deploy.
Pacote cumulativo R25/R26/R27: aplicação, núcleo privado separado, documentação, scripts de testes, evidências e prévias. Núcleo privado não enviado ao repositório público.

## Continuidade
Pendentes: autorização Vercel/publicação e regressão interativa global; IA ao vivo/orçamento; conta admin@jenios.com.br; diagnóstico operacional e diário de 15 operações; fontes/calibração/validação financeira; corretoras e execução; monitoramento e WhatsApp. Nova busca não confirmou a lista exata dos 10 sinais/livro de Lorenz; nenhuma estratégia foi inventada ou atribuída a ele nesta revisão. A regra proprietária oficial não foi substituída por regras de suporte ou avaliações da escola.
