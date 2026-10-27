# JENIOS R90 — gate de liberação do Paper externo

Checklist de homologação sem ordens: CI do SHA final, Preview principal READY, RLS e RPC service_role, vínculo real de titular e corretora, credenciais em cofre privado, consentimento específico, limites USD, worker isolado com journal B152 persistente, kill switch com verificação pré-POST, recuperação UNKNOWN sem reenvio, reconciliação de fills/cancelamentos, auditoria independente e rollback.

Estado na abertura: R89 corrigida em `617167602931568e74d833bf7e080bd1b40c15ba`; Vercel JENIOS principal `dpl_Epi5sQwJT7EL7dhRF16nYS2P5Fpj` READY. Outras verificações Vercel ainda não inteiramente verdes. Nenhuma conta Paper/Live conectada, nenhum recibo externo, nenhum executor Paper implantado. Portanto **Paper externo NÃO HOMOLOGADO**.

Regras de aceite: jamais inferir homologação a partir de fixtures ou build; nenhuma chave/token no chat; autenticação e consentimento pelo fluxo seguro do cliente; não habilitar Live nem cobranças. Manter PR #22 DRAFT e produção R79 até aprovação integral. A futura operação Live requer revisão separada.
