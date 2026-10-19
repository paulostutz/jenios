# R45-B108 — research-only public candle receipt timestamps

Research-only Supabase project `xaicvhagftzjkqphnbgx` (jenios-platform-homologacao).
Migration `20261019211308_r45_b108_public_readonly_candle_receipt_research_only`.
Database function SHA256: `92706555cbca84c7bd83028bae71c31de49ae85f7a50accbc53880f2f41d3e56`.

Vercel read-only JENIOS market route fetched Coinbase Exchange candles and confirmed 3 complete 200-bar samples:
- BTC-USD, 5-minute interval;
- ETH-USD, 5-minute interval;
- BTC-USD, 1-minute interval.

Three database-stamped receipts are cryptographically hash-linked and contain only observations' SHA256 digests and metadata.
RLS is enabled. Anonymous/authenticated roles cannot read or execute the RPC; execute is restricted to service_role. Mutation of earlier rows is rejected.

**Important limits:** timestamps prove when the database received these payloads. Neither the Coinbase feed's authenticity nor the original robot's prospective decisions are independently attested. No finance activity was initiated. Original robot source and credentials remain outside GitHub.
Evidence and tests are saved in ChatGPT Library private checkpoint B108.
