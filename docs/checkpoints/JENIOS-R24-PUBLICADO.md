# JENIOS R24 — publicação confirmada

## Produção
- Data da verificação: 2026-10-16.
- Commit publicado: 8bcdef507ee2774bc24f832e1d04608fde16aea9.
- Branch: main; atualização fast-forward com conferência do SHA anterior, sem force push.
- Projeto: jenios-ecossistem / prj_44ipBY3R9sHlQDAXY7NUn1zDguw4.
- Deployment: dpl_G3pE6zHHVRRCnxT8i9yTVdDW6MjP.
- Estado confirmado pela consulta do domínio na Vercel: READY, target production, aliasError null.
- Domínios vinculados: jenios.com.br e www.jenios.com.br.
- Versão anterior preservada: f5101669c93a239662d3c9a0d7c05ffb26c3a7c7 em checkpoints/jenios-r24-00-antes-favicon-grade-stories.

## Verificação HTTP no domínio real
- GET /: 200; HTML aponta para /icon.svg?c68d8475f5173b2a e /apple-icon?1caa565b7da2bdeb.
- GET /social: 200.
- GET /icon.svg: 200, image/svg+xml, contém o degradê JENIOS.
- GET /apple-icon: 200, image/png, resposta de 15995 bytes.

## Resultado entregue
Favicon de teste substituído pelo J branco com degradê roxo da página inicial, sem recortar o print. Inclui PNG para ícone Apple.
Grade do perfil corrigida para três colunas e miniaturas quadradas também no celular. A persistência já existente foi preservada: o banco real confirmou a publicação da conta do proprietário. No teste de navegador, a publicação sintética permaneceu após recarga e foi encontrada na consulta independente do perfil, mesmo ausente da página atual do feed.
Stories com temporizador de imagens, avanço no fim dos vídeos, toque anterior/próximo, pausa ao segurar, progresso e sequência entre autores. Mantida a validade de 24 horas.

## Testes e limites
- 298 testes unitários/integração controlada aprovados; zero falhas/ignorados.
- Build da aplicação aprovado.
- Testes Chromium em 390 e 1440 pixels aprovados para galeria; navegação de Stories, pausa, toque e fim de vídeo real em fixture aprovados; nenhum erro JavaScript observado.
- Fluxos autenticados do navegador usaram contas/API simuladas. Não houve publicação, exclusão ou alteração de dados reais durante os testes.
- A inspeção de logs internos do deployment pelo conector Vercel retornou falta de autorização; não se tentou obter credenciais. A publicação foi confirmada pelo estado READY do domínio e pelas respostas HTTP públicas acima.
- A tentativa adicional de testar os endpoints detalhados em produção não foi executada por bloqueio da ferramenta; não é registrada como teste aprovado. Esses endpoints não foram modificados e permanecem cobertos pela suíte existente.
- Teste final de toque e reprodução no iPhone/Safari real do proprietário continua recomendado; não foi feito nesta sessão.

## Preservação e continuidade
Comparação completa contra a versão anterior não inclui alterações em app/social/page.js, APIs, banco, autenticação, cálculos, fontes, geradores de PDFs, integração Inter ou gratuidade de pré-lançamento dos laudos. O arquivo global de layout recebeu apenas importação da correção de galeria; as regras dos demais módulos não foram substituídas.
Histórico da implementação: dfc1c06c24f7657e918b6ff009835ac0f9d83906 e 8bcdef507ee2774bc24f832e1d04608fde16aea9. Diagnóstico e provas anteriores: JENIOS-R24-TESTADO.md nesta branch de checkpoints.
Antes de restaurar qualquer versão anterior, comparar eventuais commits e publicações posteriores. Revisão de segurança da dependência Next.js antiga permanece separada desta correção funcional.
