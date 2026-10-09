export const metadata = {
  title: 'JENIOS - Ecossistema HFT',
  description: 'Plataforma de alta frequência e gestão comportamental',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#090d16' }}>
        {children}
      </body>
    </html>
  );
}