# Checkpoint 21 — verificação consolidada

Data local: 14/10/2026. Continuidade do checkpoint 20; sem alteração funcional dos módulos, sem cobrança, migração ou configuração remota. Produção preservada. Recorrência da Platform continua fora deste bloco.

Criado scripts/verify-social-release.mjs para executar testes, build, servidor temporário em porta local livre, verificações HTTP e, quando solicitadas, inspeção de instalação e verificações em navegador. A rotina não instala nem ativa módulos. Falhas de testes/build interrompem a sequência; falhas nas demais etapas são registradas com saída 1. Etapas omitidas ficam explicitamente como não executadas. Servidor temporário é encerrado ao final.

Executado com --skip-build --installation: 217 testes aprovados, 42 verificações HTTP aprovadas contra o build existente do checkpoint 20. Inspeção de instalação retornou pendências de configuração, como esperado neste ambiente. Build não repetido: nenhuma aplicação compilada foi alterada. Navegador não executado: Chromium ausente; instalação anterior já falhou e não foi repetida. git diff --check aprovado.

Consulta somente leitura ao Supabase retornou nenhuma branch de desenvolvimento. Consulta aos workflows associados ao commit remoto retornou lista vazia; isso não prova ausência de toda integração CI, pois o conector filtra execuções de pull request. Não foi criada branch Supabase nem ativado serviço pago para contornar essa limitação.

Pendências reais mantidas: instalação/configuração em destino de homologação isolado, testes autenticados com duas contas, teste de cobranças pelo usuário, fontes B3/baleias e evidência de criação/identificação institucional no radar, homologação dos provedores de inventário cripto configurados. O radar atual filtra pools recentes por idade e atividade, sem comprovar novidade do token. Nenhuma dessas pendências é marcada como concluída por aprovação dos testes automatizados.

Backup deste bloco por commit na branch jenios-v7-homologacao; sem pacote provisório. Não entregar como instalação final ou Social inteiramente concluída.
