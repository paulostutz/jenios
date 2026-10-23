# B305-R30 — Adaptador puro de mensagens de marketing

Base: R29 `33062e0f3cd13933618af01c1d62ad0c599b55ea`.

O adaptador puro cobre:
- recuperação de carrinho;
- nurture de usuário sem plano;
- Radar de Mercado.

Antes de montar a mensagem:
- revalida opt-in, opt-out, complaint e hard bounce;
- revalida frequency cap;
- carrinho exige pedido ainda `awaiting_payment`;
- produto precisa ser Platform mensal e ativo;
- nurture é bloqueado se houver plano ativo;
- newsletter exige edição aprovada e já vencida;
- cada fonte da newsletter precisa usar HTTPS;
- destinatário é validado e normalizado.

O módulo não acessa banco, não chama Resend, não atualiza ledger e não possui efeitos colaterais.

`JENIOS_MARKETING_DELIVERY_WORKER_CERTIFIED=false` permanece até a ligação futura deste adaptador ao mecanismo de entrega ser certificada.
