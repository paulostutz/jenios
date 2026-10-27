# JENIOS R100 — pacote de worker privado inerte, ainda NÃO implantado
Data: 27/10/2026. PR #22 DRAFT. Escopo somente JENIOS.

## Base efetivamente verificada
- R99 \`9cf3e82f65f8ad257eeac3d29803447bf572df38\` GitHub Actions 40566700480 SUCCESS e Vercel Preview dpl_5t1GnoXPfAyaMH1zSXniKrBg4k1E READY.
- Biblioteca/commit B152, B165–B169, B171–B173, R74 e R94–R99 reutilizados.
- Produção R79 \`a24922cc829dd1b45b87a719e9fd57ab45e6d79b\` permanece intocada.
- Render workspace autenticado hoje contém serviço LETTER; nenhum worker JENIOS existente foi encontrado.

## Código deste bloco
- \`lib/platform/connections/inert-private-host-r100.mjs\`: recusa qualquer execução fora de um Node isolado, sinais de Vercel, diretórios sem proteção e flags de rede, corretora, ordens ou cobranças ativas. Chama o gate R97 e nunca promove evidencia autodeclarada em certificação independente.
- \`scripts/platform/connections/r100-inert-worker.mjs\`: processo Node que emite somente eventos de inicialização/parada sem segredos; permanece inerte, não faz polling, HTTP, ordens ou consulta de corretora; encerra graciosamente no SIGTERM.
- \`infra/render/r100-inert-worker.blueprint.yaml\`: MANIFESTO EXEMPLO, fora do \`render.yaml\` raiz. \`type: worker\`, \`autoDeployTrigger: off\`, 1 instância, plano pago sugerido, disco 1 GB. Aplicar Blueprint gera custo **mesmo sem auto-deploy**. Não foi sincronizado nem aplicado.
- Testes sintéticos de flags, mount protegido, ausência de publicação HTTP, manifesto e inicialização/encerramento real em subprocesso.

## Limitações
O Render permite disco persistente apenas em worker/serviço pago, acessível apenas à instância durante a execução; deploy pode ter indisponibilidade e snapshots do próprio provedor não dispensam prova de backup fora de domínio de falhas. Até o host ser provisionado, nem persistência entre deploys, nem restauração offsite, nem autenticação de corretora foram certificadas. A R100 é somente uma etapa de implantação INERTE, sem trabalho financeiro.
O mount deve existir, pertencer ao usuário do processo e ter modo 0700 antes do start; se faltar, o programa **falha fechado**. Jamais configurar \`JENIOS_R100_INERT_WORKER_ENABLED=false\` como via de execução. Não colocar segredos em Blueprint.
Os próximos gates exigem aprovação de custos/limite mensal, provisionamento do host e volume, backup offsite, teste de recuperação em infra real, conta Binance Testnet voluntária e E2E de risco/ordens Paper, revisão independente e aprovação Live por conta e mercado.
