import Image from 'next/image';
import styles from './BrandSignature.module.css';

/** B110: one lightweight JENIOS logo system, without API or user state. */
export const BRAND_ASSETS=Object.freeze({
 icon:'/brand/jenios-j.webp',
 horizontal:'/brand/jenios-logo-horizontal.webp'
});
export function BrandMark({size=42,className='',decorative=false}){
 const width=Math.max(20,Math.min(80,Number(size)||42));
 return <Image src={BRAND_ASSETS.icon} width={width} height={width} unoptimized
  className={className||styles.mark} alt={decorative?'':'JENIOS — símbolo J'}
  aria-hidden={decorative?true:undefined}/>;
}
export function BrandLockup({tone='light',context='',compact=false,priority=false}){
 const dark=tone==='dark';
 return <span className={styles.lockup+' '+(dark?styles.dark:styles.light)}
   aria-label={context?'JENIOS '+context:'JENIOS'}>
  {dark||compact?<>
    <BrandMark size={compact?36:42} decorative/>
    <span className={styles.wordmark}>JENIOS{context&&<small>{context}</small>}</span>
   </>:<>
    <Image src={BRAND_ASSETS.horizontal} alt="JENIOS" width={195} height={64}
      unoptimized priority={priority} className={styles.horizontal}/>
    {context&&<span className={styles.context}>{context}</span>}
   </>}
 </span>;
}
export function BrandFooter({tone='light',scope='Ecossistema'}){
 const dark=tone==='dark';
 return <footer className={styles.footer+' '+(dark?styles.dark:styles.light)}
   aria-label={'Rodapé institucional JENIOS '+scope}>
  <span className={styles.footerLine}><BrandMark size={29} decorative/>
   <span className={styles.footerWordmark}>JENIOS</span>
   <span className={styles.scope}>{scope}</span>
  </span>
  <small>© JENIOS · Todos os direitos reservados.</small>
 </footer>;
}
