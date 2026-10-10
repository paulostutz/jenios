'use client';

import { useEffect, useState } from 'react';

export default function SocialStories({
  meuPerfil,
  stories = [],
  onAdicionarStory,
  onExcluirStory,
}) {
  const [storyAberto, setStoryAberto] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(relogio);
  }, []);

  useEffect(() => {
    if (!storyAberto) return;
    const criado = new Date(storyAberto.criadoEm).getTime();
    if (!Number.isFinite(criado) || agora - criado >= 86400000) setStoryAberto(null);
  }, [agora, storyAberto]);

  useEffect(() => {
    if (!storyAberto) return;
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') setStoryAberto(null);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [storyAberto]);

  const storiesAtivos = stories.filter((story) => {
    if (!story.criadoEm) return false;

    const criado = new Date(story.criadoEm).getTime();
    return Number.isFinite(criado) && criado <= agora && agora - criado < 24 * 60 * 60 * 1000;
  });

  const abrirStory = (story) => {
    setStoryAberto(story);
  };

  const fecharStory = () => {
    setStoryAberto(null);
  };

  const navegarStory = (direcao) => {
    if (!storyAberto) return;
    const doMesmoAutor = storiesAtivos
      .filter(s => s.handle === storyAberto.handle)
      .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
    const indice = doMesmoAutor.findIndex(s => s.id === storyAberto.id);
    const proximo = doMesmoAutor[indice + direcao];
    if (proximo) setStoryAberto(proximo);
    else fecharStory();
  };

  return (
    <>
      <section
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            alignItems: 'center',
          }}
        >
          <div style={{minWidth:'76px',textAlign:'center'}}>
            <div style={{position:'relative',width:'62px',height:'62px',margin:'0 auto'}}>
              <button type="button" aria-label="Ver meus Stories" onClick={() => {
                const meus = storiesAtivos.filter(story => story.handle === meuPerfil?.handle);
                if (meus.length) abrirStory(meus[meus.length - 1]);
                else alert('Você ainda não publicou Stories. Use o botão + para adicionar.');
              }} style={{padding:0,border:'none',background:'transparent',cursor:'pointer',width:'100%',height:'100%'}}>
                <img src={meuPerfil?.avatar} alt="Meus Stories" style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover',border:storiesAtivos.some(story => story.handle === meuPerfil?.handle) ? '3px solid #7c3aed' : '2px solid #cbd5e1'}} />
              </button>
              <button type="button" aria-label="Adicionar Story" onClick={onAdicionarStory} style={{position:'absolute',bottom:'-3px',right:'-3px',width:'23px',height:'23px',borderRadius:'50%',border:'2px solid white',backgroundColor:'#7c3aed',color:'#fff',fontSize:'16px',fontWeight:700,cursor:'pointer',lineHeight:'18px'}}>+</button>
            </div>
            <span style={{fontSize:'11px'}}>Seu Story</span>
          </div>

          {storiesAtivos.filter(story => story.handle !== meuPerfil?.handle).map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => abrirStory(story)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                minWidth: '76px',
                textAlign: 'center',
              }}
            >
              <img
                src={story.avatar || meuPerfil?.avatar}
                alt={story.autor || 'Story'}
                style={{
                  width: '62px',
                  height: '62px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #7c3aed',
                  padding: '2px',
                }}
              />

              <div
                style={{
                  fontSize: '11px',
                  marginTop: '4px',
                }}
              >
                {story.handle || story.autor}
              </div>
            </button>
          ))}
        </div>
      </section>

      {storyAberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualizar Story"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50000,
            backgroundColor: 'rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <button
            type="button"
            onClick={fecharStory}
            aria-label="Fechar Story"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'transparent',
              color: '#fff',
              border: 'none',
              fontSize: '30px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>

          <button type="button" aria-label="Story anterior" onClick={() => navegarStory(-1)}
            style={{position:'absolute',left:'12px',top:'50%',zIndex:2,border:0,borderRadius:'50%',padding:'12px',background:'#374151',color:'white',cursor:'pointer'}}>❮</button>
          <button type="button" aria-label="Próximo Story" onClick={() => navegarStory(1)}
            style={{position:'absolute',right:'12px',top:'50%',zIndex:2,border:0,borderRadius:'50%',padding:'12px',background:'#374151',color:'white',cursor:'pointer'}}>❯</button>
          {storyAberto.handle === meuPerfil?.handle && typeof onExcluirStory === 'function' && (
            <button type="button" onClick={() => {
              if (window.confirm('Excluir este Story?')) {
                onExcluirStory(storyAberto.id);
                fecharStory();
              }
            }} style={{position:'absolute',top:'24px',left:'20px',border:'1px solid #64748b',borderRadius:'8px',padding:'8px 12px',background:'#111827',color:'white',cursor:'pointer'}}>Excluir meu Story</button>
          )}
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '90vh',
              overflow: 'hidden',
              borderRadius: '16px',
              backgroundColor: '#111827',
            }}
          >
            {storyAberto.tipo === 'video' ? (
              <video
                src={storyAberto.src}
                controls
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <img
                src={storyAberto.src}
                alt="Story"
                style={{
                  width: '100%',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                }}
              />
            )}

            <div
              style={{
                color: '#fff',
                padding: '12px',
                fontSize: '13px',
              }}
            >
              {storyAberto.autor}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
