# JENIOS B250 — checklist de aceite manual para candidato de release

Marque apenas com evidência original datada do ambiente alvo; uma marcação no navegador não autoriza operação financeira.

- [ ] CI integral verde no commit exato da branch de homologação, sem secrets nos artefatos
- [ ] Compatibilidade verificada entre Social, Platform, Gênios, Universidade, BankScore, Validador e PAY
- [ ] Login real e controle de acesso em navegadores móvel e desktop, recuperação de sessão e isolamento por usuário
- [ ] Formulário de corretora somente em ambiente autorizado, leitura verificada na conta do próprio cliente, rotação e revogação auditadas
- [ ] Nenhum usuário consegue emitir ordens Paper ou Live em rota pública
- [ ] Identidade do pagador comprovada em ambiente sandbox; testes de Pix, recorrência, antifraude e cancelamento externos
- [ ] Sem afirmações de rentabilidade não comprovadas, todos os estudos negativos preservados
- [ ] Restauração e rollback documentados e testados sem executar ordens
- [ ] Aceite humano do escopo publicável com funcionalidades não homologadas ainda desligadas
- [ ] Autorização separada para infraestrutura adicional, autenticação de corretora, envio Paper e qualquer operação real

**Resultado atual:** candidato técnico para avaliação; pendências externas NÃO concluídas.
