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

      /* Responsividade Global Avançada para Telemóveis */
      @media (max-width: 768px) {
        /* Força todas as grelhas (grids) a passarem para 1 coluna */
        div[style*="gridTemplateColumns"], div[style*="grid-template-columns"] {
          grid-template-columns: 1fr !important;
        }
        
        /* Converte blocos lado a lado em layouts verticais */
        body, main {
          overflow-x: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 8px !important;
          box-sizing: border-box !important;
        }

        /* Ajusta barras de navegação ou painéis laterais no mobile */
        aside, div[style*="width: 2"], div[style*="minWidth"] {
          width: 100% !important;
          max-width: 100% !important;
        }
      }
    ` }} />
   </head>
   <body style={{ margin: 0, padding: 0, backgroundColor: '#090d16', overflowX: 'hidden' }}>
    {children}
   </body>
  </html>
 );
}