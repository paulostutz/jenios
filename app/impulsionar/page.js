'use client';

export default function ImpulsionarPostPage() {
  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      <div style={{ maxWidth: '650px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Cartão de Impulsionamento Profissional */}
        <div style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
          
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                JENIOS ADS • Gestor de Anúncios
              </span>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Impulsionar Publicação</h1>
            </div>
            <span style={{ fontSize: '10px', backgroundColor: '#f3e8ff', color: '#7c3aed', fontWeight: 'bold', padding: '6px 12px', borderRadius: '9999px', textTransform: 'uppercase' }}>
              Pro Mode
            </span>
          </div>

          {/* 1. Selecionar o Post do Perfil */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Publicação do Perfil a Impulsionar</label>
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#334155', fontWeight: '500', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📊 Análise de Fluxo Institucional - Mini-Índice (WIN)</span>
              <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 'bold', cursor: 'pointer' }}>Trocar post</span>
            </div>
          </div>

          {/* 2. Escolher o Objetivo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Qual é o objetivo da campanha?</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              <div style={{ border: '2px solid #7c3aed', backgroundColor: '#faf5ff', borderRadius: '12px', padding: '12px', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '2px' }}>⚡ Cliques para Copiar</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Direciona para o espelhamento</span>
              </div>
              <div style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '12px', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '2px' }}>🌐 Redirecionar para Site</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Leva tráfego para link externo</span>
              </div>
              <div style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '12px', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '2px' }}>💬 Chamar no WhatsApp</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Inicia conversa direta</span>
              </div>
              <div style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '12px', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', display: 'block', marginBottom: '2px' }}>👤 Visitas ao Perfil / Alcance</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Foco em autoridade e seguidores</span>
              </div>
            </div>
          </div>

          {/* 3. Segmentação Geográfica */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxSizing: 'border-box' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b' }}>📍 Segmentação Geográfica</label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>País (Comece a digitar)</span>
                <input type="text" list="lista-paises" defaultValue="Brasil" style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                <datalist id="lista-paises">
                  <option value="Brasil" />
                  <option value="Portugal" />
                  <option value="Estados Unidos" />
                  <option value="Espanha" />
                  <option value="Reino Unido" />
                  <option value="França" />
                  <option value="Alemanha" />
                  <option value="Argentina" />
                  <option value="Canadá" />
                  <option value="Japão" />
                </datalist>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Estado / Região</span>
                <input type="text" placeholder="Ex: São Paulo, Bahia..." style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Cidade</span>
                <input type="text" placeholder="Ex: Salvador, Rio..." style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          {/* 4. Perfil Demográfico */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxSizing: 'border-box' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b' }}>👥 Perfil Demográfico</label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Faixa Etária</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" defaultValue="21" min="18" max="80" style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#0f172a', textAlign: 'center', outline: 'none' }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>até</span>
                  <input type="number" defaultValue="60" min="18" max="80" style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#0f172a', textAlign: 'center', outline: 'none' }} />
                </div>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Gênero / Público</span>
                <select style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#0f172a', outline: 'none' }}>
                  <option>Todos os Gêneros</option>
                  <option>Masculino</option>
                  <option>Feminino</option>
                  <option>LGBTQIA+ / Diversidade</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. Orçamento Diário e Duração Manual */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Orçamento Diário (Mín. R$ 10,00)</label>
              <input type="number" min="10" step="1.00" defaultValue="25.00" style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#0f172a', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}>Duração (Nº de Dias)</label>
              <input type="number" min="1" defaultValue="7" style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#0f172a', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Resumo e Pagamento */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#64748b' }}>Investimento Total Estimado:</span>
              <span style={{ fontWeight: '900', fontSize: '18px', color: '#7c3aed' }}>R$ 175,00 <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>(7 dias x R$ 25,00)</span></span>
            </div>

            <button 
              onClick={() => alert('Campanha configurada com sucesso! A gerar Pix para pagamento do anúncio...')} 
              style={{ width: '100%', backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.3)' }}
            >
              🚀 Lançar Anúncio (Gerar Pix)
            </button>
          </div>

        </div>

      </div>
    </main>
  );
}