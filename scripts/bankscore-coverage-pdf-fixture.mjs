import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { bankscoreCoverage } from '../lib/bankscore/coverage.mjs';
import { createReportPdf } from '../app/api/bankscore/laudo/pdf/route.js';
const row = { codigo_instituicao: '123', nome_instituicao: 'AMOSTRA SINTÉTICA - NÃO É LAUDO REAL', periodo: 202606, tipo_instituicao: 1, indice_basileia_bruto: .14, indice_basileia_percentual_provisorio: 14 };
const report = bankscoreCoverage(row, [row, { ...row, periodo: 202603 }], [], new Date('2026-10-15T00:00:00Z'));
const output = resolve(process.argv[2] || '/tmp/jenios-bankscore-cobertura-qa.pdf');
await mkdir(dirname(output), { recursive: true }); await writeFile(output, await createReportPdf(report)); console.log(output);
