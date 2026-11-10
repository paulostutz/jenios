# Ultra JENIOS / Flow — R127

**Candidata isolada. Testes com dados fictícios; sem publicação, ordens externas,
conta conectada ou homologação nativa.**

## Direção vigente

Cada cliente conecta a própria conta. Escopo: mini índice, mini dólar e cripto,
com futuros sujeitos à elegibilidade. Exchange Kivoryn fica para depois.
Documentos R125 sobre conta central são históricos, superados pelo pedido atual.
Credenciais ficam no ambiente do titular; não se solicita permissão de saque.

## Continuidade

Base publicada JENIOS R124: `d63f26ca9ddb9987f74cd62aabe0f42bc181ab63`.
A conferência final encontrou a R126 paralela (`02f547531d4e2353fa1c397d0a6cb2b8edb68b2c`),
que preserva R125/R118–R120 e acrescenta área de teste e ensaio local. Seus 11
hashes e todos os 1.398 arquivos de fonte foram conferidos antes de integrá-la.
Esta R127 preserva integralmente essa base, salvo a extensão aditiva do verificador.
O protocolo Profit R109 também foi recuperado byte a byte.

A Flow v32 (`ad8d10f27c6ca4cb8cd927a44a9a4c251e3dab60`) está salva, sem publicação;
v31 continua publicada. As cinco fontes compartilhadas de operação/relatório/plano
seguem idênticas. A adaptação da interface está descrita em
`R127-PARALLEL-RECONCILIATION.md`. Nenhum arquivo da Flow foi alterado.

## Entrega

- Runtime R127 envolve R118: permissão explícita, identidade/produto, instrumento
  habilitado, preço válido e reconciliação antes de abrir ou retomar. Preserva
  estratégias, dimensionamento, limites e cancelamento/redução existentes.
- Ledger atribuído usa o mesmo SQLite: origem, plataforma, sessão e estratégia
  ligadas à intenção antes do envio. Feed por revisão, conta, ambiente e moeda,
  com custos pendentes e evidência explícita. Sem atribuição retroativa de manuais.
- Journal Profit persiste sessão, LocalOrderID/ClOrderID e intenção. Aceite local
  não vira execução; detalhes sem preços/custos não viram resultado financeiro.
- Qualificação integrada: resposta perdida, restart sem reenvio, parciais,
  cancelamento do restante, encerramento e custos tardios em quatro cenários.

Os módulos novos são apenas `offline_fixture`; validação nativa, execução real,
demonstração externa e ativação financeira permanecem falsas. O feed novo é
recusado pelo leitor legado: o consumidor futuro deve preservar evidência e
fazer upsert por operação/revisão, sem somar snapshots. Não foi instalado nas
rotas ou telas publicadas. Não há alteração de cobrança, Start, performance,
assinatura ou acesso. Sessão/start não equivale a cada trade interno.

## Documentação e validação

Leia `R127-RUNTIME.md`, `R127-RECORDS-INTERFACE.md`, `R127-CONNECTORS.md` e
`R127-PARALLEL-RECONCILIATION.md` para
contratos, dependências, inventário de APIs e fontes oficiais. Node.js 24:

```sh
node --test tests/platformUltraR127Runtime.test.mjs tests/platformUltraR127Records.test.mjs tests/platformUltraR127Profit.test.mjs tests/platformUltraR127Integration.test.mjs
node scripts/platform/ultra/qualify-r127.mjs /caminho/para/diretorio-vazio
```

O script usa apenas fixtures fixas, sem rede, SDK ou segredos. FIXTUREUSDT,
WINZ99 e WDOZ99 são rótulos fictícios. O teste de inventário exige checkout Git.
O checkpoint final registra resultados e hashes; não soma baterias históricas.

Binance ainda exige transporte local, stream/proteções e conciliação nativos em
demonstração autorizada. Profit exige DLL oficial licenciada, tipos/manual da
mesma versão e Windows. Genial cripto não tem API adequada comprovada nesta
entrega; Binance é alternativa explícita. Disponibilizar conta/SDK não substitui
a implementação e validação restantes. Nenhuma garantia de lucro ou saída exata.
