import {PaperLedger} from '../../../lib/platform/pilot-prep/paper-ledger.mjs';
const [path,json]=process.argv.slice(2),{session,connection,input}=JSON.parse(json);
const db=new PaperLedger(path);try{db.reserve(session,connection,input);console.log(JSON.stringify({reserved:true}));}catch(e){if(e.code!=='AGGREGATE_RISK_LIMIT')throw e;console.log(JSON.stringify({reserved:false,reason:e.code}));}finally{db.close();}
