# JENIOS R35 — checkout seguro publicado e Platform privada preservada
Data: 16/10/2026. Escopo exclusivo: JENIOS.

## Estado exato
**Parte pública pequena publicada:** hotfix do checkout no PR https://github.com/paulostutz/jenios/pull/3, commit squash da main `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10`. Status GitHub/Vercel para o projeto **principal `jenios-ecossistem`: success / Deployment has completed**. Outro projeto `jenios-anxp` tinha falha separada; não confundir com o deployment principal.

**Pacote completo privado R25–R35:** NÃO aplicado à `main`. Biblioteca do proprietário `/JENIOS-Platform-R35-completo-privado.zip`, 6.765.171 bytes, 702 entradas ZIP e 701 arquivos listados no manifesto. SHA-256: `24633b941674cdf268f391ddb4d9591523a320ad4955f5bb685ec81fd2c30ec8`. Arquivo zip e hashes individuais conferidos. Contém aplicação Next16, IA/ensino/alertas/diagnóstico no modo preparado, núcleo de pesquisa proprietário separado, relatórios, scripts de QA e proposta SQL para staging. Não contém credenciais reais nem node_modules nem .next; **núcleo proprietário não enviado ao GitHub público**.

## Proteção e compatibilidade
- Backup pré-publicação `checkpoints/jenios-r35-before-checkout-guard`, SHA de origem `e0c0b033b8c8f05bb1cdbb8aaea92900f64a2874` (Social R34).
- Hotfix público contém somente `app/checkout/page.js`, helper público `lib/platform/checkout-readiness.mjs`, testes e workflow. Não modifica PAY, Social, APIs BankScore, Validador, PDF, auth ou robôs financeiros.
- Checkout deixa de oferecer cobrança se `configured`, produto real, status, moeda, ciclo mensal, provedor e `subscriptionLifecycleReady` não estiverem todos explicitamente confirmados. Mantém os três preços visíveis.
- CI GitHub Actions do branch `fix/jenios-r35-checkout-platform-safe`: execução `38955846736` concluída com **success**, preview principal success, PR nº 3 merge confirmado.
- Proteção dos fontes na aplicação privada R35: **101 arquivos da Social R34 e APIs de negócio idênticos byte a byte**, nenhum dos 478 arquivos-base do app privado R33 removido. App privada só mudou `app/checkout/page.js`, `app/api/platform/checkout/route.js`, com testes e auxiliares novos.

## Testes do pacote privado R35
- 627 testes da aplicação, 0 falhas / 0 ignorados.
- 108 testes do núcleo privado, 0 falhas.
- 344 arquivos verificados na checagem de sintaxe.
- Build Next.js 16.4.2/Webpack concluído com configuração fictícia.
- 19 verificações HTTP locais: 9 páginas respondendo 200, APIs sem token recusadas, checkout e ordens financeiras fail-closed.
- `scripts/verify-release-r35.mjs` PASS em segurança local, mas **NO_GO** para produção integral e execução real.
- `scripts/check-deploy-ffmpeg.mjs` detectou que o executável `ffmpeg-static` não existe no cache de QA. Não confundir com resultado do deployment Vercel ou com testes de conversão usando FFmpeg instalado separadamente.
- E2E Safari/iPhone e contas autenticadas em serviço externo ainda não homologados. Nenhum dinheiro, ordem ou WhatsApp enviado.

## Verificação de dados reais — somente leitura
Banco Supabase atual: **0** produtos `category=platform`, **0** assinaturas ativas da Platform, usuário `admin@jenios.com.br` ausente. As tabelas preparadas de ensino, assistente, diagnóstico e preferências de alerta existem. **Nenhuma tabela, conta ou registro de negócio foi alterado nesta R35.**

Próxima etapa: configurar ambiente **privado** de homologação sem expor IP; validar instalação real do ffmpeg-static, criar planos inicialmente inativos em staging, implementar e homologar assinatura recorrente (webhook assinado/idempotente, renovação, cancelamento), provisionar admin via Auth Admin API, conectar modelo de IA e provedores de mercado licenciados; por fim testar com contas reais de QA e Safari/iPhone. Não habilitar dinheiro real sem corretoras e motor de risco autorizados.

Aviso Supabase não resolvido: `auth_leaked_password_protection` ([remediação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Tabelas privadas com RLS ativado e sem policies de cliente geram avisos informativos previstos.

**Condição final:** Hotfix público do checkout R35 concluído; Platform cumulativa privada R35 testada localmente e preservada; nenhuma homologação completa da Platform ou trading real foi declarada.
