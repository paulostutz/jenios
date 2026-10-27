# JENIOS — R81 e preparação para contas reais — 27/10/2026

## Escopo da entrega
Branch `fix/jenios-r80-private-paper-safety-20261027`, PR #22 DRAFT, base de produção R79 `a24922cc829dd1b45b87a719e9fd57ab45e6d79b`.
Esta entrega prepara a aprovação de **limites PAPER** e a transição futura, sem prometer homologação Live. Sem custódia, sem saques, sem Pix e sem mudança de CHEFE/LETTER, PAY, Social ou motor proprietário R74.

## Componentes R81
- **Moeda obrigatória**: toda aprovação e assinatura Alpaca US-equity usa `USD` explicitamente; valores de risco são inteiros com escala `1e8`, jamais presumidos em BRL.
- `lib/platform/connections/paper-owner-risk-r81.mjs`: serviço privado exige sessão real do titular validada em Supabase Auth Platform, e-mail confirmado, autorização PAPER explícita, conexão Alpaca Paper ativa, hash da conta, limites *não predefinidos* e expiração até 1 hora. Não aceita userId arbitrário enviado pelo cliente.
- `supabase/review/jenios_r81_paper_owner_risk.sql`: proposta de migração aditiva, inicialmente em revisão; tabela de auditoria RLS service-only, inicialização em PAUSED, CAS de revisão para aprovar risco PAPER e registro atômico de autorizações assinadas. Pausas R80 e claim R79 compartilham locks sobre a mesma linha da conta.
- `lib/platform/connections/paper-permit-issuer-r80.mjs`: registro de autorização muda de INSERT simples para RPC `jenios_r81_register_signed_paper_permit`; sem a migração instalada a emissão falha fechada. A assinatura Ed25519 permanece de emissão privada; nenhuma chave operacional foi gerada ou implantada.
- Testes isolados e CI de regressão consolidados com R77/R78/R79/R80; todas as flags externas seguem `false`.

## Gates para conectar contas Live (NÃO concluídos)
1. Corretora oficial e mercados elegíveis selecionados, termos/licenças e responsabilidades legais revisados.
2. Cadastro e autenticação segregados por cliente, credencial de negociação sem saques e cofre separado de Paper, testes de rotação/revogação e nenhuma credencial no frontend ou logs.
3. Escopo de permissão na corretora e identidade do cliente verificáveis, limites *aprovados por conta e ativo* (capital, ordem, posição, perda diária/acumulada, alavancagem, stop, horário, drawdown) e consentimento específico para operação real.
4. Implementação de adaptador Live INDEPENDENTE de R77, never infer POST from GET, protocolo durável de reservas de risco/ordens e idempotência, cancelamento com recibo externo, atualização de fill parcial, reconciliação ao recuperar de crash e pausa fail-closed.
5. Kill switch por conta e global com verificação antes de POST, contenção de concorrência e confirmação externa de cancelamentos; kill switch local não equivale a posições encerradas.
6. Homologação de Paper com conta autorizada e recibos oficiais, testes de falha/limites/isolamento, revisão de segurança independente e registro de risco.
7. Aprovação humana explícita por conta/mercado/limite e ordem canário Live separadamente autorizada. Até lá `JENIOS_REAL_EXECUTION_ENABLED=false`, `realOrdersEnabled=false` e zero execução Live.
8. Site e aplicativos: CI+QA Preview; build iOS/Android assinada e distribuição por canais autorizados, sem supor que PWA equivale a atualização de loja.

## Segurança/rollback
Não basta retirar uma flag para ligar Live. `submitRealBrokerOrder()` no contrato B174 deve continuar recusando. R81 não cria rota HTTP pública de ordens nem assina aceites reais.
Backup de referência: docs/release/R80-001-TRUSTED-PAPER-SAFETY-20261027.md e issue #15.
Rollback de código preserva release R79; não apagar tabelas ou aprovações; manter funções privadas e motor externo desligados até homologação.
