/** Only application-owned destinations are accepted by the shared login form. */
export function socialAuthReturnPath(value){
 return value==='/universidade'?'/universidade':'/social';
}
