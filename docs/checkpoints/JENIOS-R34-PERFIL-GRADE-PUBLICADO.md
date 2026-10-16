# JENIOS R34 — Correção da grade da Social publicada com segurança

Data: 16/10/2026. Escopo: apenas perfil independente da **JENIOS Social**.
Status: código mesclado em `main`; Vercel informou deployment concluído do projeto principal `jenios-ecossistem` por status do commit no GitHub. O acesso direto ao painel Vercel permaneceu negado (403). Navegador autenticado / iPhone não homologado nesta sessão.

## Proteção da produção
- Antes da alteração, `main`: `8bcdef507ee2774bc24f832e1d04608fde16aea9` (R24).
- Backup imutável do ponto anterior: `checkpoints/jenios-r34-before-profile-grid-publish`.
- Candidato testado isoladamente: `fix/jenios-r34-perfil-grade-homologacao`.
- Pull request: https://github.com/paulostutz/jenios/pull/2
- Merge squash confirmado: `e0c0b033b8c8f05bb1cdbb8aaea92900f64a2874`.
- Backup do estado após merge: `checkpoints/jenios-r34-social-grade-merge`, criado no mesmo commit antes deste documento.
- URL de status de deployment primário devolvida pelo GitHub: https://vercel.com/jenios/jenios-ecossistem/6VaGNpP7bb5FWAA2NWk3RtthDFKi (status success no commit `e0c0b033`).
- Outro projeto distinto `jenios-anxp` reportou falha; não confundir o status agregado com o projeto principal, que teve `success`.

## Alterações verificadas por comparação SHA/branches
Somente 5 caminhos diferem entre a R24 original e o commit de publicação R34:
1. `app/social/perfil/[id]/page.js`: grade de três miniaturas quadradas, modal de leitura, Escape, vídeos sem autoplay, carregamento de mais publicações e descarte de respostas antigas após troca de conta.
2. `app/social/profile-grid.css`: classes específicas para o perfil independente; preserva a regra da grade já existente dentro da Social.
3. `tests/socialR33StandaloneProfile.test.mjs`.
4. `tests/socialR33ProfilePersistence.test.mjs`.
5. `.github/workflows/r34-social-profile-staging.yml` (CI limitado à branch de homologação).

Nenhuma API, banco, login, BankScore, Validador, JENIOS PAY, Social Stories, feed da Social, LP, assinatura, módulo de ensino ou núcleo proprietário foi modificado por esse merge.

## Testes realizados
- R24 base + patch exato R33: **316 testes** aprovados, 0 falhas.
- Next.js 14.2.3 build otimizado com ambiente fictício de QA: compilado com sucesso e rota dinâmica `/social/perfil/[id]`.
- Servidor local compilado: `GET /social` 200; `GET /social/perfil/UUID` 200; `GET /api/social/profiles?id=UUID` sem token 401.
- CI GitHub Actions: https://github.com/paulostutz/jenios/actions/runs/38950817714 concluído **success**.
- Prévia Vercel do projeto principal na branch candidata e implantação do commit merge na main: status **success**, conforme GitHub.
- Supabase de produção auditado **somente leitura** anteriormente no bloco R33: quatro posts ligados a perfis, um em `@paulostutz`; objetos de mídia encontrados em Storage. Nenhum post foi alterado pela R34.
- E2E com login real, Safari/iPhone e checagem visual autenticada de domínio final: **pendentes**. URLs ao vivo não foram acessíveis pelo navegador/terminal desta sessão (restrição de ambiente). Não inventar confirmação visual.

## Rollback
Se houver regressão, reverter o commit `e0c0b033b8c8f05bb1cdbb8aaea92900f64a2874` ou repromover os fontes da branch `checkpoints/jenios-r34-before-profile-grid-publish`, com verificação posterior do deployment. Nenhum rollback foi executado.

## Relação com a Platform
O arquivo privado cumulativo R33 da Biblioteca continua separado e NÃO foi levado para produção por esse PR. R25–R33 da Platform, além de corretoras reais/IA/WhatsApp, permanecem em homologação futura.
