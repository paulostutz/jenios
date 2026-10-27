# JENIOS R78 — Consentimento verificável para execução Paper

Data: 27/10/2026. Base congelada R77: `691db9e5e27a44a03d3edf33b32260c88f7d0337`.

A R77 introduziu transporte Alpaca Paper em biblioteca privada com B152, mas o objeto `approval` ainda não era vinculado a uma atestação do servidor. O R78 acrescenta `lib/platform/connections/robot-r78-paper-approval.mjs`, isolado, sem rota HTTP, para emitir/validar uma prova HMAC SHA-256 associada ao usuário, conexão, ID de ordem, digest do pedido, limite nocional e janela temporal limitada a cinco minutos.

Sem a chave de assinatura de ambiente, assinatura válida ou comprovante armazenado, falha fechada. `claimR78Approval` exige um adaptador `store.claimOnce` com operação atômica durável para impedir consumo duplicado e rejeitar consentimento revogado. Não fornece store padrão nem concede execução, pois ainda falta instalar e certificar a persistência por conta.

**Fase exata:** fundação criptográfica de autorização, não integração completa. A R77 existente não foi alterada nem passou a chamar automaticamente esse gate. É obrigatório integrar essa verificação ao worker privado e ao registro de consentimento autenticamente emitido, mais revogação, idempotência transacional e kill switch antes de qualquer ordem externa. A assinatura isolada não atesta identidade e não resolve reenvios após perda de conexão.

A JENIOS continua sem custódia e operando exclusivamente em contas pertencentes aos clientes. Não houve criação de operações, uso de credenciais, cobrança ou migração neste bloco. A versão R77 no site e R74 em Supabase foram preservadas. Somente os testes locais simulados de consentimento podem ser declarados concluídos; não equivalem a autorização real.

**Checklist de homologação externa pendente:** conta Paper autenticada do titular, aprovação persistida, limites aprovados, bloqueio de emergência, observabilidade do worker, recibos oficiais, cancelamento e recuperação após crash, mobile assinado TestFlight/Play. Não modificar CHEFE/LETTER.
