# R45-B77 — identidade e fronteira de autorização

Escopo aprovado: acesso unificado à simulação e preservação de identidade privada da Platform.
Estado de partida: a Social autenticada abre a simulação, sem criar autorização administrativa, assinatura ou diagnóstico no Supabase dedicado.
Critérios para vínculo definitivo (ainda não homologados): prova das duas sessões por servidores independentes, associação consentida, política de revogação, monitoramento de replay, trilha de auditoria, isolamento RLS por titular, renovação e recuperação de acesso.
Mesmo e-mail entre Social e Platform não prova que se trata do mesmo titular.
Não criar nem copiar usuários, senhas, tokens, relações, planos ou privilégios entre projetos sem o protocolo de vinculação certificado.
Sem alteração ao banco de produção nem aos controles originais de autenticação. O suporte para o acesso social à simulação B74 é preservado.
Etapa concluída aqui: especificação testável de fronteira de segurança. Implementação do vínculo definitivo depende de revisão posterior; não creditar 1% pleno.