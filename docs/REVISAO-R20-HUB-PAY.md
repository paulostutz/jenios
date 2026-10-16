# R20 — Hub e preparação da PAY — 15/10/2026

## Executado
- Usuário confirmou perfil/foto/cargo/@ e BankScore funcionando no preview jetw6gxi8.
- Corrigido acesso service_role ao catálogo/pedidos (SELECT/INSERT/UPDATE) e leitura de pagamentos/entitlements. RLS e permissões do navegador preservadas.
- Quatro produtos Social cadastrados por code com ON CONFLICT DO NOTHING. BankScore/cripto 990 centavos; boost/ofertas com orçamento variável.
- Migrações de campanhas e atendimentos aplicadas: arquivos 20261015000628 e 20261015001833 registrados remotamente como 20261015201222 e 20261015201226, respectivamente. Não reaplicar os arquivos antigos na instância já migrada.
- /api/jenios-pay/health mudou de 503 para 200 database=connected; catálogo configured=true nos quatro produtos. checkoutReady permanece false.
- BankScore /ranking respondeu 200 com dez registros após migrações. Nenhum arquivo BankScore modificado.
- MegaPulse: cobertura inicial de fechamento diário WIN/WDO via brapi term-structure, contrato mais próximo com preço/volume válidos. Não equivale a scanner completo de ações nem detecção de tendência persistente. Fonte/data/vencimento/variação visíveis. Cache 15 minutos, timeout 7 segundos, falhas isoladas por ativo; preços inválidos, vencidos, futuros ou com mais de 7 dias rejeitados.
- Testes: 78 testes de pagamentos prévios aprovados; 2 testes novos de validação/cobertura parcial/cache aprovados; build Next aprovado.

## Pendências externas e funcionais
- Não existe serviço PAY publicado separado informado pelo usuário. O adaptador exige endpoint/token; código Inter disponível só autentica cob.read, não cria cobrança nem processa confirmação. Não ativar pagamentos por uma flag sem implementar/homologar emissão, conciliação e entrega.
- Flags de campanhas/atendimentos ainda não ativadas na Vercel; certificados Inter visíveis em screenshots pertenciam a outra branch. Não mover segredos nem habilitar cobrança sem validar ambiente e scopes.
- Nenhuma cobrança, repasse, split ou teste financeiro real executado.
- MegaPulse ações e baleias seguem pendentes. Dados diários não são tempo real. Fonte: https://brapi.dev/docs/futuros/curva-de-vencimentos
- jenios.com.br ainda precisa de configuração de domínio/DNS e publicação de produção; não foi modificado neste checkpoint.
- Advisors: nenhum alerta WARN novo das extensões. Alertas anteriores rls_auto_enable e proteção de senha vazada desativada permanecem. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Eventos boost sem política cliente são intencionais (servidor apenas).
