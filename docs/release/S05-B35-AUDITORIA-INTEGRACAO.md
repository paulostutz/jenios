# JENIOS S05 — Certificação parcial B35 (18/10/2026)

**Estado:** homologação avançada. NÃO AUTORIZAR promoção da prévia para produção enquanto os bloqueadores finais estiverem pendentes.

## Produção congelada
- Domínio: jenios.com.br; código-base `af86e69e5a0d5f344e89e2403210ff9fb5062315`; deployment S02 `dpl_7vDVvGwfT6HKYf8n37EoBk9ccf24`.
- Nenhuma migração, deploy, merge, cobrança real ou mudança de API crítica em produção nesta etapa.
- B52 privado e JENIOS PAY intactos.

## B32 — Armazenamento isolado
- Supabase de homologação `rebzztxlzofxpfwjvbee`: bucket `social-media` público, 50 MB, seis MIME types idênticos aos definidos em produção.
- A migração `20261018115144 s05_b32_social_media_bucket_isolated_20261018` exige a marca exclusiva de homologação e se recusa a sobrescrever bucket existente.
- O envio é pelo endpoint existente `/api/social/media` com usuário validado e URL assinada vinculada ao identificador do usuário. Nenhuma permissão de INSERT anônimo foi criada.

## B34 — Política RLS dos comentários
- Um teste transacional expôs recursão infinita no INSERT de comentários por conta do EXISTS sobre a mesma tabela.
- Corrigido via `20261018120610 s05_b34_comments_rls_recursion_fix_20261018`: função booleana restrita ao schema privado, mantendo autenticação, associação da resposta ao post e proibição de níveis aninhados.
- Ensaio isolado pós-correção cobriu post com mídia, duas identidades fictícias, comentários, resposta, rejeição de resposta aninhada/cruzada, like, salvar, seguir, story, exclusão proibida e arquivamento.
- A transação de ensaio foi **ROLLBACK**; zero usuários, posts, comentários ou stories fictícios persistidos.

## B33 — SQL de migração de produção em PostgreSQL descartável
- Proposta sob `supabase/release-review/20261018_s05_social_identity_deletion_PRODUCTION_REVIEW_ONLY.sql`; não aplicada ao banco ativo.
- `scripts/test-s05-release-migration-pglite.mjs` executou **17/17** verificações PGlite: DDL, reaplicação, preservação de perfil preexistente, cadastro com trigger, @ exclusivo e sugestões, função de reautenticação, cancelamento/reabertura, RLS cross-account, negação para anônimo e bloqueio de execução no marcador de staging.
- Execute apenas com PGlite instalado em diretório descartável, sem conectar a um banco remoto.

## Regressão certificada
- Staging S03: 154/154.
- Staging S04: 95/95.
- Staging S05: 97/97.
- Total staging: **346/346**, nenhuma falha. Commit `363a2ad4a9464fe198eac74117b8dec204079789`.
- Release candidata B31: 322 testes de base + 20 adicionais (342/342), build Next 15.5.28 e prévia READY; novo ensaio SQL opcional 17/17. Candidata permanece prévia, não produção.

## Bloqueadores para 75% e deploy
1. Duas sessões reais independentes de Supabase Auth no projeto de homologação para inserir post por HTTP, fazer logout/login, ler feed e perfil, testar upload assinado, autorização, comentários, stories, PDFs.
2. Migração de produção revisada com aprovação específica, backup e pós-verificação de RLS/índices/triggers. Funções de handle, perfil automático e fila de exclusão não estão ativas na produção S02.
3. Integrar e provar todos os módulos S03–S05 aprovados; não promover diretamente deployment Preview, cujas variáveis de ambiente são vinculadas ao Supabase de homologação.
4. Validar fluxos de BankScore/Validador gratuitos com conta real, sem ativar cobrança; testar dispositivos móveis e recuperação.
5. Certificar os critérios de 75% antes do deployment integral. Se qualquer falha, manter S02 e rollback.

### Fontes imutáveis
- Branch S05 `jenios-s05-homologacao-20261018`, commits B32 `17c3748bd3566add58ef923e18d96e0d0a8fe48c` e B34 `363a2ad4a9464fe198eac74117b8dec204079789`.
- Branch release isolada `release/jenios-s05-integrada-homologacao-20261018`; B33 `1e5b2bc46635b84f0cb11460c8f7a553c5882970` (script de ensaio revisado).
