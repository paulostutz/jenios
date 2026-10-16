# JENIOS Platform R32 — checkpoint de alertas (16/10/2026)

**Escopo:** JENIOS Platform. Este commit é um checkpoint DOCUMENTAL. Os fontes da aplicação e o núcleo privado permanecem no pacote privado, não foram aplicados à `main`, nem publicados.

## Identidade e preservação

- Produção GitHub conferida: `8bcdef507ee2774bc24f832e1d04608fde16aea9` (R24).
- Vercel voltou a recusar autorização `403 Forbidden` no escopo da equipe `jenios`. Nenhuma tentativa de contorno, deploy ou alteração de domínio.
- **95 arquivos protegidos** da Social, BankScore, Validador, PDF, PAY e bibliotecas correspondentes comparados com R31 e idênticos byte a byte. Nenhum arquivo original excluído.
- Mascotes humanos Gênio/Gênia somente para posts e suporte interno; não aparecem na LP. Platform mantém slogan “A Plataforma Que Transforma o Seu Erro Em Lucro”; slogan literal Social permanece não confirmado, não inventado.

## Novo na R32 (não ativar como serviço operacional)

- Página `/platform/alertas`, links na gestão e no atendimento Gênio/Gênia, **fora da Social**.
- API `/api/platform/alertas` autenticada, titular derivado do token Supabase no servidor, verificação de assinatura ativa em um dos três planos.
- Registro de até **12 solicitações** por usuário: MegaPulse, movimentações de baleias, tokens explosivos; BTCUSDT/ETHUSDT/SOLUSDT spot, possíveis inícios de tendência, rompimento e volatilidade em 5m/15m/1h/4h/1d.
- Pausa, remoção e retirada de interesse possíveis mesmo após vencimento. Preferências do titular com controle otimista de revisão e idempotência de comandos.
- `whatsappInterest` registra interesse no **futuro** serviço; **NÃO é consentimento de envio**, sem telefone e sem disparo. Não há template, webhook, número verificado, worker, agendamento ou monitoramento ativo. Respostas explicitam `monitoringEnabled=false`, `whatsappDeliveryEnabled=false` e `executionEnabled=false`.
- Filtro `lib/alerts/matcher.mjs` somente para observações OFFLINE de fontes hipoteticamente verificadas; rejeita eventos históricos, vencidos, não confirmados e fora da lista. **Não é fonte de cotação real, sinal aprovado nem sistema de entrega.**

## Banco real Supabase

- Migração **aditiva** `jenios_platform_alerts_r32`, criando somente `public.jenios_platform_alert_prefs`.
- RLS ativado; papel `anon`/usuário `authenticated` sem privilégios diretos, serviço autorizado. Armazena somente solicitações, contadores de comandos e preferência, sem telefone, conversas ou credenciais.
- Teste transacional de FK, revisão concorrente, rejeição de versão obsoleta, estado inválido e privilégio passou com `ROLLBACK`. Consulta posterior confirmou **zero registros**.
- Security Advisors executados: avisos de SECURITY DEFINER corrigidos na R31 permanecem ausentes. Persistem aviso de proteção de senhas vazadas desativada (configuração Auth necessária) e notas INFO para tabelas somente-serviço sem políticas diretas.

## Validações efetivamente concluídas

- **589 testes da aplicação** passaram, zero falhas/ignorados (31 novos R32).
- **108 testes do núcleo privado** passaram novamente; nenhuma ordem real.
- **337 arquivos** na verificação de sintaxe.
- **Build otimizado Next.js/webpack** aprovado, rota de alertas incluída.
- **33 asserções HTTP** com handler de alertas real, identidade e armazenamento SINTÉTICOS; inclui 25 comandos concorrentes, um vencedor e 24 conflitos.
- Servidor compilado respondeu 200 para a nova página e 401 para GET/POST sem login na API. Outras páginas da Social/Platform smoke verificadas.
- **Chromium headless** em página de teste local bloqueado com `ERR_BLOCKED_BY_ADMINISTRATOR`; E2E visual real **NÃO homologado**, sem contorno.
- Não houve envio ao WhatsApp, agendamento, transação financeira, ativação do robô ou comunicação externa.

## Backup integral e evidências

- Biblioteca do proprietário: **/JENIOS-Platform-R32-completo-privado.zip**
- Total **663 arquivos**, 6.561.795 bytes.
- SHA-256 ZIP: `8e8fb49df093d7b8b4cd4d3512c19f26848e0a230a7d0e6f12ef5a4fcabf1cc0`.
- Manifesto `MANIFESTO-R32-SHA256.json` com todos os 662 arquivos listados; hash de cada um conferido diretamente do ZIP após compactação.
- Documento `documentacao-r32/RELATORIO-R32.md`, evidências R32, aplicação integral R25–R32 e núcleo proprietário separado. Nenhum segredo real, node_modules ou binário de fonte tipográfica.
- Este checkpoint GitHub guarda documentos apenas e não substitui o ZIP integral. Não confundir SHA do commit com revisão de produção.

## Próximos bloqueios para um serviço verdadeiro

Reautorizar Vercel; preview isolado/rollback e teste E2E autenticado com desktop/iPhone. Contratar e validar fornecedores de mercado, regras de eventos, histórico temporal e backtesting; criar job assinado e entrega idempotente. Habilitar WhatsApp somente com Meta oficial, número verificado, consentimento explícito, modelos aprovados e opt-out. Resolver Auth de senhas comprometidas. Validar calibração e corretoras antes de permitir execução com dinheiro real. Enquadramento de recomendações personalizadas deve ser analisado previamente.

**Release gate: desenvolvimento local PASS; produção NO_GO; trading real NO_GO; WhatsApp NO_GO.**
