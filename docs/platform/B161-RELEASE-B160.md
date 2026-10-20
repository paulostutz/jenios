# JENIOS B161 — preparação controlada da publicação do B160

Data: 20/10/2026. Escopo exclusivo JENIOS. Este checkpoint não altera produção.

## Estado conferido

- B160 aprovado: `dc320f8fcbec74d2ea1dcf923bed923bdf4377d9`.
- CI B160: `39465994857`, concluída com sucesso.
- Branch de origem: `fix/jenios-b155-b160-connection-guides-20261020`.
- Backup GitHub: `backup/jenios-b160-guides-ci-dc320f8-20261020`.
- Produção continua no B148: `4559d2ace3ac0cd4c95db55c67b7a7b671dece31`.
- Deployment atual: `dpl_5Cxywk9ZpVBFB8MxbB3qPFqeSQdC`, estado READY e candidato a rollback.
- Branch oficial: `release/jenios-s05-platform-cp70-integracao-20261019`.
- O deployment automático do SHA B160 na branch de desenvolvimento ficou em ERROR antes de ser uma versão publicável. A regra de escopo existente não será relaxada apenas para produzir uma Preview.

## Plano de publicação

A publicação só pode começar após autorização explícita do operador.

1. Revalidar que B160 e a branch oficial continuam nos SHAs esperados.
2. Verificar projeto, equipe e ambiente do destino.
3. Preferir uma construção de Production sem atribuir domínio, quando o fluxo disponível permitir, validar o mesmo build e somente então promovê-lo.
4. Não promover uma Preview como substituto de uma construção de Production.
5. Confirmar `/integracoes`, Sala de Controle, Mesa, Social, Direct, preferência Gênio/Gênia, Pro, Universidade, BankScore, Validador e JENIOS PAY.
6. Em falha material, restaurar o deployment B148 acima e revalidar os aliases.

## Limites

B161 não publica o B160, não cria conta externa, não recebe credenciais, não envia ordens e não ativa dinheiro real. O desenvolvimento B162+ permanece separado da aprovação de release do B160.
