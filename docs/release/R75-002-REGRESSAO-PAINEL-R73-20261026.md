# JENIOS R75.002 — O painel R73 está no backup, mas falta na release G49

Data de inspeção: 26/10/2026 (UTC-3). Continuidade de `R75-001-BACKUPS-E-ESTADO-REAL-20261026.md`.

## Resultado comprovado

No histórico, R73 **já foi implementado e publicado**:
- Branch imutável: `backup/jenios-robot-r73-definitive-app-published-20261024`.
- Fonte original: `docs/platform/ROBOT_R73_DEFINITIVE_APPLICATION.md`, no mesmo backup.
- Commit publicado da aplicação: `ed8b783b6fcb5419afbfb09b274c78fbed05010b`.
- Deployment histórico: `dpl_HWFRPaUD3G5JwgxEDpvPBs6zKRa5`, com testes autenticados de contrato e acesso anônimo, mas sem login humano real certificado.
- O modelo era seguro: painel de leitura com Auth dedicado da Platform, permissão `platform.admin`, leitura HEAD das 16 tabelas e limites de execução inativos. Nenhum endpoint de trade.

**Regressão/ausência atual, diretamente observada:** versão `release/jenios-genios-g44-20261024`, commit `2ee913339d01c7c20e4d837867f10d3258bc8dcc`, deployment `dpl_2XrnctiXtkSfXwWDxekfme95JMK2`.
- `GET https://www.jenios.com.br/platform/admin/robos` -> **HTTP 404**.
- `GET https://www.jenios.com.br/api/platform/admin/robots/status` -> **HTTP 404**, não 401/403.
- Os caminhos exatos correspondentes retornam 404 na API de arquivos da branch atual, **mas existem no backup R73**.
- `app/platform/admin/page.js` atual não oferece link para `/platform/admin/robos`, enquanto a versão R73 tinha esse link.
- `lib/platform/research` como diretório não existe na release G49; no backup R73 contém os módulos privados-administrativos de contratos R61–R73 que não devem ser copiados indiscriminadamente.
- Os arquivos de infraestrutura `lib/platform/admin-db.mjs` e `lib/platform/admin-permissions.mjs` continuam idênticos (mesmos Git blob SHA), assim como `lib/platform/supabase-client.js`. Não reconstruir essas bibliotecas.

## Inventário mínimo a recuperar sob revisão

| Componente R73 | Arquivo no backup (blob Git) | Estado G49 |
| --- | --- | --- |
| Página de administrador | `app/platform/admin/robos/page.js` — `8dbd56c9c7b7134ef2106d230066705a8815846d` | Ausente |
| UI cliente autenticada | `app/components/platform/PlatformRobotDefinitiveAdmin.js` — `9a786f7f1344e5491be806d3d3e55a1f5e7d7474` | Ausente |
| Status REST somente GET | `app/api/platform/admin/robots/status/route.js` — `04f1063b1a313e5e825c83a2e9c3819a7c3d8f51` | Ausente |
| Sonda privada de implantação | `app/api/platform/internal/robots/deployment-status/route.js` — `0262d3f7259cce32859895263178c79ef85e5fbc` | Ausente |
| Contrato de API, autenticação e estado | `lib/platform/research/robot-r73-definitive-status.mjs` — `5e11b6aeb8fb7ce002794101f79d7101f18f4ef0` | Ausente |
| Leitura de configuração de origem R67 | `lib/platform/research/robot-r67-access.mjs` — `c6ceae6ad21f8b318093dab7dd134a7a845419ef` | Ausente; depende de protocolos R61/R67 |
| Suíte de status e negações | `tests/platformRobotR73DefinitiveStatus.test.mjs` — `1f38d6e9fcc0de3efd2c09b4605739a9ccf8b9fb` | Ausente |
| Suíte de escopo de release | `tests/platformRobotR73ReleaseScope.test.mjs` — `1ade116f459a45edf26660e5e96908efc172eb97` | Ausente |
| Link no painel já existente | `app/platform/admin/page.js` — R73 `75e4780ad6ab2d90f883bafc8c2fc69a11d33952`, G49 `c9361121f41a16a9dccb2fcaf2a8a8f61ac99aaa` | Revisar alteração cirúrgica, sem substituir arquivo atual |
| Scope do guard S05 | `lib/release/environment-scope.mjs` — R73 `416a50c0063ebce643d905b90dd9403a2177abb5`, G49 `ece02cff582a132de0e9bda384e860a1ebe5278c` | Revisar/conciliar guard sem enfraquecer as regras atuais |

## Impedimento para cherry-pick cego

1. O módulo R73 original exige `VERCEL_GIT_COMMIT_REF='release/jenios-robot-r73-definitive-app-20261024'`, enquanto produção está em `release/jenios-genios-g44-20261024`. Copiar o código sem adaptar este gate deixaria o endpoint invisível mesmo se os arquivos existissem.
2. O mesmo módulo exige `JENIOS_ROBOT_R73_ADMIN_ENABLED='true'`, projeto Vercel correto, URLs dedicadas exatas e quatro flags operacionais igual a `false`. Conferir presença/configuração dessas flags sem exibir segredos; não ligar execução ou compras.
3. `robot-r73-definitive-status.mjs` depende de `robot-r67-access.mjs`, que por sua vez importa contratos R61/R67 e R64/B297. Restaurar **fechamento de dependências testado**, não apenas as duas rotas, nem todo diretório de pesquisa de outra branch.
4. O layout de login `app/platform/entrar/page.js` mudou entre os blobs R73 `e5ff8970e6f2d4f5d554ed94efd3320f511e709f` e G49 `07fecc325fe16722edfecfb54c13d7ed6d10f2e9`: reconciliar apenas `dedicated=1`/retorno seguro, preservar novos refinamentos.
5. `lib/platform/admin-db.mjs` `a76f901054d5c2745768ded70d808047703c9022` e `lib/platform/admin-permissions.mjs` `e786804a52697d2622f64ebdd1b00ef216b778d0` são idênticos nos dois ramos; **reutilizar**, não modificar.
6. Mesmo após restaurar UI/status, o estado do robô no host R74 pode ser `READY` para ciclos sintéticos: a versão R73 original mostra `WAITING_FOR_SOURCE` pois era anterior ao host instalado. Adaptar exibição somente com evidência autenticada; não inferir Live.

## Sequência de implementação segura — próximo bloco

1. Montar inventário fechado dos imports do módulo R73 e hashes da árvore R73, guardar relatório de comparação com G49.
2. Cherry-pick **por arquivo** e com hashes de origem, apenas após verificar imports; resolver um arquivo alterado por vez, de preferência pelo mínimo diff.
3. Adicionar testes de regressão R75 para branch G49, sessão Platform, permissão admin, anon/403, isolamento Social, estados `READY`/incompleto, proibição de ordens reais e ausência de segredo na resposta.
4. Executar `npm test`, suíte Social 94, `npm run build`, guard de publicação, smoke em Preview autenticado. Não criar feeds artificiais nem usar credenciais do cliente.
5. Merge somente após CI e revisão. Publicar deployment exato, verificar HTTP do painel e autenticação 401/403/200 com contas autorizadas. Não alterar flags de trading.
6. A evolução de `SYNTHETIC_CYCLE` para operações via API da conta **do próprio usuário** é outra etapa, separada da restauração do painel.

## Preservação

Este checkpoint é documental, sem operação de mercado, cobrança, migração, alteração RLS, segredo ou deployment. Base SHA `2ee9133`; o backup R73 e o runtime R74 não foram modificados. A entrega será anexada em PR Draft contra a release correta — nunca merge direto em `main`.
