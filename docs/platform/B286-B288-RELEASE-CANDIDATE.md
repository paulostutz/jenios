# JENIOS B286–B288 — integração, homologação e release candidato

Base B285-R2: 921fc35dab76bebf13f12c4fb22b1312f855a453; CI 39649650928 SUCCESS. Produção B177-R3 intocada.

## B286 — integração
Auditar a integridade dos módulos existentes: Social, LP, Gênios, Platform, Universidade, JENIOS PAY, BankScore, Validador e núcleos proprietários. Não recriar recursos já homologados. Testar regras de assinatura sintética (ativação, renovação, expiração, cancelamento e revogação), isolamento de acesso por plano, comportamento de fallback da IA e negativa de acesso Pro sem assinatura válida.

## B287 — homologação
Executar regressões completas e testes de navegador em localhost sem credenciais externas. Validar login, logout, recuperação de senha e acesso autenticado real em Preview somente quando houver ambiente protegido e contas de QA. Uma CI verde não comprova integração bancária, resposta de IA externa ou sessão autenticada real. Não desabilitar proteções de release para forçar Preview.

## B288 — release candidato
Preparar evidência de CI, inventário dos arquivos modificados, rollback para B177-R3 e checklist de lançamento. Não publicar em produção sem autorização explícita. Não iniciar pagamentos reais, ordens reais, Paper com corretora externa ou custos de IA.

## Bloqueios de homologação final
1. Banco Inter: credenciais e ZIP inseridos pelo Master posteriormente.
2. Pix real: emissão, confirmação, conciliação e ativação de assinaturas.
3. IA externa: configuração e orçamento autorizados, teste real de resposta e limites.
4. Preview autenticado: contas de QA e fluxo completo de usuário.
5. Release: aprovação do responsável após evidências e rollback.

**Estado:** candidato interno. Os módulos técnicos já existentes permanecem preservados; não confundir validação sintética com homologação comercial.
