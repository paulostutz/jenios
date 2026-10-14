# JENIOS Social V7 — Checkpoint 06

Data: 14/10/2026
Branch: jenios-v7-homologacao
Base GitHub verificada: commit 3da1087

## Recuperação e preservação

- Checkpoint 04, memória mestra, manifestos e base completa foram recuperados da Biblioteca.
- O código real da branch foi comparado com os pacotes; as alterações foram integradas seletivamente, sem substituir o Social já funcional.
- Produção jenios-ecosistem e branch principal não foram alteradas.
- Nenhuma migração ou escrita de dados foi executada no Supabase.

## Concluído em código

1. BankScore: ranking Top 10, pesquisa, seleção por código/período, laudo prudencial, PDF real, credenciais server-side compatíveis e período mais recente automático.
2. Hub: tendências de busca identificadas corretamente; MegaPulse/baleias bloqueados sem fonte homologada; nenhum sinal fictício.
3. Especialistas: perfil autenticado na tabela existente jenios_specialist_profiles, validação de YouTube, prévia e métricas sem dados inventados.
4. Publicações: mesmo seletor para foto e vídeo; vídeo até 90 segundos e 50 MB; prévia/reprodução nativa; música removida.
5. Validador: consulta server-side para EVM, Bitcoin, Solana e TRON; evidências, explorador e PDF; Litecoin explicitamente não homologado.
6. JENIOS PAY: catálogo/health sobre tabelas existentes; pontos de cobrança ligados aos quatro módulos; gate fail-closed; checkout Platform separado.

## Verificações executadas

- npm test: 52 aprovados, 0 falhas.
- npm run build: aprovado, 46 páginas geradas.
- git diff --check: aprovado.
- Supabase somente leitura: tabelas BankScore, Especialistas e seis jenios_pay_* existentes; jenios_pay_products vazia.

## Pendências e não homologado

- Cobranças reais: pendentes e desativadas. Os pacotes JENIOS PAY V1/V2 e Blocos 9–11 recuperados declaram que Pix, webhook autenticado, conciliação e persistência transacional não foram implementados.
- Preços/códigos dos produtos Social: pendentes de cadastro aprovado. Apenas o Validador possuía referência arquivada de R$ 9,90.
- Banco Inter: OAuth mTLS arquivado com escopo cob.read; criação de cobrança e verificação real de webhook não estão presentes no código recuperado.
- Especialistas: publicação pública, verificação documental e contratação ainda não homologadas.
- Upload de mídia: seletor e reprodução concluídos; armazenamento remoto de vídeos ainda não homologado.
- Hub, Validador e PDFs: build/testes aprovados; navegador e Vercel Preview pendentes.
- Nenhuma alteração foi promovida para produção.

## Próximo bloco seguro

1. Cadastrar, após aprovação comercial, os quatro produtos Social na tabela existente.
2. Implementar em homologação criação de Pix, autenticação do webhook e idempotência com o contrato Banco Inter correto.
3. Testar a branch em Vercel Preview com credenciais de homologação.
4. Homologar navegador, mídia, PDFs e fluxos pagos de ponta a ponta antes de promoção.
