# B305-R20 — Preferências e planejamento de marketing

Base:
- R19 certificado: `d8d0e4562e66aee3d6759a2fda69aeb7753ee465`;
- CI R19: `39880562334` SUCCESS;
- artefato R19: `12470077434`;
- digest R19: `sha256:00d165aff9ade361008f4d3c8d3a8f50b2de366ce6c9342ede018307e1d0cac5`.

Entregas:
- página autenticada `/preferencias`;
- API autenticada para opt-in/opt-out;
- complaint/hard bounce não podem ser alterados pelo cliente;
- planner privado de recuperação de carrinho (+2h/+24h/+72h);
- nurture sem plano (D+3/D+10);
- tabela privada de edições do Radar de Mercado;
- newsletter só entra no ledger quando a edição está `approved`;
- todos os planners respeitam opt-in, opt-out, complaint e hard bounce.

Bloqueios:
- `JENIOS_MARKETING_EMAILS_ENABLED=false`;
- `JENIOS_MARKETING_PLANNER_ENABLED=false`;
- o planner não envia e-mail;
- nenhuma edição de newsletter é criada automaticamente;
- produção permanece inalterada.
