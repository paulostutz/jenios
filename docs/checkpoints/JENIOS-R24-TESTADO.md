# JENIOS R24 — favicon, grade do perfil e Stories

## Escopo e pontos de restauração
- Projeto exclusivo: JENIOS, repositório paulostutz/jenios.
- Produção antes desta alteração: f5101669c93a239662d3c9a0d7c05ffb26c3a7c7.
- Backup anterior: checkpoints/jenios-r24-00-antes-favicon-grade-stories.
- Implementação: dfc1c06c24f7657e918b6ff009835ac0f9d83906.
- Código e teste de navegador: 8bcdef507ee2774bc24f832e1d04608fde16aea9.
- Branch de trabalho: fix/jenios-r24-favicon-grade-stories.
- Checkpoint testado: checkpoints/jenios-r24-02-testado.

## Diagnóstico
Consulta somente leitura ao projeto Supabase identificado no repositório confirmou uma publicação visível, vinculada ao perfil paulostutz e gravada em 2026-10-15T20:47:08.762193Z. Não havia publicação sem perfil nem caminho de mídia temporária blob:/data: na verificação. Uma Story estava ativa. Nenhum registro foi criado ou alterado nesta verificação.
O código existente já grava os posts no servidor e consulta a galeria por author_id, independentemente da página carregada no feed. A falha visual encontrada foi a regra global de CSS que força todas as grades com estilo inline a uma coluna em telas de até 768px. Corrigida apenas a galeria do perfil com seletor específico, sem modificar a regra global dos demais módulos.
Os Stories não possuíam tempo de exibição para imagens nem avanço no fim de vídeos. A navegação anterior terminava ao chegar ao último Story de cada autor.

## Alterações
- Favicon vetorial: J branco, degradê #8b5cf6/#6d28d9 e cantos arredondados reconstruídos a partir do código da página inicial, sem utilizar pixels do print. app/icon.png de teste removido; app/icon.svg e Apple PNG gerado em app/apple-icon.js adicionados.
- Grade do perfil: três colunas quadradas no celular e desktop; fotos e vídeos em miniaturas, abrindo a publicação existente. Texto, abas, paginação e arquivamento preservados.
- Stories: imagens avançam em cinco segundos após carregar; vídeos avançam ao terminar; toques à direita/esquerda, pausa ao segurar, pausa/continuação, som opcional, progresso, teclado, foco do modal e sequência entre autores. A expiração de 24 horas foi preservada.
- Nenhuma alteração em APIs de consulta, cálculos, fontes, geradores de laudos/PDF, pagamento Inter, tabelas, credenciais, regra de gratuidade ou código principal app/social/page.js.

## Validação
- npm test: 298 testes aprovados, zero falhas ou ignorados (inclui sete novos testes R24).
- Build Next.js aprovado. Build local usa configuração fictícia de QA, sem segredos de produção; nenhuma variável remota foi alterada.
- Navegador Chromium: criação de post com API simulada, consulta do perfil independente do feed, recarga com permanência dos sete posts sintéticos, grade de três colunas e miniaturas quadradas em 390 e 1440 pixels.
- Navegador: autoavanço de imagens, pausa/continuação, toque anterior/próximo, segurar por 5,5 segundos sem avançar, teclado, sequência entre autores, reprodução e término de vídeo WebM real gerado em canvas, fechamento do último Story.
- Favicon SVG e Apple PNG retornaram HTTP 200 no servidor local; tipo PNG e assinatura do arquivo verificados; sem erros JavaScript no navegador.
- Script reproduzível: scripts/test-social-r24-ui.cjs. Playwright usado apenas no ambiente isolado, sem alteração de package.json/package-lock.json.

## Limites e pendências
As operações positivas no navegador usaram contas e respostas sintéticas, não a conta real do proprietário. A verificação do banco real foi somente leitura. Não se afirma recuperação de posts que não tenham sido gravados anteriormente. Recomenda-se teste final no iPhone do proprietário para condições específicas de Safari e rede. A versão já existente do Next.js apresentou alerta de pacote antigo durante a instalação; atualização de dependência não foi incluída nesta revisão pontual e permanece para revisão separada.

## Publicação
Este checkpoint registra a versão testada, antes de confirmar o deploy em produção. O registro seguinte deve identificar o deploy efetivamente publicado e os testes HTTP no domínio.
