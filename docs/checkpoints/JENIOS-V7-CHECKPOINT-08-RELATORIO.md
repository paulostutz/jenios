# JENIOS V7 — Checkpoint 08

Data: 14/10/2026. Continuação do Checkpoint 07 na branch jenios-v7-homologacao.

## Entregue em código neste bloco

- APIs do feed alinhadas às tabelas existentes posts, comments e post_likes; removidas referências a tabelas duplicadas/inexistentes e a deleted_at não presente no schema conectado.
- Serialização compatível com media_type e media_path existentes, incluindo carrossel misto.
- Upload assinado e validação pós-upload de usuário/pasta, MIME e tamanho real. Limites no navegador para vídeos até 90 segundos. Configuração de bucket idempotente, somente por comando explícito; não executada remotamente.
- Mesmo seletor de fotos/vídeos no feed compartilhado, com reprodução nativa e preservação de rascunho em falha. Mídia remota opcional no composer legado, sem substituir automaticamente o fluxo local.
- Área do Especialista com diretório público opt-in, currículo, YouTube, ofertas e preços. Perfis antigos ficam privados. Reutiliza jenios_specialist_profiles e representação versionada no campo sobre, sem criar tabela.
- Contratação de oferta com preço server-side, vendedor e cálculo de comissão JENIOS de 10%. Não executa repasses nem substitui a PAY.
- Validador com catálogo limitado de referências oficiais USDT/USDC, comparação por rede/endereço, leitura de metadados EVM e alertas de símbolos copiados. Não chama token fora do catálogo de falso.
- Correções de evidência: RPC de rede errada, conta vazia, resposta TRON de erro, Bitcoin 404 e assinatura Solana não produzem validação positiva indevida.
- PDF do Validador com quebra de linhas, paginação e fontes. Amostra sintética renderizada e inspecionada visualmente.

## Verificações

- 100 testes automatizados aprovados, zero falhas.
- Build Next.js aprovado.
- 20 verificações HTTP locais aprovadas.
- PDF sintético renderizado e inspecionado sem sobreposição ou corte.
- Supabase apenas consultado; nenhum dado, tabela, bucket, política ou migração foi alterado remotamente.
- Chromium indisponível: não afirmar homologação de navegador ou reprodução audiovisual real.

## Preservado

- Produção e main intactas; atualização somente na branch de homologação.
- Integração Inter/webhooks existente não foi reconstruída.
- Fluxos legados principais não foram migrados silenciosamente para outra persistência.
- Sem música; checkout da Platform permanece separado.

## Pendências reais para concluir a Social

1. Compatibilizar a fronteira de checkout com a instalação PAY existente e validar entrega/liberação por pagamento.
2. Configurar o bucket de homologação e testar uploads/reprodução com contas reais; o projeto conectado não possui buckets na inspeção atual.
3. Homologar o feed compartilhado e decidir sua ativação; o /social legado continua local por padrão para preservar o que foi testado no Mac.
4. Repasse e entrega efetiva dos serviços de especialistas, execução de campanhas e métricas reais.
5. Balanços oficiais complementares do BankScore; autenticidade avançada de tokens além do catálogo limitado; fontes pendentes do Hub.
6. Navegador/Vercel Preview e aceite final do usuário.

Backup consolidado de continuidade. Ainda não é release final homologada. Roteiro completo em docs/SOCIAL-V7-TESTES.md.
