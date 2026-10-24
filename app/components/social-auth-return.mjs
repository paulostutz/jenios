/** Only application-owned destinations are accepted by the shared login form. */
export function socialAuthReturnPath(value){
 const allowed=['/social','/universidade','/dashboard-logado','/dashboard','/mesa-operacoes',
  '/diagnostico','/platform/aprender','/platform/assistente','/integracoes','/admin/consultas','/tendencias'];
 return allowed.includes(value)?value:'/social';
}
