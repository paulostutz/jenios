# B293 — Gate de prontidão para evidências autênticas dos motores

Base B292 candidata `9d7334128ff81a730d4bfe28623850f6c63c172c`. O B293 prepara um validador estrito de lotes declarados de sinais das três modalidades, com hash de integridade, timestamps e rejeição de alterações posteriores. **Não é o exportador do núcleo proprietário.**

A função apenas verifica estrutura de eventos fornecidos, com origem não atestada; por isso retorna `realSignalEmissionVerified:false`, `executableBytesVerified:false` e `deliveryVerified:false` mesmo em sucesso. Para demonstrar que os motores funcionam é indispensável rodar um coletor autorizado de eventos genuínos em ambiente privado, validar identidade do executável, cadeia de timestamps, decisões, delivery ack e controles B152.

Nenhuma credencial, corretora, execução, cobrança, cron ou deploy é introduzida. Não usar os resultados sintéticos como material de vendas.
