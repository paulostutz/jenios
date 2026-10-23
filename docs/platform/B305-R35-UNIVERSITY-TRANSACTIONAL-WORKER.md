# B305-R35 — Marcos da Universidade no worker transacional

Base: R34 `199567bf636f4851aed763213a1bab2be8340d8c`.

O worker transacional agora reconhece `university_milestone` e:
- carrega `jenios_learning_state`;
- chama o adaptador puro `buildUniversityMilestoneMessage`;
- revalida currículo, IDs oficiais, marco 5/10/15 e snapshot;
- usa o mesmo protocolo de claim/lease/idempotência/complete/release já existente;
- não cria qualquer novo caminho paralelo.

Certificação usa transporte fake.
`JENIOS_TRANSACTIONAL_EMAILS_ENABLED=false` permanece no Preview.
Nenhum e-mail real é enviado por este bloco.

`JENIOS_UNIVERSITY_MILESTONE_DELIVERY_CERTIFIED` só deve virar true após CI e Preview deste commit ficarem verdes.
