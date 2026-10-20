# JENIOS B161–B164 — associação demonstrativa e reconciliação

Data: 20/10/2026. Escopo exclusivo JENIOS.

## B161 — publicação preparada, não executada

O release do B160 foi documentado com origem, destino, validações e retorno ao B148. Produção não foi alterada.

## B162 — associação por usuário

Foi criado um contrato aditivo para associar uma leitura autenticada de conta demonstrativa a um único usuário da JENIOS Platform.

Regras:
- aceita somente Binance Spot Testnet e Alpaca Paper;
- exige leitura autenticada recente;
- exige referência externa previamente transformada em digest, sem expor o identificador bruto;
- mantém permissões, posições, ordens e proteção como não verificadas;
- não persiste credenciais e não cria rota pública;
- `associationConfirmed=true` não equivale a `connected=true`;
- execução real, custódia e envio de ordens permanecem falsos;
- outro usuário da Platform não pode reutilizar o vínculo.

## B163 — reconciliação conservadora

Foi criado um comparador de observações completas e autenticadas de ambiente demonstrativo.

Ele diferencia:
- posições adicionadas, alteradas e que deixaram de ser reportadas;
- ordens abertas adicionadas, alteradas e que deixaram de aparecer.

Uma ordem ausente não é classificada automaticamente como cancelada ou executada. Uma posição ausente não é classificada automaticamente como encerrada. Reconciliação não comprova performance nem proteção.

## B164 — CI e preservação

A CI da branch executa:
- verificação de que as mudanças desde B160 são somente aditivas e dentro do escopo;
- testes B162/B163;
- testes da fronteira de origem HTTP;
- regressão geral, regressão Social e build Next;
- navegador da Central de Integrações e Gênio/Gênia;
- preservação de Direct, impulsionamento, preferência de personagem, Pro e Universidade;
- arquivo público e checksums quando todo o job termina com sucesso.

## Limites do checkpoint

Nenhuma conta externa real ou demonstrativa foi autenticada neste checkpoint. Não existe formulário público de credenciais, OAuth operacional, DLL, EA ou sender de ordens novo. O leitor B158 original permanece byte a byte preservado. O B164 prepara associação e reconciliação para o próximo teste autenticado por canal protegido; não declara corretora conectada.

A próxima etapa operacional exige credencial Testnet/Paper fornecida exclusivamente por canal protegido e um leitor privado que gere a referência de conta necessária para o vínculo. Dinheiro real continua fora do escopo.
