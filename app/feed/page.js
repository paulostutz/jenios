'use client';

export default function FeedPage() {
  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%' }}>
      
      <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cabeçalho / Navegação Rápida */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
            JENIOS SOCIAL • Feed Global
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ backgroundColor: '#7c3aed', color: '#ffffff', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer' }}>Seguindo</button>
            <button style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', fontSize: '11px', fontWeight: 'bold', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer' }}>Explorar</button>
          </div>
        </div>

        {/* Caixa de Criação de Post */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              PS
            </div>
            <textarea 
              rows="3" 
              placeholder="Partilhe uma análise, contexto de mercado ou visão de risco com a comunidade..." 
              style={{ width: '100%', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#0f172a', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            ></textarea>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>
              <button style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>📷 Imagem</button>
              <button style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>📊 Gráfico</button>
            </div>
            <button onClick={() => alert('Publicação enviada com sucesso para o feed!')} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '11px', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>
              Publicar
            </button>
          </div>
        </div>

        {/* Lista de Publicações do Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Post 1 */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#7e22ce', color: '#ffffff', fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  MC
                </div>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Marcos Costa</h4>
                  <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>@marcoscosta • Há 25 minutos</span>
                </div>
              </div>
              <span style={{ fontSize: '10px', backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>Day Trade</span>
            </div>
            <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5', margin: 0 }}>
              O robô da JENIOS acabou de salvar-me de um loss desnecessário na abertura do dólar. O Modo Reverso transformou uma operação emocional numa entrada técnica vencedora. Incrível! 🚀
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#64748b', padding: 0 }}>❤️ 28 Gostos</button>
              <button style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#64748b', padding: 0 }}>💬 6 Comentários</button>
              <button style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#64748b', padding: 0 }}>🔄 Partilhar</button>
            </div>
          </div>

          {/* Post 2 */}
          <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#1e293b', color: '#ffffff', fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  AL
                </div>
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Ana Lima</h4>
                  <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>@analima • Há 2 horas</span>
                </div>
              </div>
              <span style={{ fontSize: '10px', backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>Cripto 24/7</span>
            </div>
            <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5', margin: 0 }}>
              Alguém a monitorizar o fluxo de liquidações no Bitcoin nas últimas horas? O suporte em 62k está a segurar forte com ordens institucionais ocultas.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#64748b', padding: 0 }}>❤️ 45 Gostos</button>
              <button style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#64748b', padding: 0 }}>💬 14 Comentários</button>
              <button style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#64748b', padding: 0 }}>🔄 Partilhar</button>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}