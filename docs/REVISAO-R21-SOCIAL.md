# Revisão R21 — Social, Hub e Pix

Data: 15/10/2026. Branch de testes: `codex/social-r16-teste`.

## Entrega

- Feed consulta curtidas em lote, carrega contadores/Stories em paralelo e reutiliza memória por até três minutos somente após validar a conta. Navegação para módulos usa o roteador do Next. Vídeos não são baixados antecipadamente no feed.
- Publicação aparece imediatamente no feed e no perfil; novas publicações não são sobrescritas por uma leitura anterior em andamento.
- Mensagens no perfil abre o Direct do UUID visitado. Seguir consulta e persiste a relação real; clique concorrente bloqueado.
- Compartilhar oferece adicionar a publicação própria ou de outra pessoa aos Stories. A referência respeita bloqueios/moderação/remoção do original.
- Criação do Story recebe horário do servidor e expira exatamente 24 horas depois. Banco e interface excluem itens vencidos. Não há política de UPDATE para usuário reescrever o horário.
- Vídeos maiores que 6 MB usam upload assinado TUS em blocos de 6 MB, com progresso e repetição de falhas transitórias. Limites atuais: 50 MB e 90 segundos. Não há transcodificação; velocidade final depende da conexão e tamanho.
- Hub e resumo da Social usam os mesmos módulos e requisição compartilhada. Removidos os nomes dos provedores e o cartão de fonte da última leitura. Tokens Explosivos passa a mostrar o mesmo radar do Hub, em formato compacto.
- Baleias passa a consultar transferências Bitcoin confirmadas: maior saída >= 100 BTC, amostra de até 50 transações do bloco mais recente. Isso não identifica instituições, compras, beneficiários nem cobre todas as redes. Leitura parcial/antiga é sinalizada; nunca gera dados fictícios.

## Pagamentos

Implementada emissão Pix avulsa pelo Banco Inter com mTLS/OAuth, txid determinístico por pedido, consulta antes de criar, código Copia e Cola, validade e verificação do recebimento na tela de pagamento. Valor vem do catálogo no servidor. Confirmação exige txid, recebedor, valor, recibo end-to-end e horário coerentes. O banco confirma; o navegador não pode marcar pedido como pago.

A confirmação grava pagamento e pedido na mesma transação. Repetir a consulta não duplica baixa; reutilizar recibo em outro pedido é rejeitado. A função de confirmação é executável somente pelo servidor. Não há endpoint público de webhook sem validação.

**Ativação pendente:** não foi emitida nem paga cobrança real nesta revisão. O conector Vercel não disponibilizou acesso administrativo a este projeto; não foram alteradas variáveis existentes. Conferir as variáveis abaixo em Preview, branch `codex/social-r16-teste`, e fazer redeploy:

| Variável | Tipo | Conteúdo |
|---|---|---|
| `JENIOS_PAY_PROVIDER` | Config | `inter_pix` |
| `INTER_PIX_KEY` | Secret | Chave Pix da conta recebedora Inter |
| `INTER_CLIENT_ID` | Secret | Client ID da integração dessa conta |
| `INTER_CLIENT_SECRET` | Secret | Client secret da mesma integração |
| `INTER_CERTIFICATE` | Secret | Certificado PEM completo válido |
| `INTER_PRIVATE_KEY` | Secret | Chave privada PEM correspondente |

Se a integração atende múltiplas contas, configurar também `INTER_ACCOUNT_NUMBER` conforme o contrato da integração. Permissões OAuth usadas: `cob.read cob.write`. Não usar credencial de outra conta ou chave Supabase nesses campos. Nenhuma chave secreta deve usar prefixo `NEXT_PUBLIC_`.

O adaptador Pix aceita apenas produtos avulsos da Social. Planos recorrentes da Platform continuam no checkout separado. Especialistas/impulsionamento exigem a respectiva entrega habilitada antes de cobrar. Boleto, Pix Automático, reembolso automático, conciliação em segundo plano e webhook não foram implementados nesta revisão. A confirmação Pix ocorre enquanto a tela está aberta ou quando o comprador a reabre. O extrato oferece retomar essa tela.

## Evidência e limites

- 165 testes focados aprovados: Social, Direct, tendências, pagamentos e regressão do BankScore.
- PostgreSQL local: RLS, ocultação/remoção de publicação compartilhada, 24h exatas, usuário anônimo, privilégio de confirmação Pix, valor divergente, recibo duplicado e rollback atômico.
- Navegador local com contas sintéticas e respostas simuladas: publicação/perfil após recarga, seguir, Direct correto, compartilhar próprio/terceiro nos Stories, ida e volta do Hub sem recarga completa, vídeo real de 7 MB em dois blocos TUS e layout de 390 px sem transbordamento. Não é teste de velocidade em conexão móvel real.
- Página Pix: valor e código recebidos do servidor, consulta manual, remoção do código e link de entrega após confirmação simulada. Nenhum dado bancário real usado nos testes.
- Build de produção concluído. Consulta real de baleias retornou transferência confirmada em Bitcoin; indisponibilidade e amostragem continuam possíveis.
- Migrações aplicadas no projeto `jenios-social`: `20261015210633_social_feed_stories_r21` e `20261015212117_inter_pix_confirmation_r21`.
- O código de cálculo, dados, ranking e laudos do BankScore permaneceu inalterado nesta revisão. As alterações de pagamentos ficam na camada JENIOS PAY.

## Teste manual no novo preview

1. Publicar texto/vídeo, abrir Meu Perfil, recarregar e retornar de outro módulo.
2. Abrir perfil de outra conta, seguir e abrir Mensagens; conferir o destinatário.
3. Compartilhar post próprio e alheio nos Stories e abrir o original.
4. Comparar Hub completo com o resumo da Social; conferir data/cobertura de baleias.
5. Após configurar Inter e redeploy, iniciar uma compra avulsa, conferir recebedor/valor no app do banco, pagar e verificar a liberação. Não repetir o pagamento se a confirmação estiver demorando; reabrir o mesmo pedido.
