# JENIOS B288-R2 — Preview isolado e restrito

Base certificada B288 `fcfca426acc76122fb94a1c0348420d30f8a76e1`, CI 39650796435 SUCCESS.

A causa dos previews anteriores ERROR foi `S05_UNVERIFIED_PREVIEW_BRANCH`. A branch de QA `fix/jenios-b288-r2-preview-isolation-20261021` é permitida exclusivamente em `VERCEL_ENV=preview`, exigindo o Supabase Social de homologação `rebzztxlzofxpfwjvbee` e o Supabase Platform QA `xaicvhagftzjkqphnbgx`. São proibidos IA paga, cobrança, execução real e Paper externo. Branches desconhecidas e qualquer promoção dessa branch à produção continuam bloqueadas.

**Dependência de configuração:** as variáveis de Preview do projeto Vercel precisam corresponder às URLs QA e chaves públicas de QA. Não inserir segredos no GitHub. Se a Vercel não tiver a configuração correta, o build deve falhar de forma segura. Não desabilitar os gates. O usuário ainda não autorizou cobranças nem deploy de produção.

**Limites:** build de Preview não certifica login real, sessões, pagamentos nem IA externa. Testes autenticados exigem contas de QA. Salvar evidências e rollback B177-R3.
