export const metadata = {
  title: 'JENIOS - Ecossistema HFT',
  description: 'Plataforma de alta frequência e gestão comportamental',
};

export default function RootLayout({ children }) {
 return (
  <html lang="pt-BR">
   <head>
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
      .ticker-container { overflow: hidden; white-space: nowrap; width: 100%; }
      .ticker-track { display: inline-flex; animation: marquee 30s linear infinite; }
      .ticker-track:hover { animation-play-state: paused; }

      /* Responsividade Global para Telemóveis / Celular */
      @media (max-width: 768px) {
        div[style*="gridTemplateColumns"] {
          grid-template-columns: 1fr !important;
        }
        main {
          padding: 15px 10px !important;
        }
      }
    ` }} />
   </head>
   <body style={{ margin: 0, padding: 0, backgroundColor: '#090d16' }}>
    {children}
   </body>
  </html>
 );
}