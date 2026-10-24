# B305-R32 — Preflight técnico do módulo de e-mails

Base: R31 `17547733a2118aac3cfecfe76bb53c0606713c4c`.

Foi criada e aplicada na Social QA a RPC somente leitura `jenios_email_preflight_b305()`.

Ela verifica a presença das filas, ledgers, funções, índice financeiro e triggers obrigatórios do B305. No ensaio e após a aplicação, a infraestrutura retornou `allRequired=true`.

Segurança:
- SECURITY INVOKER;
- EXECUTE apenas para service_role;
- retorna somente booleanos;
- sem mutação;
- sem leitura de destinatários, conteúdo ou secrets.

A integração desse preflight ao painel Master será feita separadamente para manter o checkpoint pequeno e auditável.
