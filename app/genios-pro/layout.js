import Link from 'next/link';
export default function GeniosProLayout({children}){return <><nav aria-label="Ajuda gratuita de conexões" style={{background:'#f5f3ff',padding:'12px 20px',fontFamily:'system-ui',fontSize:13,textAlign:'center'}}><Link href="/integracoes" style={{color:'#5b21b6'}}>Conexões com corretoras: passo a passo gratuito com Gênio e Gênia →</Link></nav>{children}</>;}
