/** Interactive operator tool; broker keys never enter argv, env, files or console output. */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runR110BinancePreflight} from '../../../lib/platform/connections/binance-real-preflight-r110.mjs';

const MESSAGES = Object.freeze({
  R110_INVALID_REQUEST: 'Dados de teste inválidos.',
  R110_INVALID_CREDENTIALS: 'Confira o formato da API Key e da Secret Key HMAC.',
  R110_CONSENT_REQUIRED: 'A consulta precisa da confirmação do titular.',
  R110_ACCOUNT_MISMATCH: 'O UID da conta retornada não corresponde ao UID informado.',
  R110_ACCOUNT_ID_UNVERIFIED: 'Não foi possível conferir o UID da conta.',
  R110_API_KEY_REJECTED: 'A Binance recusou a chave.',
  R110_API_KEY_OR_IP_REJECTED: 'Confira na Binance a chave, suas permissões e o IP autorizado.',
  R110_EXCESSIVE_KEY_PERMISSIONS: 'Use uma chave dedicada sem saques, transferências, margem, futuros ou outras permissões adicionais.',
  R110_PERMISSIONS_UNVERIFIED: 'A Binance não confirmou todos os campos de permissão necessários.',
  R110_UNKNOWN_KEY_PERMISSION: 'Há uma permissão ainda não reconhecida pelo verificador.',
  R110_READ_PERMISSION_REQUIRED: 'A chave precisa permitir leitura.',
  R110_ORDER_TEST_PERMISSION_REQUIRED: 'A consulta foi possível, mas a conta/chave não permite o teste de ordem. A negociação JENIOS continua desativada.',
  R110_IP_RESTRICTION_REQUIRED: 'Para validar uma ordem, a chave dedicada precisa restringir o acesso ao IP deste computador.',
  R110_EXISTING_ORDERS_REQUIRE_REVIEW: 'Há ordens abertas. Confira-as no painel Binance; este programa não cancela nem altera ordens.',
  R110_REGION_RESTRICTED: 'A Binance restringiu o acesso desta região. Consulte o fornecedor; não use VPN ou outro endereço para contornar.',
  R110_PROVIDER_FORBIDDEN: 'A Binance bloqueou o acesso. Confira as condições com o fornecedor.',
  R110_RATE_LIMITED: 'A Binance aplicou um limite de consultas. Aguarde o prazo informado pelo fornecedor.',
  R110_NETWORK_UNAVAILABLE: 'Não foi possível consultar a Binance por esta conexão.',
  R110_PROVIDER_TIMEOUT: 'A consulta excedeu o tempo permitido. Não houve reenvio automático.',
  R110_CLOCK_UNVERIFIED: 'Confira o relógio e a conexão do computador.',
  R110_PROVIDER_CLOCK_REJECTED: 'A Binance recusou o horário da assinatura.',
  R110_SIGNATURE_REJECTED: 'A Binance recusou a assinatura; confira o par de chaves.',
  R110_INSUFFICIENT_SPOT_BALANCE: 'O saldo Spot disponível não cobre os parâmetros. Venda em Spot exige possuir o ativo.',
  R110_PRICE_FILTER: 'O preço não atende aos limites ou ao incremento do ativo.',
  R110_QUANTITY_FILTER: 'A quantidade não atende ao lote ou aos limites do ativo.',
  R110_NOTIONAL_FILTER: 'O valor da ordem não atende aos limites do ativo.',
  R110_SYMBOL_UNVERIFIED: 'O ativo não foi confirmado como disponível para esta operação Spot.',
  R110_FILTERS_UNVERIFIED: 'Os filtros do ativo não foram confirmados.',
  R110_INVALID_DECIMAL: 'Informe preço e quantidade positivos, com ponto decimal.',
  R110_UNSUPPORTED_TEST_ORDER: 'Este verificador aceita apenas uma ordem limitada Spot.',
  R110_PROVIDER_FILTER_REJECTED: 'A Binance rejeitou os parâmetros nos filtros do teste.',
  R110_PROVIDER_ORDER_TEST_REJECTED: 'A Binance rejeitou o teste. Confira saldo, permissões e parâmetros no fornecedor.',
  R110_ORDER_TEST_UNVERIFIED: 'O retorno não corresponde ao teste sem negociação esperado.',
  R110_CANCELLED: 'Teste interrompido pelo operador.',
  R110_INPUT_TIMEOUT: 'Entrada expirada; execute novamente quando estiver pronto.',
  R110_TTY_REQUIRED: 'Execute no Terminal do seu computador. Não passe chaves por argumentos, arquivos ou pipes.',
  R110_NODE_REQUIRED: 'Este verificador requer Node.js 22 ou superior.'
});
const error = code => Object.assign(new Error(code), {code});
export function r110SafeFailure(e) {
  const known = Object.hasOwn(MESSAGES, e?.code || '');
  return {ok: false, code: known ? e.code : 'R110_CHECK_UNCONFIRMED',
    message: known ? MESSAGES[e.code] : 'Não foi possível confirmar a verificação. Nenhuma ordem real foi enviada.',
    ...(e?.code === 'R110_RATE_LIMITED' && Number.isSafeInteger(e.retryAfterSeconds) && e.retryAfterSeconds > 0 && e.retryAfterSeconds <= 86400 ? {retryAfterSeconds: e.retryAfterSeconds} : {}),
    realOrdersSent: 0, retryAutomatic: false};
}

