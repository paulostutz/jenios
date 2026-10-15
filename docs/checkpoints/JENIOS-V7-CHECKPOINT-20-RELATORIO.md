# Checkpoint interno 20 — bloco integrado da Social

Decisão atual: recorrência dos três planos Platform fica para depois de concluir a Social. Preservar estrutura/checkout separado e preços; não tratá-la como bloqueio deste bloco. PAY Inter e webhook existentes considerados validados pelo usuário e não reconstruídos. Nenhuma cobrança, migração, alteração de dados ou configuração remota executada.

## Validador

- Inventário de carteira incorporado à emissão paga existente, depois de validar titular, pagamento e alvo. Falha na consulta primária impede laudo detalhado e não inicia inventário. Sem armazenamento de relatório na nuvem.
- Solana: verifica genesis mainnet e consulta SPL/Token-2022 separadamente, valida proprietário/programa/tipo/conta, deduplica contas, agrega mints com BigInt e decimais consistentes. Limite de 500 contas por programa. Pode incluir NFTs/extensões; não afirma fungibilidade ou saldo transferível.
- EVM: exige RPC configurado com métodos Alchemy; confirma chainId e carteira da resposta, enumera até três páginas de 100 registros e rejeita cursor repetido/contrato duplicado/saldo inválido. Limite atingido é inventário parcial. Provedor básico sem método retorna indisponível, não saldo zero.
- TRON: verifica checksum/base58 e endereço da resposta no índice mainnet fixo TronGrid, até 300 registros TRC-20. Metadados por consulta constante somente leitura, sem assinatura nem gasto em rede. Chave opcional TRON_PRO_API_KEY em cabeçalho apenas para host fixo.
- Metadados EVM/TRON dos dez primeiros contratos; demais conservam unidades brutas quando não houver decimais. Timeout de chamada e orçamento temporal limitado. Nenhum erro bruto ou URL privada do provedor é publicado.
- Relatório/tela/PDF distinguem endereço de emissor, símbolo semelhante em contrato diferente e ausência no catálogo limitado. Não soma tokens diferentes, não promete autenticidade universal e não inventa parcela financeira falsa. Falha estrutural descarta inventário com motivo inconclusivo. Relação entre índice concluído e cobertura universal explicitada.
- Consulta real de QA ao RPC público mainnet Solana respondeu: inventário disponível, leitura concluída, 187 mints com saldo positivo na consulta de endereço público de referência. Não é teste de carteira do usuário, nem homologação das demais redes. EVM/TRON testados com fontes simuladas; provedores configurados em produção ainda precisam de teste.

## Especialistas e Impulsionamento

- Perfil público individual em /especialistas/perfil/[id], com currículo, experiência, certificações autodeclaradas, YouTube e contratação de serviços pelo mesmo botão PAY. Diretório aponta para o perfil. API por ID valida identificador antes de conexão e só expõe perfil com consentimento público; privado/ausente responde 404 sem dados. Não inventa desempenho da Platform.
- Menu de publicação própria oferece Impulsionar; posts com UUID levam o ID para seleção. Feed compartilhado também oferece link por autoria. A autorização real permanece no servidor, não na comparação visual de handle. Post local sem ID remoto abre seleção normal; não é automaticamente copiado ao banco nem passa a existir entre dispositivos. Essa limitação do feed legado permanece explícita, não foi migrado/reconstruído.
- Gestão de campanhas/atendimentos e respectivas migrações dos checkpoints 11/12 preservadas. Ainda exigem instalação/flags no ambiente real; este bloco não as ativou remotamente.

## Pagamentos e layout

- Admin pode cadastrar valores iniciais aprovados em uma ação autenticada: insere somente códigos ausentes por upsert ignoreDuplicates, sem reescrever preços/ativação existentes. Inclui produtos Platform já previstos no catálogo, sem implementar recorrência. Nenhum status de pedido é editado manualmente.
- Layout Social passa a uma coluna em telas pequenas; dashboard-logado empilha menu/conteúdo e permite extrato horizontal dentro do seu contêiner. Comportamento visual depende de homologação em navegador; não declarar aprovado apenas por build.
- Hub continua sendo o mesmo componente na Social e na página isolada, com os limites de fontes/evidência registrados anteriormente. Nenhuma identificação institucional inventada.

## Verificação e continuidade

217 testes automatizados aprovados. PDF de inventário sintético de duas páginas gerado, renderizado e inspecionado, incluindo saldo acima de Number.MAX_SAFE_INTEGER e divergência de símbolo. Não é consulta real nem entrega final. Scripts de navegador atualizados para extrato, BankScore e aba Hub, ainda NÃO executados por indisponibilidade do Chromium registrada anteriormente.

Build final, 42 verificações HTTP e git diff --check aprovados. Primeira tentativa local de build encontrou ENOTEMPTY em saída .next residual; compilação passou e build limpo resolveu. Saídas geradas antigas foram preservadas em /tmp, sem alterar código para contornar falha. Não houve instalação de dependências ou revalidação Inter. Backup por commit na homologação; nenhum ZIP provisório.

Não declarar Social inteira finalizada: fontes B3/baleias e comprovação de criação/institucional no radar ainda não existem; homologação autenticada e instalação dos módulos no ambiente real continuam pendentes. Não transformar indisponibilidade explícita em recurso funcional por simples renomeação. Teste das cobranças será do usuário, conforme autorização atual.
