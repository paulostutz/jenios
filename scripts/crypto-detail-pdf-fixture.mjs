// Synthetic layout fixture. Never a real user consultation or payment receipt.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { detailedCryptoReport } from '../lib/crypto/detailed.mjs';
import { createCryptoReportPdf } from '../lib/crypto/report-pdf.mjs';

const output = resolve(process.argv[2] || '/tmp/jenios-crypto-detail-layout.pdf');
const report = detailedCryptoReport({
  network: 'ethereum', networkLabel: 'Ethereum - AMOSTRA SINTÉTICA', type: 'token',
  identifier: '0x1111111111111111111111111111111111111111', supported: true, found: true,
  status: 'contrato encontrado - dados de teste', provider: 'Fixture local, sem consulta à rede',
  checkedAt: '2026-10-14T23:55:00Z', evidence: { tipoOnChain: 'contrato', bytecode: true, nomeDeclarado: 'Token sintético de QA', simboloDeclarado: 'USDT', casasDecimais: 6 },
  authenticity: { status: 'symbol_address_mismatch', label: 'Símbolo semelhante, mas endereço diferente da referência do emissor', registryCheckedAt: '2026-10-14' },
  disclaimer: 'AMOSTRA SINTÉTICA PARA INSPEÇÃO DE LAYOUT. NÃO É UM LAUDO REAL.',
}, '11111111-1111-4111-8111-111111111111');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, await createCryptoReportPdf(report));
console.log(output);
