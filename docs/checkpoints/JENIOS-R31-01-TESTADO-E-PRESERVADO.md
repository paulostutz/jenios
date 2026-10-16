# JENIOS Platform R31 — checkpoint final (16/10/2026)

**Escopo:** exclusivamente JENIOS. Este commit contém DOCUMENTAÇÃO do checkpoint. Nenhum código proprietário nem fontes revisados foram enviados à main. Produção R24 continua em `8bcdef507ee2774bc24f832e1d04608fde16aea9` (verificado novamente no encerramento). Não houve deploy, mudança de domínio ou envio de ordens reais.

## Pacote completo e privado preservado

- Biblioteca do proprietário: `/JENIOS-Platform-R31-completo-privado.zip`.
- Tamanho: **6.470.754 bytes**.
- Arquivos: **637**.
- SHA-256 ZIP: `449c927361a8493faf3d06dd1c9cb4ae0d6dcaf7c1320c83ff72574a7eadca13`.
- Inclui R25–R31 cumulativamente: app inteira, núcleo privado separado, testes, docs, evidências, PDF sintético e manifesto validado.
- Núcleo proprietário NÃO foi enviado ao GitHub público.
- 104 arquivos sensíveis Social/BankScore/Validador/PAY/PDF comparados byte a byte com R30: **0 alterações**.

## Novo no código R31

- Observação descritiva do diagnóstico (15 negócios SIM-J; janela das últimas dez), sem seleção automática do modo, sem estatística de lucro prometida.
- PDF privado `GET /api/platform/diagnostic?download=pdf` apenas após 15 negociações encerradas; HTTP 409 se incompleto; 401 sem login. JSON/CSV preservados.
- PDF gerado, 2 páginas A4 renderizadas/inspecionadas visualmente. A semente e o futuro do replay não são enviados.
- Botão de download do relatório em `/diagnostico` e `/platform/diario` para coleta concluída.
- Gate reproduzível `scripts/verify-release-r31.mjs` retorna PASS dos critérios locais e **NO_GO** para produção e dinheiro real, refletindo pendências.

## Banco REAL: segurança aplicada e verificada

Migração `jenios_r31_restrict_rls_event_trigger`:
```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
```
Verificado: `anon_execute=false`, `authenticated_execute=false`, `service_execute=true`, event trigger `ensure_rls` continua ativo. Advisors: os dois WARN de SECURITY DEFINER desapareceram. Aviso separado da proteção contra senhas comprometidas permanece; precisa configuração de Auth. Nenhuma tabela de negócio/usuário/pagamento/social foi alterada nesta R31.

## Testes efetivamente concluídos

- **558 testes da aplicação** aprovados, zero falhas/ignorados.
- **108 testes do núcleo privado** aprovados, sem ordens reais.
- **328 arquivos** passaram pela verificação de sintaxe.
- **Build Next.js 16/Webpack aprovado** usando valores fictícios de QA, não conta de produção.
- **21 verificações HTTP locais** do diagnóstico: handler real + identidade/persistência SINTÉTICAS.
- **19 verificações HTTP locais** de páginas/rotas compiladas; LP sem Gênio/Gênia e rotas não autenticadas recusadas.
- **2 páginas PDF inspecionadas** em imagens e extração de texto.
- Chromium headless local não concluiu no tempo e o E2E interativo NÃO foi homologado.
- `ffmpeg-static` em deployment, autenticação real, WhatsApp, IA ao vivo, corretoras e backtesting robusto continuam pendentes.

## Liberação

Vercel devolveu **403 Forbidden** para o escopo da equipe `jenios` / projeto `jenios-ecossistem`. Não foi contornado. Aplicação R31 está no pacote privado, NÃO aplicada à main. Só publicar após reautorizar Vercel, realizar preview isolada, verificar regressão UI, mídia, permissão/assinaturas, fornecedores e aprovar release. Não é seguro habilitar trading com dinheiro real por ter passado testes unitários.

Os dois mascotes humanos são exclusivos de posts e do atendimento interno de suporte; não estão na LP. O slogan Platform é 'A Plataforma Que Transforma o Seu Erro Em Lucro'; o literal da Social ainda não foi recuperado com segurança.
