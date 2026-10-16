# JENIOS Platform R32 — alertas preparados, transmissão retomada

**Data:** 16/10/2026  
**Escopo:** exclusivamente JENIOS Platform.  
**Natureza:** checkpoint documental; fontes completos e núcleo privado entregues no pacote da Biblioteca, **não** publicados na branch `main`.

## Recuperação após interrupção

O trabalho R32 foi encontrado no diretório de desenvolvimento com o código e testes locais. O pacote R31 foi conferido por SHA-256 (`449c927361a8493faf3d06dd1c9cb4ae0d6dcaf7c1320c83ff72574a7eadca13`). Foram acrescentadas correções e testes durante a retomada, e a R32 foi reempacotada.

## O que o R32 prepara

- `/platform/alertas` e `/api/platform/alertas` para armazenar **solicitações** por titular logado.
- Eventos Hub: `megapulse`, `baleias`, `tokens_explosivos`.
- Ativos spot de referência iniciais `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, opções de tendência, rompimento e volatilidade em períodos 5m, 15m, 1h, 4h, 1d.
- Limite de 12 solicitações por conta; revisão concorrente/identificador idempotente; pausa, exclusão e retirada do interesse no WhatsApp.
- Assinatura vigente dos três planos para adicionar novas preferências. Titular pode ler/pausar/remover sem plano ativo.
- **Interesse em WhatsApp NÃO é consentimento para envio**: número/opt-in verificado, Meta Business, templates, worker, integração e regras de horário continuam pendentes.
- Módulo `lib/alerts/matcher.mjs` de **triagem offline**, sem fonte ao vivo, nenhuma detecção comprovada do mercado, worker ou entrega. `monitoringEnabled=false`, `whatsappDeliveryEnabled=false`, `executionEnabled=false` por desenho.
- Não modifica nem replica a API original do Hub, BankScore, Validador, PDFs, Social ou PAY.

## Falhas corrigidas na retomada

1. Troca de conta durante uma solicitação podia manter a UI ocupada: limpa trava e estado ao trocar/desconectar.
2. Evento externo com timestamp sem fuso poderia ser interpretado incorretamente: passa a exigir ISO com timezone explícito.
3. Item Hub já cadastrado podia ser solicitado de novo pela interface: botão inativo quando já registrado.

## Testes finais da R32

- **592 testes da aplicação** aprovados, 0 falhas/ignorados.
- **108 testes do núcleo privado** aprovados, 0 falhas/ignorados; não houve ordens reais.
- **337 arquivos de sintaxe** verificados.
- **Build Next.js/webpack** concluído com variáveis de QA fictícias.
- **33 verificações HTTP** do handler real com identities e banco sintéticos, incluindo 25 gravações concorrentes com apenas uma aceita.
- **13 verificações HTTP** de páginas e APIs do Next compilado, 9 páginas responderam 200 e 4 APIs rejeitaram anônimos (401).
- Banco Supabase real: `public.jenios_platform_alert_prefs` existente, RLS ativo, 0 registros de teste, privilégios diretos anon/authenticated bloqueados, escrita de serviço permitida.
- Teste visual E2E, autenticação real, envio de WhatsApp e mercado ao vivo **não homologados**.
- 637 arquivos da base R31 preservados; 3 arquivos preexistentes modificados (README, links da gestão e do assistente). **88 arquivos protegidos** de Social e APIs financeiras conferidos idênticos, sem remoções.
- Aviso `auth_leaked_password_protection` ainda precisa ser configurado em Supabase Auth. Nenhuma alteração em usuários, pagamentos ou contratos.

## Backup privado FINAL

- Biblioteca do proprietário: `/JENIOS-Platform-R32-FINAL-verificado.zip`
- Arquivo ZIP: `JENIOS-Platform-R32-completo-privado.zip`
- **6.559.982 bytes**, **666 arquivos ZIP** (665 arquivos listados e um manifesto R32).
- **SHA-256:** `17ca7fead612441dc260f1377b9d80a244299ec29ba04a5e16daa8e32448d425`.
- CRC de todas as entradas e SHA-256 de cada arquivo manifesto verificados. Inclui material cumulativo R25–R32 e núcleo proprietário privado separado.
- O núcleo de execução não é gravado no repositório público.

## Situação de publicação

Produção `main` confirmada ainda em `8bcdef507ee2774bc24f832e1d04608fde16aea9` (R24). Nenhuma mudança na main, nenhuma publicação Vercel, nenhuma ordem financeira, cobrança ou mensagem disparada. Vercel anteriormente respondeu 403 sem autorização ao escopo `jenios`; reautorizar e homologar em preview antes de publicar.

**Status: código preparado e testado localmente; produção NO-GO e execução financeira NO-GO.**
