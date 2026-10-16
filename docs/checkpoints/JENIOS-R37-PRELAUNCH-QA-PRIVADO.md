# JENIOS R37 — painel privado de pré-lançamento e QA

**16/10/2026. Checkpoint documental, sem deploy.** Escopo exclusivo JENIOS.

## Estado da produção
- Main observada e preservada: `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10` (R35: checkout público com bloqueio comercial).
- A R36 e a R37 são privadas, NÃO enviadas ao GitHub público nem implantadas na Vercel por este checkpoint.
- O Banco Inter / Pix Automático não foi conectado ou modificado; as tarefas financeiras ficam para o próximo estágio decidido pelo proprietário.
- Não foram feitas operações bancárias, ordens financeiras, chamadas ao provedor de IA, envios de WhatsApp, alterações no banco nem posts na Social.

## Funcionalidade R37 preparada no ZIP
- `/admin/platform/prelaunch` e `GET /api/admin/platform/prelaunch`.
- Exige `permissions.manage` com verificação no servidor (401 anon; 403 não-admin em fixture).
- Consulta somente metadados de produtos da categoria Platform; nenhuma consulta a outros usuários, pagamentos ou segredos.
- Mostra catálogo dos planos R$99,90/R$149,90/R$199,90, escola T.Jenio, Gênio/Gênia, IA configurada versus homologada, alertas, corretoras, mídia/FFmpeg, dispositivos e MFA.
- Indicadores são NO-GO para assinatura recorrente, execução com dinheiro real e automações não homologadas.
- `scripts/qa-r37-prelaunch-http.mjs` roda exclusivamente em loopback e gera evidência HTTP sem gravar dados.

## Testes efetivamente repetidos
- **674 testes da aplicação** aprovados, 0 falhas, 0 ignorados.
- **108 testes do núcleo privado** aprovados, 0 falhas.
- **355 arquivos** no verificador de sintaxe.
- Build Next.js 16.4.2 Webpack bem-sucedido com ambiente fictício de QA.
- **19 verificações HTTP locais**: nove páginas 200, sete endpoints protegidos 401, query de usuário de terceiro 400, POST no checklist 405 e repetição do checklist anônimo 401.
- Comparação SHA-256 R36 vs R37: somente `app/admin/page.js` é um arquivo preexistente alterado; 7 arquivos de código/teste/QA novos, 0 arquivos antigos excluídos. Social, PAY, BankScore, Validador, PDFs e núcleo de pesquisa não foram alterados.
- Supabase advisors somente leitura: `auth_leaked_password_protection` permanece WARN; 17 observações INFO de RLS sem policy de cliente. Referência oficial: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Sem navegador autenticado real / iPhone / WhatsApp / IA externa / FFmpeg em deploy definitivo / corretoras; isso é pendente, não passou em homologação.

## Backup privado cumulativo R25–R37
- Biblioteca: `/JENIOS-Platform-R37-completo-privado.zip`.
- Tamanho: **8.685.354 bytes**, **739 entradas ZIP**; **738 arquivos** listados no manifesto.
- SHA-256 do ZIP: `70c4b199a46c3b7507d728c079d293d68a8573e963eecfb1a0a58d7aa8417163`.
- Manifesto `MANIFESTO-R37-SHA256.json` e logs de testes/HTTP/build no arquivo.
- Integridade ZIP e SHA-256 de cada arquivo conferidos. Código de investigação proprietário permanece **no pacote privado**, sem push no repositório público.
- Backups históricos de releases R25–R36 mantidos, não modificados.

**Decisão de lançamento:** Platform completa NO-GO; receita recorrente NO-GO; trading com dinheiro real NO-GO até homologação externa formal. Este checkpoint não promove versão para produção.
