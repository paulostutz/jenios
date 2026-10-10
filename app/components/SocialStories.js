'use client';

import { useState } from 'react';

export default function SocialStories({
  meuPerfil,
  stories = [],
  onAdicionarStory,
}) {
  const [storyAberto, setStoryAberto] = useState(null);

  const storiesAtivos = stories.filter((story) => {
    if (!story.criadoEm) return false;

    const criado = new Date(story.criadoEm).getTime();
    const agora = Date.now();

    return agora - criado < 24 * 60 * 60 * 1000;
  });

  const abrirStory = (story) => {
    setStoryAberto(story);
  };

  const fecharStory = () => {
    setStoryAberto(null);
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
          <button
            type="button"
            onClick={onAdicionarStory}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              minWidth: '76px',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '62px',
                height: '62px',
                margin: '0 auto',
              }}
            >
              <img
                src={meuPerfil?.avatar}
                alt="Meu Story"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #7c3aed',
                }}
              />

              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '21px',
                  height: '21px',
                  borderRadius: '50%',
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  lineHeight: '21px',
                }}
              >
                +
              </span>
            </div>

            <span style={{ fontSize: '11px' }}>
              Seu Story
            </span>
          </button>

          {storiesAtivos.map((story) => (
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