/** One line in raw TTY mode, including pasted text and backspace; hidden values are never echoed. */
export function r110Prompt(label, {secret = false, maxLength = 256, stdin = process.stdin,
  stdout = process.stdout, timeoutMs = 300000} = {}) {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') return Promise.reject(error('R110_TTY_REQUIRED'));
  return new Promise((resolveAnswer, reject) => {
    let value = '', done = false;
    const wasRaw = stdin.isRaw === true;
    stdout.write(label);
    const cleanup = () => {
      clearTimeout(timer); stdin.removeListener('data', data); stdin.removeListener('end', end);
      stdin.removeListener('error', failed); stdin.setRawMode(wasRaw); stdin.pause();
    };
    const finish = (e, answer) => {
      if (done) return; done = true; cleanup(); stdout.write('\n');
      value = ''; if (e) reject(e); else resolveAnswer(answer);
    };
    const end = () => finish(error('R110_CANCELLED'));
    const failed = () => finish(error('R110_CANCELLED'));
    const data = chunk => {
      // Raw mode receives bytes; credentials and identifiers are ASCII.
      const text = chunk.toString('utf8');
      if (/[\x1b\x00]/.test(text)) { finish(error('R110_INVALID_REQUEST')); return; }
      for (const char of text) {
        if (char === '\x03' || char === '\x04') { finish(error('R110_CANCELLED')); return; }
        if (char === '\r' || char === '\n') { finish(null, value); return; }
        if (char === '\x7f' || char === '\b') {
          if (value.length) { value = value.slice(0, -1); if (!secret) stdout.write('\b \b'); }
        } else if (char >= ' ' && char <= '~') {
          if (value.length >= maxLength) { finish(error('R110_INVALID_REQUEST')); return; }
          value += char; if (!secret) stdout.write(char);
        } else { finish(error('R110_INVALID_REQUEST')); return; }
      }
    };
    const timer = setTimeout(() => finish(error('R110_INPUT_TIMEOUT')), timeoutMs);
    stdin.setRawMode(true); stdin.on('data', data); stdin.once('end', end); stdin.once('error', failed); stdin.resume();
  });
}

export async function runR110Interactive({ask = r110Prompt, output = text => process.stdout.write(text),
  runner = runR110BinancePreflight} = {}) {
  output('JENIOS — verificação Binance Spot em conta real\n' +
    'Este programa consulta sua conta. O teste opcional de ordem não envia a ordem para negociação.\n' +
    'As chaves ficam apenas na memória deste processo e são enviadas somente à Binance.\n' +
    'Nenhum robô é ativado, e nenhum saldo é movimentado.\n\n');
  const confirmation = await ask('Digite CONFERIR para começar: ', {maxLength: 10});
  if (confirmation !== 'CONFERIR') throw error('R110_CONSENT_REQUIRED');
  const expectedAccountUid = await ask('UID da sua conta Binance (confira no painel oficial): ', {maxLength: 20});
  const selection = await ask('1 = consultar conta e permissões; 2 = também validar uma ordem sem negociar: ', {maxLength: 1});
  if (!['1', '2'].includes(selection)) throw error('R110_INVALID_REQUEST');
  let order;
  if (selection === '2') {
    order = {symbol: await ask('Símbolo Spot que você quer conferir: ', {maxLength: 40}),
      side: await ask('Lado final BUY ou SELL: ', {maxLength: 4}), type: 'LIMIT',
      quantity: await ask('Quantidade para validação (ponto decimal): ', {maxLength: 39}),
      price: await ask('Preço limite para validação (ponto decimal): ', {maxLength: 39})};
  }
  const credentials = {apiKey: await ask('API Key HMAC (oculta): ', {secret: true}),
    secret: await ask('Secret Key HMAC (oculta): ', {secret: true})};
  try {
    const result = await runner({credentials, expectedAccountUid,
      consent: 'CHECK_MY_BINANCE_REAL_ACCOUNT_WITHOUT_TRADING', action: selection === '1' ? 'inspect' : 'validate_order',
      ...(order ? {order} : {})});
    output('\n' + JSON.stringify({ok: true, result}, null, 2) + '\n');
    output('Verificação concluída. Isto não certifica a execução dos robôs, stops ou recuperação de posições.\n');
    return result;
  } finally { credentials.apiKey = ''; credentials.secret = ''; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw error('R110_TTY_REQUIRED');
    if (Number(process.versions.node.split('.')[0]) < 22) throw error('R110_NODE_REQUIRED');
    await runR110Interactive();
  } catch (e) {
    process.stderr.write(JSON.stringify(r110SafeFailure(e)) + '\n'); process.exitCode = 1;
  }
}
