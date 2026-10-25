export const metadata={title:'Suporte | JENIOS',description:'Ajuda para acessar JENIOS Social e Platform e entrar em contato com o suporte.'};
const faqs=[
 ['Como alternar entre Social e Platform?','No app, toque em Áreas. Na versão adicionada à tela inicial, use Áreas JENIOS. Cada área preserva suas verificações de acesso.'],
 ['Como entro na Platform?','Use a entrada da Platform. O acesso com sua conta Social segue as opções de simulação disponíveis; recursos de uma assinatura exigem a conta e o plano correspondentes.'],
 ['O saldo do simulador é dinheiro real?','Não. O saldo e as operações do simulador são fictícios e servem para aprendizado e prática. Não representam depósitos, saques ou ordens reais.'],
 ['Como instalar no celular?','Abra a página do app no Safari do iPhone ou no Chrome do Android e use Adicionar à Tela de Início ou Instalar app. Consulte a página de instalação para as versões de teste.'],
];
export default function SuportePage(){return <main style={{minHeight:'100vh',padding:'48px 20px',background:'#0e1120',color:'#f5f3ff',fontFamily:'system-ui',boxSizing:'border-box'}}><div style={{maxWidth:760,margin:'auto'}}>
 <a href="/mobile.html" style={{color:'#cdb7ff',display:'inline-block',padding:'12px 0'}}>← Áreas JENIOS</a>
 <h1>Como podemos ajudar?</h1><p style={{color:'#c8ccda',lineHeight:1.7}}>Para dúvidas sobre sua conta ou um problema de uso, entre em contato com o suporte.</p>
 <section style={{padding:24,border:'1px solid #59516c',borderRadius:20,margin:'28px 0'}}><h2>Fale com a JENIOS</h2>
 <p style={{lineHeight:1.7}}>Conte em qual área estava, o que tentou fazer e a mensagem que apareceu. Não envie senhas, códigos de acesso ou chaves privadas.</p>
 <a href="mailto:sac@jenios.com.br" style={{color:'#d7c3ff',fontWeight:700,display:'inline-block',padding:'12px 0'}}>sac@jenios.com.br</a>
 <p style={{fontSize:14,color:'#c8ccda',lineHeight:1.6}}>O link abre seu aplicativo de e-mail. Revise e envie a mensagem por lá. Se não abrir, copie o endereço e use o serviço de e-mail de sua preferência.</p></section>
 <h2>Dúvidas frequentes</h2>{faqs.map(([title,body])=><details key={title} style={{borderBottom:'1px solid #484251',padding:'18px 0'}}><summary style={{cursor:'pointer',fontWeight:600,minHeight:28}}>{title}</summary><p style={{lineHeight:1.7,color:'#c8ccda'}}>{body}</p></details>)}
 <p><a href="/mobile/downloads.html" style={{color:'#cdb7ff',display:'inline-block',padding:'12px 0'}}>Instalação e versões de teste →</a></p>
 </div></main>;}
