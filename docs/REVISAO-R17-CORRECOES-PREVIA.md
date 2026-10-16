# R17 — Correções após teste da prévia

Lives: visitante recebe convite de login, sem requisição autenticada, formulário de publicação ou falso erro de carregamento.
Perfil: abertura do editor e renderização do modal exigem conta autenticada; a gravação já exigia validação do usuário no servidor. Meu Perfil e Salvos também pedem login.
Insights: links da Social pedem login; a rota direta valida o usuário e oculta o painel para visitantes, sessões inválidas e contas anônimas. A troca de sessão invalida a verificação anterior.
Validador: Litecoin removido da seleção e do aviso de indisponibilidade. A proteção no backend para rede não suportada foi preservada.
Hub: critérios numéricos de seleção e textos de implementação removidos da interface. MegaPulse e baleias permanecem sem fonte integrada; dados não foram inventados.

## BankScore — diagnóstico confirmado, pendência de configuração
A prévia R16 respondeu HTTP 503 em /api/bankscore/ranking com codigo CONFIG e BankScore não configurado. /api/bankscore/indicadores também respondeu 503. A tabela public.jenios_bankscore_homologacao no projeto igayfjorjmucthlfoasf contém 1398 registros e período máximo 202606.
O código exige NEXT_PUBLIC_SUPABASE_URL e uma credencial exclusivamente de servidor: SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY. É necessário conferir/adicionar a credencial no ambiente Preview do projeto Vercel jenios-ecossistem e republicar. A conexão Vercel não está instalada no chat; nenhum segredo foi exposto, adicionado ao GitHub ou substituído por acesso público ao banco.

## Validação
251 testes unitários; build de produção; testes de navegador de visitante nas Lives, editor, Insights, seletor cripto e Hub. Registros em docs/evidencias-r17. Testes locais usam sessões e respostas simuladas; BankScore não foi declarado corrigido sem sua configuração na Vercel.
