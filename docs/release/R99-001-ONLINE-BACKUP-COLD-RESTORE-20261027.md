# JENIOS R99 — backup online verificado e restauração a frio do ledger B152

**Data:** 27/10/2026. **Projeto:** JENIOS. **Branch de desenvolvimento:** `fix/jenios-r80-private-paper-safety-20261027`. **PR:** #22 DRAFT; não fazer merge nesta etapa.

## Recuperação prévia e base

- Base R98 `a1349ea13386e3c4dd87445007b19fa61e4d8481`, CI GitHub Actions `40564441253` aprovada (122/122 privados, 1786/1786 gerais, 94/94 Social), Vercel Preview `dpl_BikEGU7jgK36ZtcJgdwgmKAfyZg5` READY.
- Produção R79 `a24922cc829dd1b45b87a719e9fd57ab45e6d79b` preservada.
- Reutilizados o ledger B152 (SQLite WAL), o vínculo B175, o controle privado de volume R94, os ensaios R95–R98 e os backups antigos B152, B165–B169, B171–B173 e R74.
- Supabase Platform no início do bloco: 0 contas de corretora conectadas, 0 autorizações Paper, 0 safety R80, 0 contas Live.

## Entrega R99

- `lib/platform/connections/private-journal-hot-backup-r99.mjs`: gera snapshot SQLite pelo método nativo `node:sqlite.backup()`, com acesso de leitura ao banco original, nome aleatório, arquivo temporário protegido por modo 0600 e promoção somente após validação `PRAGMA integrity_check` e presença das cinco tabelas B152.
- Identifica snapshot por nome sem caminho externo e digest SHA-256. Rejeita origem insegura, destino de backup no mesmo diretório, arquivo corrompido, prova inválida, diretório permissivo, travessia de caminho e backup maior que o limite offline.
- Restauração exclusivamente a frio em destino vazio, com `COPYFILE_EXCL` e conferência de integridade e digest; não modifica nem substitui um banco em operação.
- Testes de integração offline com o B152 e B175 preservam estado UNKNOWN e reserva de risco, rejeitam reenvio automático, comprovam isolamento de titular, bloqueiam restauração sobre journal existente e detectam corrupção, além de negar flags de operação financeira.
- Nenhum listener HTTP, cron, serviço pago, acesso a corretora, credencial, pagamento, saque ou ordem Paper/Live.

## Limitações obrigatórias

Este bloco certifica somente a consistência do **snapshot SQLite local** e a restauração a frio da fixture. Não certifica armazenamento físico independente, criptografia do backup em repouso no provedor, upload externo, retenção automática, recuperação entre deployments, RPO/RTO real, restauração de dados de clientes ou concordância de ordens/posições com uma corretora.

Antes de permitir contas reais continuam obrigatórios: infraestrutura Node privada e disco persistente com custo aprovado, backup criptografado fora do host e restauração verificada, credenciais do cliente inseridas exclusivamente no cofre autorizado, teste externo Demo/Testnet com recibos oficiais, conciliação, kill switch independente, avaliação comercial/regulatória e autorização Live por titular/mercado/limites.

## Estado do lançamento

A R99 é desenvolvida somente na branch da PR #22. Não mesclar ou publicar no domínio antes de todas as verificações. Os projetos CHEFE e LETTER, a produção R79, o núcleo R74 e os apps nativos permanecem inalterados.

**CI/Preview do commit R99:** preencher com evidência do SHA exato depois da execução.