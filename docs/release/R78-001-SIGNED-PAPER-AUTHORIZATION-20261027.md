# JENIOS R78.001 — Autorização assinada por conta e ordem Paper

Data: 27/10/2026. Base: R77 \`691db9e5e27a44a03d3edf33b32260c88f7d0337\`.
Projeto exclusivo JENIOS — sem custódia, sem dinheiro real.

## Propósito
A R77 já implementou o transporte Alpaca PAPER com ordem única, reserva de risco B152 e proteção de reenvio; mas seu objeto \`approval\` de teste poderia ser construído por código não confiável. Antes de qualquer execução externa, é preciso vinculá-lo ao aceite real do titular da conta e a um registro durável do backend.

## Entrega
- \`lib/platform/connections/paper-signed-authorization-r78.mjs\` acrescenta verificação Ed25519 de um permit de 13 campos exatos, com domínio criptográfico separado.
- O comprovante traz UUID do usuário, conexão e autorização; digest da conta; \`client_order_id\`, modo direto/reverso/híbrido, símbolo, lado compra, exposição máxima e validade até cinco minutos.
- A chave pública é carregada de \`JENIOS_R78_PAPER_APPROVAL_VERIFY_KEY\` somente pelo worker privado; a chave secreta do emissor permanece fora do GitHub, Vercel e chat.
- Mesmo com assinatura válida, \`submitSignedR78PaperOnce\` exige consulta obrigatória a **registro durável de consentimento** \`approvalStore.findApprovedById\`, com assinatura/digest, owner, conta, ordem, prazo, não revogado e emitido por autenticação server-side Platform. A implementação concreta do repositório/issuer não está provisionada: ausência de repositório ou evidência => nenhuma ordem.
- O wrapper reutiliza \`submitAlpacaPaperOnce\` R77 e portanto o ledger B152, um único POST, \`UNKNOWN\` sem reenvio, proteção de stop/alvo e ambiente PAPER isolado.
- Testes geram par Ed25519 efêmero em memória (somente fixtures), verificam adulteração, titularidade, prazo, limites, faltas de configuração, registro revogado, código de assinatura e recibos.

## Restrição de produção
Nenhuma chave de emissão, endpoint público, banco novo, cron, operação real, Paper externo, alteração de R74, JENIOS PAY ou app nativo é ativado neste bloco. As flags do Vercel site continuam fechadas. Este módulo não torna os robôs aptos a Live.

## Aceite restante para piloto Paper real
O serviço privado precisa emitir o aceite sob autenticação comprovada do proprietário, armazená-lo em relação durável auditada, executar leitura oficial com credenciais Paper inseridas em canal seguro pelo titular e utilizar este wrapper. Validar ainda o recibo oficial, a continuidade depois de reinício e a revisão humana de risco. Depois disso, implementar separadamente o executor Live e os limites aprovados por usuário e ativo. Nenhuma parceria genérica substitui os controles específicos da corretora/API.

## R78.002 — Isolamento de Preview
A branch R78 foi explicitamente incluída na whitelist de Preview do guard S05, sob o mesmo projeto JENIOS, banco Social QA, banco Platform dedicado e 20 recursos externos obrigatoriamente desativados. Teste automatizado recusa qualquer flag externa ativada ou tentativa de promover a branch R78 a production. A identidade administrativa R73 continua protegida e o runtime R74 permanece em ciclos sintéticos.
