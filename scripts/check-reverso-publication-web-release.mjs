// Separate CLI leaves exact historical entrypoints inert.
import {verifyOwnerWebRelease} from './check-ultra-owner-web.mjs';
import {restoreReversoPredecessorObjects} from '../lib/release/reverso-predecessor-objects.mjs';
restoreReversoPredecessorObjects();
const result=verifyOwnerWebRelease();
if(result.reversoWebPublicationRelease!==true||result.webPublicationApproved!==true)throw Error('REVPUB001_WEB_SOURCE_NOT_FINALIZED');
console.log('REVPUB001_EXACT_WEB_SOURCE_PASS',result);
