/** Reviewed public guidance, shared by provider metadata, UI and both assistants.
 * Describes prerequisites; it never authenticates a customer or grants access.
 */
export const CONNECTION_ACCOUNT_MODEL = Object.freeze({
 id:'connection-account-model', title:'Seu dinheiro e a autorização da corretora', href:'/integracoes',
 text:'O dinheiro para negociar fica na conta do cliente na própria corretora. A JENIOS fornece os robôs e a integração autorizada; não recebe depósito de saldo para negociação e não solicita permissão de saque. O pagamento de uma assinatura JENIOS é separado do saldo da corretora. Os 7 dias grátis da assinatura não autenticam uma conta, não concedem permissões e não eliminam o risco de perdas ao usar dinheiro real. Conta demo/Paper usa saldo simulado. Para operar, é necessário confirmar conta e ambiente, conceder as permissões mínimas no canal seguro do fornecedor, concluir a validação do conector e aprovar os limites do robô. Nenhuma dessas ações é realizada por esta conversa.'
});
const base={reviewedAt:'2026-10-28',customerFundsLocation:'customer_broker_account',
 custody:false,withdrawalsRequested:false,chatAcceptsCredentials:false,
 authorizationFlowAvailable:false,liveExecutionAvailable:false,
 activation:'Autenticação, permissão de negociação e ativação do robô são etapas distintas. Conferir conta e ambiente, validar o conector e aprovar limites de risco antes de qualquer ativação humana.',
 trial:'Os 7 dias grátis da assinatura não substituem autorização nem homologação. Operações reais continuam sujeitas a perdas.',
 credentialChannel:'Credenciais somente no canal oficial ou formulário protegido liberado para o conector. Nunca no chat dos gênios, em prints ou mensagens.',
};
const profit={
 method:'Terminal Profit / licença ProfitDLL',
 customer:'Confirmar conta na corretora, acesso ao Profit e habilitação de roteamento aplicável à conta. Manter credenciais no ambiente oficial autorizado.',
 jenios:'Validar licença comercial e conector externo ProfitDLL para Windows com Nelogica e corretora. A automação NTSL interna não instala o conector JENIOS.',
 readPermission:'A inicialização de dados de mercado é distinta da inicialização de roteamento.',
 tradePermission:'Acesso a cotações não habilita ordens: o canal de roteamento, a conta e a licença precisam ser validados separadamente.',
 pending:'Conector ProfitDLL JENIOS ainda não instalado ou homologado; não há autorização de negociação nesta tela.'
};
const definitions={
 binance:{
  method:'API individual, com chave de cada ambiente',
  customer:'Usar conta elegível no próprio nome e escolher Spot Testnet ou Spot real. O ensaio disponível utiliza apenas Testnet; não inserir uma chave real nele.',
  jenios:'Disponibilizar recebimento seguro, conferir permissões e restrições de IP aplicáveis e homologar o conector no ambiente escolhido.',
  readPermission:'Consulta de conta exige as permissões de leitura aplicáveis; uma resposta de saldo não comprova autorização para operar.',
  tradePermission:'Negociação Spot exige permissão de negociação própria. Não solicitar saques, transferências, margem ou futuros para operar Spot; IPs somente quando publicados e verificados pela JENIOS.',
  pending:'Leitor privado Testnet implementado; autenticação externa e homologação pendentes. Conector de ordens reais não liberado.'
 },
 profit,
 ...Object.fromEntries([['genial','Genial'],['clear','Clear'],['xp','XP'],['btg','BTG']].map(([id,name])=>[id,{...profit,
  customer:'Confirmar na '+name+' a conta e a disponibilidade do canal Profit/Nelogica, inclusive para roteamento externo. Não presumir que a licença individual autoriza uma aplicação comercial.',
  method:name+' pelo canal Profit / ProfitDLL',
  pending:'Conector JENIOS via Profit ainda não homologado para esta conta. Não há API própria de '+name+' presumida nem conexão automática por selecionar o nome da corretora.'
 }])),
 mt5:{
  method:'Terminal MetaTrader 5 e componente Expert Advisor',
  customer:'Entrar no terminal oficial da corretora, conferir conta, servidor e ambiente demo/real. Credenciais ficam no terminal, fora do atendimento.',
  jenios:'Entregar componente JENIOS verificado e validar a comunicação com o terminal. Não há instalador JENIOS disponível neste guia.',
  readPermission:'Começar em demonstração com negociação desativada. Instalar um EA não confirma conexão com o painel.',
  tradePermission:'O terminal e cada EA têm controles de negociação automática. DLL e WebRequest são permissões diferentes e exigem necessidade e destino verificados.',
  pending:'Ponte JENIOS/MT5 ainda não instalada ou homologada; nenhuma operação pode ser confirmada pelo guia.'
 },
 ctrader:{
  method:'OAuth da aplicação cTrader Open API',
  customer:'Quando o fluxo estiver liberado, autenticar-se no domínio oficial cTrader e selecionar as contas elegíveis vinculadas ao cTID. Não fornecer senha ou tokens aos gênios.',
  jenios:'Cadastrar e obter aprovação da aplicação, configurar retorno OAuth e manter as credenciais da aplicação no servidor privado. O cliente não cadastra a aplicação JENIOS.',
  readPermission:'O escopo accounts permite leitura das contas autorizadas.',
  tradePermission:'O escopo trading permite operações de negociação; concedê-lo não ativa automaticamente um robô JENIOS. Contas demo e reais são separadas.',
  pending:'OAuth público JENIOS ainda não conectado; aprovação, callback e testes do conector pendentes.'
 },
 ibkr:{
  method:'TWS / IB Gateway ou aplicação Web API autorizada',
  customer:'Confirmar conta elegível, ambiente Paper/Live e permissões dos mercados. No caminho de terminal, autenticar-se na TWS/IB Gateway oficial.',
  jenios:'Definir e homologar o canal. Aplicação Web API para terceiros depende do processo de aprovação do fornecedor; não presumir que um login individual atende uso comercial.',
  readPermission:'No caminho TWS, iniciar com Read-Only e conexões restritas. Permissão de dados não é permissão de negociação.',
  tradePermission:'Negociação depende do canal autorizado e das permissões da conta. Não expor porta do terminal à internet nem trocar Paper por Live para corrigir falhas.',
  pending:'Conector JENIOS ainda não disponibilizado ou homologado para clientes.'
 },
 alpaca:{
  method:'Paper com chaves específicas; contas reais de clientes via Alpaca Connect OAuth',
  customer:'Manter sua própria conta na Alpaca. Quando o fluxo estiver disponível, entrar no domínio oficial da Alpaca, conferir conta Live e consentir ao acesso da JENIOS. Não enviar chaves Live, senha ou código OAuth no chat.',
  jenios:'Registrar a aplicação Alpaca Connect, obter aprovação para contas reais de outros clientes e configurar o retorno OAuth protegido. Client ID e Client Secret da aplicação são responsabilidade da JENIOS.',
  readPermission:'No OAuth, leitura é o acesso padrão. O leitor Paper usa credenciais e destino Paper separados de Live.',
  tradePermission:'O escopo trading autoriza criar, alterar e cancelar ordens na corretora. O fluxo preparado solicita esse escopo sem account:write ou data; mesmo assim, o robô permanece desativado até aprovação e validação separadas. Não há solicitação de saque.',
  pending:'Núcleo privado de autorização em preparação; botão e retorno OAuth público ainda não liberados. Aprovação externa e homologação com conta autorizada continuam pendentes.'
 },
 'mercado-bitcoin':{
  method:'API individual do Mercado Bitcoin',
  customer:'Confirmar conta, proteção de acesso e credenciais emitidas na área oficial de API. Não gerar credenciais apenas para preencher este guia.',
  jenios:'Homologar autenticação, identificação da conta e permissões usando a documentação vigente antes de receber credenciais.',
  readPermission:'Conferir no fornecedor quais permissões permitem consulta de conta e ordens; não presumir um escopo ou opção de leitura que não foi validado.',
  tradePermission:'Permissão de negociação deve ser verificada separadamente. Não conceder saques ou transferências para suprir falhas de autenticação.',
  pending:'Conector autenticado ainda não instalado; nomes e disponibilidade das permissões precisam ser confirmados no canal oficial.'
 },
 kraken:{
  method:'Chave de API individual; Spot separado de Derivatives',
  customer:'Escolher a API e a conta corretas na Kraken. Manter chave e segredo fora do chat e restringir o acesso ao necessário.',
  jenios:'Implementar e homologar autenticação, assinatura e permissões do conector específico. Uma integração Spot não habilita Derivatives.',
  readPermission:'Na API Spot, query-funds consulta saldo; query-open-trades e query-closed-trades cobrem consultas de ordens e negociações.',
  tradePermission:'Na API Spot, modify-trades permite criar/alterar ordens; close-trades permite cancelar/fechar conforme a API. Não solicitar withdraw-funds nem gerenciamento de endereços de saque.',
  pending:'Conector autenticado JENIOS ainda não instalado ou homologado; o guia não recebeu acesso à conta.'
 }
};
export function authenticationFor(provider){
 const specific=definitions[provider];
 if(!specific)throw Error('UNKNOWN_AUTHENTICATION_GUIDE');
 return Object.freeze({...base,...specific});
}
export function authenticationGuideText(auth){
 return ['Autenticação: '+auth.method,'Você precisa: '+auth.customer,'A JENIOS precisa: '+auth.jenios,
  'Consulta: '+auth.readPermission,'Negociação: '+auth.tradePermission,'Situação atual: '+auth.pending,
  auth.activation,auth.credentialChannel,CONNECTION_ACCOUNT_MODEL.text].join('\n\n');
}
