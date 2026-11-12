# JENIOS R95.001 — canário offline de persistência, sem ativação
Data: 27/10/2026. Branch fix/jenios-r80-private-paper-safety-20261027, PR #22 DRAFT.

## Base auditada
- Backups privados B152, B165–B169, B171–B173, R74 e checkpoint R93 preservados.
- Base R94 corrigida 8092df718c485dbe7b754da2f63245fc7fca0f20. CI #40559581025 SUCCESS; 109/109 privados, 1771/1771 gerais, 94/94 Social; deployment Preview dpl_7rHcX59XmfYLFs4yB7oScMTw331N READY.
- Produção R79 a24922cc829dd1b45b87a719e9fd57ab45e6d79b preservada; nenhum merge.
## Entrega
- private-host-continuity-r95.mjs: canário OFFLINE que reutiliza R94/B152; abre e reabre SQLite de UUID de teste num volume com 0700 e autorização local, verifica arquivo com 0600 e devolve evidência estritamente não secreta.
- CLI r95-private-host-check.mjs exige --offline-preflight e variáveis do host privado. Nenhum HTTP listener, tarefa agendada, acesso ao cofre ou chamada de corretora. Executa sob Node isolado, não Vercel.
- Testes CI cobrem SQLite real, dois ciclos de abertura, flags bloqueadas, volume inseguro e CLI. Não toca no motor R74, site, iOS/Android ou migrações.
## Limites importantes
R95 NÃO certifica disco persistente entre deploys, backup/restauração, continuidade no reinício do host ou transações externas. Tudo isso exige infraestrutura real e revisão independente. Não provisionar worker pago sem escolha de plano/limites de custo. Render background worker com disco persistente é uma opção futura, mas custos e parâmetros precisam de aprovação. Não habilitar Paper externo, Live, saques, Pix ou cobrança.
## Rollback
Código só na PR Draft; manter R79 em produção. Flags de execução continuam false. CI e deployment do SHA exato devem ser verificados antes de chamar a R95 de certificada.