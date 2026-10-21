import FreeAssistantRoom from '../../components/assistant/FreeAssistantRoom';
export const metadata={title:'Atendimento e planos | JENIOS',description:'Gênio e Gênia: dúvidas, planos e suporte gratuito com IA quando configurada.'};
export default function Page(){
 return <main style={{minHeight:'100vh',background:'#edf2f7',padding:'30px 15px',color:'#172033'}}>
  <div style={{maxWidth:760,margin:'auto'}}><a href="/dashboard-logado">← Platform</a>
   <h1>Gênio e Gênia · Atendimento JENIOS</h1>
   <p>Fale sobre planos, serviços e utilização da plataforma. O atendimento comercial é gratuito e não concede acesso de negociação.</p>
   <FreeAssistantRoom/>
   <p>Para leitura avançada de gráficos e apoio analítico a operações, consulte os planos Global Crypto e Internacional Pro.</p>
   <a href="/checkout">Conhecer os planos →</a>
  </div></main>;
}