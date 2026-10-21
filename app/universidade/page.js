import Link from 'next/link';
import UniversitySubscription from './UniversitySubscription';
import styles from './university.module.css';

export const metadata={title:'Universidade JENIOS · R$ 49,90 por mês',description:'Estude na Universidade JENIOS com contratação independente por R$ 49,90 mensais. Aulas, prática e revisões opcionais, sem precisar contratar um plano da Platform.'};

export default function UniversityPage(){
 return <main className={styles.page}><div className={styles.wrap}>
  <nav className={styles.top} aria-label="Navegação da Universidade"><Link href="/social">← JENIOS Social</Link><Link href="/platform/aprender">Minha sala de estudos →</Link></nav>
  <header className={styles.hero}>
   <div><p className={styles.eyebrow}>UNIVERSIDADE JENIOS</p><h1>Conhecimento para o seu próximo passo.</h1><p className={styles.lead}>Comece pelos fundamentos, pratique a leitura de gráficos e avance no seu ritmo. Sua jornada de estudos pode ser contratada sem nenhum plano da Platform.</p><div className={styles.actions}><a className={styles.primary} href="#contratar">Ver meu acesso</a><a className={styles.darkLink} href="#conteudo">Conhecer as trilhas ↓</a></div></div>
   <aside className={styles.priceCard} aria-label="Preço da Universidade"><span className={styles.tag}>CONTRATAÇÃO INDEPENDENTE</span><p className={styles.price}>R$ 49,90<span>por mês</span></p><p>Aulas, exercícios livres e revisões quando você desejar. Seu histórico de leitura permanece salvo.</p><p className={styles.priceNote}>Pagamento por Pix, com renovação mensal confirmada por você. Sem débito automático.</p></aside>
  </header>
  <UniversitySubscription/>
  <section className={styles.panel} id="conteudo" aria-labelledby="university-trails"><span className={styles.tag}>DO PRIMEIRO CONCEITO À PRÁTICA</span><h2 id="university-trails">Escolha livremente onde começar</h2><p>Não há nivelamento, prova ou etapa obrigatória. Escolha qualquer trilha, abra uma aula e estude no seu ritmo. Você pode mudar de assunto quando quiser.</p><ol className={styles.trails}>
   <li><span>01</span><div><h3>Fundamentos e segurança</h3><p>Conheça os conceitos do mercado e desenvolva uma base de gestão de risco.</p></div></li>
   <li><span>02</span><div><h3>Gráficos e contexto</h3><p>Estude como ler gráficos e diferenciar observação de suposição.</p></div></li>
   <li><span>03</span><div><h3>Execução e processo</h3><p>Entenda ordens, custos e disciplina antes de tomar decisões.</p></div></li>
   <li><span>04</span><div><h3>Estratégias e avaliação</h3><p>Compare abordagens, hipóteses e critérios para revisar resultados.</p></div></li>
   <li><span>05</span><div><h3>Laboratório Hard</h3><p>Aprofunde estatística, limitações de modelos e testes de estratégias.</p></div></li>
  </ol><p className={styles.small}>São 15 aulas na estrutura atual, abertas sem provas ou notas mínimas, com revisões opcionais. O conteúdo é educativo e não representa uma certificação profissional.</p></section>
  <section className={styles.infoGrid} aria-label="Como funciona a contratação">
   <article className={styles.panel}><h2>Já tem um plano da Platform?</h2><p>A Universidade está incluída nos planos de <strong>R$ 149,90 e R$ 199,90</strong>. Seu acesso será conferido antes de oferecer a contratação separada.</p><p>Com o plano de R$ 99,90 ou sem assinatura da Platform, você pode contratar somente a Universidade por R$ 49,90 mensais.</p></article>
   <article className={styles.panel}><h2>Seu estudo e os assistentes</h2><p>As explicações guiadas do T.Jenio fazem parte dos estudos. Gênio e Gênia gratuitos continuam disponíveis na Social.</p><p>A mensalidade independente da Universidade não inclui franquia ou créditos de IA Pro. Perguntas avançadas no Pro utilizam os créditos contratados à parte.</p><Link className={styles.textLink} href="/genios-pro">Conhecer Gênio e Gênia Pro →</Link></article>
  </section>
  <footer className={styles.footer}><p>Aprenda, revise e mantenha o seu processo. As aulas não enviam ordens e não prometem rentabilidade.</p><Link href="/social">Voltar à JENIOS Social</Link></footer>
 </div></main>;
}
