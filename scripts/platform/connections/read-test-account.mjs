/** Local operator utility. Supply TEST credentials through a secure process environment,
 * not command-line arguments or a file committed to git. No live mode exists.
 */
import {checkTestAccount} from '../../../lib/platform/connections/read-only-client.mjs';
const [provider,confirmation,...extra]=process.argv.slice(2);
if(extra.length||!['binance','alpaca'].includes(provider)||confirmation!=='--read-test-account-only'){
 console.error('Uso: node scripts/platform/connections/read-test-account.mjs binance|alpaca --read-test-account-only');process.exitCode=2;
}else{
 const prefix=provider==='binance'?'JENIOS_BINANCE_TESTNET':'JENIOS_ALPACA_PAPER';
 const result=await checkTestAccount({provider,environment:provider==='binance'?'testnet':'paper',confirmation:'READ_TEST_ACCOUNT_ONLY',apiKey:process.env[prefix+'_API_KEY'],secret:process.env[prefix+'_SECRET']});
 // Projection excludes credentials, signed URLs, account IDs and balances.
 console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}
