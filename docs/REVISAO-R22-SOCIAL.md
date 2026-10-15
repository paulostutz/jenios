# Revisão R22 — Arquivados e movimentos atuais

15/10/2026. Branch de teste: `codex/social-r16-teste`.

## Arquivo privado

- A navegação e a aba do próprio perfil passam de Salvos para Arquivados.
- O autor pode arquivar uma publicação permanente pelo menu do post no feed ou pela sua própria galeria. Publicações de terceiros não oferecem essa ação.
- O post arquivado some do feed, da galeria pública e dos links diretos. Somente o autor pode consultar seu arquivo.
- Arquivados permite abrir o conteúdo completo e desarquivar. A restauração conserva data original, mídia, curtidas e comentários; não cria outra publicação nem republica com horário novo.
- Stories que referenciam um post arquivado deixam de ser visíveis enquanto o original está arquivado. Publicidade não pode contratar ou entregar um post arquivado.
- A privacidade é aplicada no PostgreSQL por RLS, além das verificações da API. A API sempre filtra o UUID do autor na leitura e alteração do arquivo.
- O histórico antigo de bookmarks não foi apagado. A interface de Salvar foi substituída conforme solicitado.

## Baleias

A consulta analisa resumos de até três blocos Bitcoin recentes e verifica as transações candidatas completas antes de publicar qualquer valor. Só qualifica maior saída >=100 BTC, confirmação válida, hash correspondente e horário não futuro. O total de saídas de um resumo não basta para classificar uma transação.

Quando há registros confirmados na janela dos últimos 15 minutos, mostra esses movimentos. Quando não encontra movimento atual, mostra os três últimos movimentos registrados, ordenados pelo horário de confirmação e identificados como histórico, com data e hora em America/Bahia. Se houver indisponibilidade do provedor, mantém a identificação de histórico e avisa que a leitura atual falhou.

O histórico é persistente no servidor e permanece após recarregar ou publicar outra versão. Foram obtidas nove transferências reais na verificação inicial e armazenadas no histórico, sem dados fictícios. A cobertura é de Bitcoin, limitada aos blocos/candidatos consultados; não é monitoramento de todas as redes nem identificação de compras ou instituições. O horário exibido é da confirmação em bloco; transações do mesmo bloco compartilham esse horário.

## MegaPulse

- Removido o uso de fechamento diário de futuros como movimento atual.
- Apenas cotações de ações B3 com horário de negociação válido de até 120 segundos são aceitas. Preço, variação do pregão, volume e ticker precisam ser válidos.
- Dados vencem também no navegador, mesmo se uma consulta falhar. Não existe fallback de MegaPulse para fechamento ou cotação antiga.
- Sem cotação recente confirmada, a mensagem é “Sem movimentos recentes confirmados agora”. Na consulta real, o provedor retornou cotação atrasada, que foi descartada como previsto.
- Cobertura inicial de ações: PETR4, VALE3, ITUB4 e MGLU3. Futuros aguardam uma leitura intradiária verificável; a API anterior fornece fechamento de pregão e não satisfaz essa exigência. Esta revisão não adiciona um fornecedor pago nem altera credenciais.

## Verificação

- Testes focados de Social, Direct, tendências, pagamentos e regressão BankScore aprovados.
- PostgreSQL local comprovou: outro usuário não arquiva/restaura o post; arquivo fica privado; comentários/curtidas e Stories vinculados somem para terceiros; restauração recupera as relações e preserva created_at; histórico de baleias só permite escrita do servidor.
- Navegador com contas sintéticas e respostas simuladas comprovou arquivar, abrir o arquivo, recarregar, desarquivar, ausência da ação em post de terceiro, três movimentos com horário e rejeição de cotação antiga.
- Build de produção concluído. Migrações aplicadas: `20261015214615_social_post_archive_r22` e `20261015214619_trend_history_r22`.
- Os 29 arquivos de implementação do BankScore continuam idênticos à revisão anterior. O teste HTTP do novo preview deve confirmar ranking e laudo antes de entregar o endereço.
- Inter permanece pendente de configuração e teste bancário real pelo usuário, conforme combinado. A implementação Pix da R21 permanece disponível.
