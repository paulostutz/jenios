# JENIOS Platform — R45-B72 | Publicação controlada (19/10/2026)

**Escopo:** exclusivamente JENIOS Platform integrada ao S05. Proibidas alterações à Social, BankScore, Validador, JENIOS PAY, APIs financeiras, Letter, Chefe e núcleo dos robôs.

## Pontos de recuperação
- Projeto único: `jenios-ecossistem`, ID `prj_44ipBY3R9sHlQDAXY7NUn1zDguw4`, domínios `jenios.com.br` e `www.jenios.com.br`.
- Produção S05 intacta: commit `f4232312a6704aa27ba4d2fc0d0e6181bba0a426`, deploy `dpl_B4EuNDkZ8d3WLBvrnfpcFUz9ktuK` e backup `backup/jenios-original-producao-pre-platform-20261019`.
- B71 aprovado: `7710ab233765eb3568a1af7dfa8125f2a94799dc`, CI `39275534863` e backup `backup/jenios-platform-b71-pre-deploy-20261019`.
- Supabase exclusivo Platform: `jenios-platform-homologacao`, ID `xaicvhagftzjkqphnbgx`; Social produção permanece ID `igayfjorjmucthlfoasf`.
- Branch autorizada na regra de CI: `release/jenios-s05-platform-cp70-integracao-20261019`.

## Travas antes da publicação
1. Verificar via painel da Vercel a presença de `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` no projeto original e no target Production. A listagem disponível está truncada: ausência ainda não é definitivamente comprovada. Nunca ler, copiar, imprimir, enviar por mensagem ou substituir pela chave da Social.
2. Se não estiver configurada, o usuário deverá inserir diretamente no painel protegido da Vercel a chave do Supabase exclusivo da Platform, apenas como variável de servidor. Jamais no prefixo `NEXT_PUBLIC_`.
3. Para testes autenticados na Preview, conferir o mesmo segredo exclusivamente no escopo da branch integrada, sem vazar informações.
4. Preservar o Supabase da Social produção, as APIs e as configurações financeiras existentes. Manter cadastros públicos, trading real, trial e recursos sem certificação desativados.
5. Validar login real, recuperação, diagnóstico por usuário, perfil de permissões, dashboard-logado, Dashboard, Mesa, diário, saldo virtual, pausa/retomada.
6. Executar a regressão de Social, BankScore, Validador de Tokens e PAY antes da troca de qualquer alias.
7. Construir um deployment com ambiente Production **sem associar o domínio antes da validação**. Não promover a Preview diretamente: ambiente e credenciais são diferentes.
8. Promover somente o deployment testado e confirmar HTTPS, rotas, APIs, usuários e logs nos dois domínios.

## NO-GO e rollback
- Falha de CI, credencial, DNS, login, permissão ou APIs: não alterar alias nem a versão S05 publicada.
- Retorno, se necessário: restaurar a implantação original S05 `dpl_B4EuNDkZ8d3WLBvrnfpcFUz9ktuK` no projeto original, após conferir os aliases.
- Sem operações reais e sem alteração do motor protegido dos robôs. O percentual de desenvolvimento só avança com CI e evidências.

Este documento contém somente nomes de configuração, identificadores técnicos públicos e referências de backup; nenhuma credencial privada.