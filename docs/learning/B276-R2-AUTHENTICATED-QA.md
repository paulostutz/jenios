# JENIOS B276-R2 — Homologação autenticada da Universidade

**Data:** 21/10/2026. **Base certificada B276:** `d90c9309b3ea9f72c27e4355cf92b01a2eca6cc9`, CI `39602390922` concluída com sucesso. **Produção:** B177-R3 preservada, sem deploy.

## Por que existe o R2
A primeira homologação B276 comprovou a estrutura pedagógica em testes de serviço e realizou navegador Chromium público/visitante. O R2 adiciona navegação em Chromium com *identidades, respostas de API e armazenamento exclusivamente sintéticos*, mantendo a base aprovada inalterada.

## Ajustes estritamente necessários
- Invalidação de resposta de aula atrasada ao trocar de trilha ou limpar uma identidade, impedindo que conteúdo de uma trilha anterior reapareça na nova escolha.
- Erros de respostas obsoletas deixam de aparecer após troca de trilha.
- Botões de aula com alvo mínimo de 44 px; resumos clicáveis das oficinas com a mesma medida.
- Em telas até 380 px, cards de trilhas passam a uma coluna para melhorar a leitura.
- Nenhuma alteração no currículo de 15 aulas, nas dez oficinas, nas 56 referências, na assinatura, no backend, no Social ou no núcleo de trading.

## Evidências automatizadas previstas
1. API offline: disponibilidade de 15 aulas sem nível obrigatório, persistência, legados preservados, revisão opcional, controle concorrente 409, autorização negativa 401/402 e isolamento entre usuários sintéticos.
2. Chromium localhost: interação em todas as cinco trilhas e respectivas duas oficinas; abertura da trilha avançada como primeira escolha; registro de leitura e recarga, troca de conta, convidado e acesso não contratado.
3. Corrida de navegação: a resposta de uma aula é atrasada artificialmente; o aluno muda para outra trilha antes da resposta; nenhuma tela antiga pode reaparecer.
4. Responsividade em 1440, 1024, 768, 390, 360, 320 e 844 px, sem overflow e com alvos mínimos de toque.
5. Regressões originais B276, Universidade B147, Gênios Pro B145, Social B148, conexões e `npm run build` completos.

**Limites:** testes com sessão, histórico e resposta de API simulados não demonstram funcionamento comercial Supabase ponta-a-ponta. Nenhuma cobrança real, ordem Paper, operação real, mudança de preço ou conexão com corretora. Os 36 vídeos novos continuam pendentes de análise documental. Evidência de CI não autoriza deploy por si só.

**Critério:** homologar o B276-R2 somente após verificar o commit e a CI verde no GitHub. Em caso de falha, preservar B276 e corrigir em homologação.

## Complemento visual aprovado para desenvolvimento B276-R2
Cada uma das **15 aulas** possui uma cena SVG didática original com descrição acessível, título, legenda textual e ressalva de dados fictícios. As **10 oficinas opcionais** apresentam, dentro da própria atividade, um diagrama correspondente ao conceito, sem alterar notas, avaliação, progressão ou permissões. São oito tipos de desenho reutilizáveis: fluxo, linha temporal, candle, risco/gap, tendência e rompimento, custos, indicadores e expectativa em R. Os desenhos são vetoriais e responsivos, sem download de imagens externas ou uso de preços reais. O teste de navegador deverá verificar a presença do SVG e ausência de rolagem horizontal em desktop e mobile.
