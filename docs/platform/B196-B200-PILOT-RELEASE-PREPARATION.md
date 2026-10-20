# JENIOS Platform — B196–B200: preparação de homologação Paper e revisão comercial

**Escopo:** somente `paulostutz/jenios`, desenvolvimento separado, 20/10/2026.
**Base imutável:** B195, `5d62ac2ac965ea585e4423bdacf8c212ec703892` (CI 39513427802 SUCCESS).
**Produção preservada:** B177-R3, `caaffece04649a6dc1ca6c8012d7502887771529`, projeto Vercel `jenios-ecossistem`.

## B196 — Revalidação segura da conta Alpaca Paper

- Módulo isolado e não importado por rota de Next.js, chamado somente em **processo privado** explicitamente habilitado, fora da Vercel.
- Reutiliza o cofre AES-256-GCM B165 e o leitor oficial GET-only B166. Exige sessão autenticada, diagnóstico, vínculo cliente/corretora, leitura recente, identidade externa, consulta server-role de revogação e ausência de rotação das credenciais antes de descriptografar.
- Consulta a conta Paper apenas sob invocação do operador com credenciais protegidas. Compara digest HMAC da conta original; nenhuma senha, identidade bruta, saldo, ordem ou token chega ao resultado.
- Testes em CI são mocks, **não verificam uma conta real**. Mesmo um GET autenticamente bem-sucedido não prova titularidade civil nem confirma escopo de negociação da chave.

## B197 — Comparação de observações de ordens

- Aplica o normalizador existente B173 a **duas observações GET** fornecidas pelo processo privado, sem disparar novas solicitações nem modificar o livro B152.
- Bloqueia divergência de `client_order_id`, símbolo, ID de pedido, quantidade contratada, quantidade executada regressiva, timestamps inconsistentes e observações obsoletas.
- Apenas classifica estabilidade de estados, sempre requer reconciliação humana. Duas respostas fornecidas pelo chamador não são testemunho externo independente e não certificam a ordem por si.

## B198 — Watchdog de proteção e incidentes

- Usa a revisão B193 e a posição de risco B152 para gerar **classificação de incidente read-only**.
- UNKNOWN/SUBMITTING = crítico, sem reenvio. Execução parcial ou total sem bracket verificado = crítico, com indicação de pausas locais e auditoria do stop/alvo. Bracket apenas observado = revisão obrigatória: stops não garantem preço nem execução.
- Distingue fechamento contábil local de fechamento confirmado na corretora. Detecta reserva de risco ausente ou liberada prematuramente.
- Não executa pausa, cancelamento, encerramento, depósito, transferência, saque, ou operação.

## B199 — Matriz técnica/comercial para lançamento

- Reusa os contratos existentes de **três planos Platform**, catálogo da JENIOS PAY e auditoria de ciclo de assinatura. Não altera preços, checkout, Pix, assinatura ou webhook.
- Informa separadamente as pendências de publicação informativa, ciclo de assinaturas, conta Paper do próprio cliente, permissões, worker e operação real.
- Mesmo evidências completas fornecidas pelo chamador não são certificação independente. A matriz **jamais autoriza cobrança automática, promoção para produção ou trading ao vivo**.
- Os resultados B182/B194 permanecem desfavoráveis para alegações de rentabilidade da tecnologia original; estudo prospectivo independente ainda necessário.

## B200 — Integridade e CI

- Adiciona somente módulos, testes, documentação e workflow nesta branch. O verificador exige exatamente os 11 caminhos novos e conteúdo **bit a bit intacto** dos módulos críticos B195.
- GitHub Actions: Node 22, regressões B196–B200, B190–B195 e B185–B189; risco anterior Alpaca; toda a suíte, Social S05, build Next e navegador; segurança em localhost com ambiente sem segredos; ZIP de código público + log + hashes.
- Sem alterações de Supabase, worker instalado, infraestrutura paga ou projeto Letter/Chefe. Nenhuma alteração nos núcleos proprietários, Social, Gênios, Universidade, BankScore, Validador, JENIOS PAY e rotas operacionais existentes.

## Pré-condições para o piloto autenticado real

1. Conta Alpaca Paper de teste pertencente ao voluntário, vinculada via **cofre privado**; autorização específica para chamadas GET externas; revisão independente das permissões da chave.
2. Processo privado isolado, persistente e seguro para permitir auditorias sob responsabilidade do operador, com telemetria, alerta e reconciliação.
3. Autorização **separada** antes de qualquer POST de ordem Paper no provedor, seguida de verificação de ACK, parcial, cancelamento, timeout, stop e alvo por leitura independente.
4. Estudos originais retrospectivos fora da amostra e prospectivos com custos reais/estimados, perdas, drawdown, slippage, latência, liquidez e diferentes regimes; sem promessa de ganhos.
5. Lançamento comercial condicionado a catálogo, ciclo de assinatura, webhook e contratos de acesso efetivamente auditados; não habilitar pagamentos com base em fixtures.
6. Dinheiro real permanece **NO-GO** até autorização específica, revisão de conformidade, segurança e risco.

**Estado correto:** este bloco prepara a engenharia; testes mock de APIs oficiais não comprovam certificação externa, conta autenticada real ou lucro. Nenhum cliente deve inserir credenciais pelo chat.
