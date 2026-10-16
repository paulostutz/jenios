import {getCachedJeniosTrends} from './jeniosTrends.mjs';
import {getMegaPulse} from './megapulse.mjs';
import {getWhaleTransfers} from './whale-transfers.mjs';
import {createWhaleHistory} from './whale-history.mjs';
export async function loadTrends(db){
 const [data,mega,whales]=await Promise.all([getCachedJeniosTrends(),getMegaPulse(),getWhaleTransfers({history:db?createWhaleHistory(db):undefined})]);
 return {...data,baleias:whales.rows,megapulse:mega.rows,modulos:{...data.modulos,baleias:whales.status,megapulse:mega.status}};
}
