'use client';

import { useEffect, useRef, useState } from 'react';

export default function SocialPostCard({
  post,
  meuPerfil,
  indiceCarrossel = 0,
  onMudarFoto,
  onCurtir,
  onRepostar,
  onCompartilhar,
  onVisitarPerfil,
  onAtualizarPost,
  onExcluirPost,
  extrairEmbedYoutube,
}) {
  const [comentariosAbertos, setComentariosAbertos] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [respondendoId, setRespondendoId] = useState(null);
  const [textoResposta, setTextoResposta] = useState('');
  const [textoExpandido, setTextoExpandido] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  const cardRef = useRef(null);
  const visualizacaoRegistrada = useRef(false);

  const comentarios = Array.isArray(post.comentarios)
    ? post.comentarios
    : [];

  const salvo = Boolean(post.salvo);

  const embedYoutubeUrl =
    typeof extrairEmbedYoutube === 'function'
      ? extrairEmbedYoutube(post.youtubeUrl)
      : '';

  const temVariasFotos =
    Array.isArray(post.imagens) && post.imagens.length > 1;

  const souAutor =
    meuPerfil?.handle &&
    post?.handle &&
    meuPerfil.handle === post.handle;

  const textoLongo =
    typeof post.texto === 'string' && post.texto.length > 240;

  const textoExibido =
    textoLongo && !textoExpandido
      ? `${post.texto.slice(0, 240)}...`
      : post.texto;

  function gerarId() {
    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  function atualizarPost(alteracoes) {
    if (typeof onAtualizarPost !== 'function') return;

    onAtualizarPost(post.id, {
      ...alteracoes,
    });
  }

  function contarComentarios() {
    return comentarios.reduce((total, comentario) => {
      const respostas = Array.isArray(comentario.respostas)
        ? comentario.respostas.length
        : 0;

      return total + 1 + respostas;
    }, 0);
  }

  function publicarComentario(e) {
    e.preventDefault();

    const texto = novoComentario.trim();

    if (!texto) return;

    const comentario = {
      id: gerarId(),
      autor: meuPerfil?.nome || 'Usuário JENIOS',
      handle: meuPerfil?.handle || '@usuario',
      avatar: meuPerfil?.avatar || '',
      texto,
      criadoEm: new Date().toISOString(),
      likes: 0,
      curtido: false,
      respostas: [],
    };

    atualizarPost({
      comentarios: [...comentarios, comentario],
    });

    setNovoComentario('');
    setComentariosAbertos(true);
  }

  function curtirComentario(comentarioId) {
    const novosComentarios = comentarios.map((comentario) => {
      if (comentario.id !== comentarioId) {
        return comentario;
      }

      const jaCurtiu = Boolean(comentario.curtido);

      return {
        ...comentario,
        curtido: !jaCurtiu,
        likes: Math.max(
          0,
          (comentario.likes || 0) + (jaCurtiu ? -1 : 1)
        ),
      };
    });

    atualizarPost({
      comentarios: novosComentarios,
    });
  }

  function excluirComentario(comentarioId) {
    const comentario = comentarios.find(
      (item) => item.id === comentarioId
    );

    if (!comentario) return;

    if (comentario.handle !== meuPerfil?.handle) {
      return;
    }

    const confirmou = window.confirm(
      'Deseja excluir este comentário?'
    );

    if (!confirmou) return;

    atualizarPost({
      comentarios: comentarios.filter(
        (item) => item.id !== comentarioId
      ),
    });
  }

  function iniciarResposta(comentarioId) {
    if (respondendoId === comentarioId) {
      setRespondendoId(null);
      setTextoResposta('');
      return;
    }

    setRespondendoId(comentarioId);
    setTextoResposta('');
  }

  function publicarResposta(e, comentarioId) {
    e.preventDefault();

    const texto = textoResposta.trim();

    if (!texto) return;

    const resposta = {
      id: gerarId(),
      autor: meuPerfil?.nome || 'Usuário JENIOS',
      handle: meuPerfil?.handle || '@usuario',
      avatar: meuPerfil?.avatar || '',
      texto,
      criadoEm: new Date().toISOString(),
      likes: 0,
      curtido: false,
    };

    const novosComentarios = comentarios.map((comentario) => {
      if (comentario.id !== comentarioId) {
        return comentario;
      }

      return {
        ...comentario,
        respostas: [
          ...(Array.isArray(comentario.respostas)
            ? comentario.respostas
            : []),
          resposta,
        ],
      };
    });

    atualizarPost({
      comentarios: novosComentarios,
    });

    setTextoResposta('');
    setRespondendoId(null);
  }

  function curtirResposta(comentarioId, respostaId) {
    const novosComentarios = comentarios.map((comentario) => {
      if (comentario.id !== comentarioId) {
        return comentario;
      }

      const novasRespostas = (
        Array.isArray(comentario.respostas)
          ? comentario.respostas
          : []
      ).map((resposta) => {
        if (resposta.id !== respostaId) {
          return resposta;
        }

        const jaCurtiu = Boolean(resposta.curtido);

        return {
          ...resposta,
          curtido: !jaCurtiu,
          likes: Math.max(
            0,
            (resposta.likes || 0) + (jaCurtiu ? -1 : 1)
          ),
        };
      });

      return {
        ...comentario,
        respostas: novasRespostas,
      };
    });

    atualizarPost({
      comentarios: novosComentarios,
    });
  }

  function excluirResposta(comentarioId, respostaId) {
    const comentario = comentarios.find(
      (item) => item.id === comentarioId
    );

    if (!comentario) return;

    const resposta = (
      Array.isArray(comentario.respostas)
        ? comentario.respostas
        : []
    ).find((item) => item.id === respostaId);

    if (!resposta) return;

    if (resposta.handle !== meuPerfil?.handle) {
      return;
    }

    const confirmou = window.confirm(
      'Deseja excluir esta resposta?'
    );

    if (!confirmou) return;

    const novosComentarios = comentarios.map((item) => {
      if (item.id !== comentarioId) {
        return item;
      }

      return {
        ...item,
        respostas: (
          Array.isArray(item.respostas)
            ? item.respostas
            : []
        ).filter((resp) => resp.id !== respostaId),
      };
    });

    atualizarPost({
      comentarios: novosComentarios,
    });
  }

  function alternarSalvo() {
    atualizarPost({
      salvo: !salvo,
    });
  }

  function excluirPublicacao() {
    if (!souAutor) return;

    const confirmou = window.confirm(
      'Deseja excluir esta publicação? Essa ação não poderá ser desfeita.'
    );

    if (!confirmou) return;

    if (typeof onExcluirPost === 'function') {
      onExcluirPost(post.id);
    }
  }

  function abrirPerfil() {
    if (typeof onVisitarPerfil !== 'function') return;

    onVisitarPerfil(
      post.perfilAssociado || {
        nome: post.autor,
        handle: post.handle,
        avatar: post.avatar,
        bio: post.bio,
        cargo: post.cargo,
      }
    );
  }

  function formatarTempo(data) {
    if (!data) return '';

    const criada = new Date(data);

    if (Number.isNaN(criada.getTime())) {
      return '';
    }

    const diferenca =
      Date.now() - criada.getTime();

    const minutos = Math.floor(
      diferenca / 60000
    );

    if (minutos < 1) {
      return 'agora';
    }

    if (minutos < 60) {
      return `há ${minutos} min`;
    }

    const horas = Math.floor(
      minutos / 60
    );

    if (horas < 24) {
      return `há ${horas}h`;
    }

    const dias = Math.floor(
      horas / 24
    );

    if (dias < 7) {
      return `há ${dias}d`;
    }

    return criada.toLocaleDateString('pt-BR');
  }

  useEffect(() => {
    const elemento = cardRef.current;
    if (!elemento || !post?.id) return;

    const chave = `jenios_view_post_${post.id}`;
    let timer = null;
    let visivel = false;
    let registrado = false;

    const cancelar = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const registrar = () => {
      timer = null;

      if (
        !visivel ||
        registrado ||
        document.visibilityState !== 'visible'
      ) return;

      if (
        meuPerfil?.handle &&
        post?.handle &&
        meuPerfil.handle === post.handle
      ) return;

      try {
        if (
          localStorage.getItem(chave) === '1' ||
          sessionStorage.getItem(chave) === '1'
        ) {
          registrado = true;
          return;
        }

        localStorage.setItem(chave, '1');
        registrado = true;
        visualizacaoRegistrada.current = true;

        atualizarPost({
          views: Number(post.views || 0) + 1,
        });
      } catch (erro) {
        console.error('Erro ao registrar view:', erro);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visivel =
          Boolean(entry?.isIntersecting) &&
          entry.intersectionRatio >= 0.6;

        if (!visivel) {
          cancelar();
          return;
        }

        if (registrado || timer !== null) return;

        if (
          meuPerfil?.handle &&
          post?.handle &&
          meuPerfil.handle === post.handle
        ) return;

        try {
          if (
            localStorage.getItem(chave) === '1' ||
            sessionStorage.getItem(chave) === '1'
          ) {
            registrado = true;
            return;
          }
        } catch (erro) {
          console.error(erro);
          return;
        }

        timer = setTimeout(registrar, 1200);
      },
      { threshold: [0, 0.6, 1] }
    );

    const aoMudarVisibilidade = () => {
      if (document.visibilityState !== 'visible') {
        visivel = false;
        cancelar();
      } else {
        observer.unobserve(elemento);
        observer.observe(elemento);
      }
    };

    observer.observe(elemento);

    document.addEventListener(
      'visibilitychange',
      aoMudarVisibilidade
    );

    return () => {
      cancelar();
      observer.disconnect();
      document.removeEventListener(
        'visibilitychange',
        aoMudarVisibilidade
      );
    };
  }, [post.id, post.handle, meuPerfil?.handle]);

  const imagemAtualBruta =
    Array.isArray(post.imagens) && post.imagens.length > 0
      ? post.imagens[indiceCarrossel] || post.imagens[0]
      : null;

  const imagemAtual =
    typeof imagemAtualBruta === 'string'
      ? {
          src: imagemAtualBruta,
          largura: null,
          altura: null,
          proporcao: null,
          orientacao: null,
        }
      : imagemAtualBruta || null;

  const srcImagemAtual = imagemAtual?.src || '';

  return (
    <article
      ref={cardRef}
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* CABEÇALHO */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom:
            '1px solid #e2e8f0',
          backgroundColor: '#faf5ff',
          gap: '10px',
        }}
      >
        <div
          onClick={abrirPerfil}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            minWidth: 0,
            flex: 1,
          }}
        >
          <img
            src={post.avatar}
            alt={`Avatar de ${post.autor}`}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />

          <div
            style={{
              minWidth: 0,
            }}
          >
            <b
              style={{
                color: '#0f172a',
                fontSize: '14px',
                display: 'block',
              }}
            >
              {post.autor}{' '}
              <span
                style={{
                  fontSize: '11px',
                  color: '#7c3aed',
                }}
              >
                {post.handle}
              </span>
            </b>

            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                display: 'block',
              }}
            >
              {post.tempo || 'Agora'} •{' '}
              jenios.com.br/
              {post.handle?.replace('@', '')}
            </span>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() =>
              setMenuAberto(!menuAberto)
            }
            aria-label="Opções da publicação"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#475569',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: 'bold',
            }}
          >
            •••
          </button>

          {menuAberto && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '40px',
                width: '190px',
                backgroundColor: '#ffffff',
                border:
                  '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow:
                  '0 12px 30px rgba(15,23,42,0.14)',
                padding: '6px',
                zIndex: 50,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false);

                  if (
                    typeof onCompartilhar ===
                    'function'
                  ) {
                    onCompartilhar(post.id);
                  }
                }}
                style={estiloBotaoMenu}
              >
                🔗 Copiar link
              </button>

              <button
                type="button"
                onClick={() => {
                  alternarSalvo();
                  setMenuAberto(false);
                }}
                style={estiloBotaoMenu}
              >
                {salvo
                  ? '🔖 Remover dos salvos'
                  : '🔖 Salvar publicação'}
              </button>

              {!souAutor && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    window.alert(
                      'A denúncia será integrada à Central de Moderação da JENIOS nas próximas etapas.'
                    );
                  }}
                  style={estiloBotaoMenu}
                >
                  ⚠️ Denunciar publicação
                </button>
              )}

              {souAutor && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    excluirPublicacao();
                  }}
                  style={{
                    ...estiloBotaoMenu,
                    color: '#dc2626',
                  }}
                >
                  🗑️ Excluir publicação
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TEXTO */}
      {post.texto && (
        <div
          style={{
            padding: '20px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: '#334155',
              margin: 0,
              lineHeight: '1.6',
              whiteSpace: 'pre-line',
              overflowWrap: 'anywhere',
            }}
          >
            {textoExibido}

            {textoLongo && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() =>
                    setTextoExpandido(
                      !textoExpandido
                    )
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#64748b',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                >
                  {textoExpandido
                    ? 'menos'
                    : 'mais'}
                </button>
              </>
            )}
          </p>
        </div>
      )}

      {/* YOUTUBE */}
      {embedYoutubeUrl && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            backgroundColor: '#000',
          }}
        >
          <iframe
            src={embedYoutubeUrl}
            title={`Vídeo de ${post.autor}`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* FOTOS */}
    {Array.isArray(post.imagens) &&
      post.imagens.length > 0 &&
      !embedYoutubeUrl &&
      srcImagemAtual && (
        <div
          style={{
            width: '100%',
            backgroundColor: '#000',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={srcImagemAtual}
            alt={`Publicação de ${post.autor}`}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '80vh',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
            }}
          />

          {temVariasFotos && (
            <>
              <button
                type="button"
                onClick={() =>
                  onMudarFoto?.(
                    post.id,
                    -1,
                    post.imagens.length
                  )
                }
                style={{
                  ...estiloSeta,
                  left: '10px',
                }}
              >
                ‹
              </button>

              <button
                type="button"
                onClick={() =>
                  onMudarFoto?.(
                    post.id,
                    1,
                    post.imagens.length
                  )
                }
                style={{
                  ...estiloSeta,
                  right: '10px',
                }}
              >
                ›
              </button>

              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(0,0,0,0.72)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  pointerEvents: 'none',
                }}
              >
                {indiceCarrossel + 1} / {post.imagens.length}
              </div>
            </>
          )}
        </div>
      )}

    {/* RESUMO DAS INTERAÇÕES */}
      <div
        style={{
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          borderTop:
            '1px solid #e2e8f0',
          color: '#64748b',
          fontSize: '11px',
        }}
      >
        <span>
          {post.likes || 0} curtidas
        </span>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span>
            {contarComentarios()}{' '}
            {contarComentarios() === 1
              ? 'comentário'
              : 'comentários'}
          </span>

          <span>
            👁️ {post.views || 0}{' '}
            visualizações
          </span>
        </div>
      </div>

      {/* AÇÕES */}
      <div
        style={{
          padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns:
            'repeat(4, minmax(0, 1fr))',
          backgroundColor: '#f8fafc',
          borderTop:
            '1px solid #e2e8f0',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={() =>
            onCurtir?.(post.id)
          }
          style={{
            ...estiloAcao,
            color: post.curtido
              ? '#dc2626'
              : '#475569',
          }}
        >
          {post.curtido ? '❤️' : '🤍'}{' '}
          <span>Curtir</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setComentariosAbertos(
              !comentariosAbertos
            )
          }
          style={estiloAcao}
        >
          💬 <span>Comentar</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onCompartilhar?.(post.id)
          }
          style={estiloAcao}
        >
          ↗️ <span>Compartilhar</span>
        </button>

        <button
          type="button"
          onClick={alternarSalvo}
          style={{
            ...estiloAcao,
            color: salvo
              ? '#7c3aed'
              : '#475569',
          }}
        >
          {salvo ? '🔖' : '🏷️'}{' '}
          <span>
            {salvo ? 'Salvo' : 'Salvar'}
          </span>
        </button>
      </div>

      {/* REPOSTAR */}
      <div
        style={{
          padding: '0 20px 12px',
          backgroundColor: '#f8fafc',
        }}
      >
        <button
          type="button"
          onClick={() =>
            onRepostar?.(post)
          }
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#7c3aed',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold',
          }}
        >
          🔄 Repostar na JENIOS
        </button>
      </div>

      {/* COMENTÁRIOS */}
      {comentariosAbertos && (
        <div
          style={{
            borderTop:
              '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <form
            onSubmit={publicarComentario}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom:
                '1px solid #f1f5f9',
            }}
          >
            <img
              src={meuPerfil?.avatar}
              alt=""
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />

            <input
              type="text"
              value={novoComentario}
              onChange={(e) =>
                setNovoComentario(
                  e.target.value
                )
              }
              placeholder="Adicione um comentário..."
              maxLength={1000}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                border:
                  '1px solid #cbd5e1',
                borderRadius: '20px',
                outline: 'none',
                fontSize: '12px',
                color: '#0f172a',
                backgroundColor: '#f8fafc',
              }}
            />

            <button
              type="submit"
              disabled={
                !novoComentario.trim()
              }
              style={{
                border: 'none',
                background: 'none',
                color:
                  novoComentario.trim()
                    ? '#7c3aed'
                    : '#cbd5e1',
                cursor:
                  novoComentario.trim()
                    ? 'pointer'
                    : 'default',
                fontWeight: 'bold',
                fontSize: '12px',
                padding: '6px',
              }}
            >
              Publicar
            </button>
          </form>

          {comentarios.length === 0 ? (
            <div
              style={{
                padding: '24px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  marginBottom: '6px',
                }}
              >
                💬
              </div>

              <b
                style={{
                  display: 'block',
                  color: '#0f172a',
                  fontSize: '12px',
                  marginBottom: '4px',
                }}
              >
                Nenhum comentário ainda
              </b>

              <span
                style={{
                  color: '#64748b',
                  fontSize: '11px',
                }}
              >
                Seja o primeiro a comentar
                esta publicação.
              </span>
            </div>
          ) : (
            <div
              style={{
                padding: '4px 20px 18px',
              }}
            >
              {comentarios.map(
                (comentario) => (
                  <div
                    key={comentario.id}
                    style={{
                      padding: '14px 0',
                      borderBottom:
                        '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems:
                          'flex-start',
                      }}
                    >
                      <img
                        src={
                          comentario.avatar
                        }
                        alt=""
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius:
                            '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            backgroundColor:
                              '#f8fafc',
                            borderRadius:
                              '12px',
                            padding:
                              '9px 11px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent:
                                'space-between',
                              gap: '8px',
                            }}
                          >
                            <div>
                              <b
                                style={{
                                  fontSize:
                                    '11px',
                                  color:
                                    '#0f172a',
                                }}
                              >
                                {
                                  comentario.autor
                                }
                              </b>

                              <span
                                style={{
                                  marginLeft:
                                    '5px',
                                  color:
                                    '#7c3aed',
                                  fontSize:
                                    '9px',
                                  fontWeight:
                                    'bold',
                                }}
                              >
                                {
                                  comentario.handle
                                }
                              </span>
                            </div>

                            <span
                              style={{
                                fontSize:
                                  '9px',
                                color:
                                  '#94a3b8',
                                flexShrink: 0,
                              }}
                            >
                              {formatarTempo(
                                comentario.criadoEm
                              )}
                            </span>
                          </div>

                          <p
                            style={{
                              margin:
                                '5px 0 0',
                              color:
                                '#334155',
                              fontSize:
                                '12px',
                              lineHeight:
                                '1.45',
                              whiteSpace:
                                'pre-wrap',
                              overflowWrap:
                                'anywhere',
                            }}
                          >
                            {
                              comentario.texto
                            }
                          </p>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems:
                              'center',
                            marginTop:
                              '6px',
                            paddingLeft:
                              '4px',
                            flexWrap:
                              'wrap',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              curtirComentario(
                                comentario.id
                              )
                            }
                            style={{
                              ...estiloComentarioAcao,
                              color:
                                comentario.curtido
                                  ? '#dc2626'
                                  : '#64748b',
                            }}
                          >
                            {comentario.curtido
                              ? '❤️'
                              : '♡'}{' '}
                            Curtir
                            {(comentario.likes ||
                              0) > 0
                              ? ` (${comentario.likes})`
                              : ''}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              iniciarResposta(
                                comentario.id
                              )
                            }
                            style={
                              estiloComentarioAcao
                            }
                          >
                            ↩️ Responder
                          </button>

                          {comentario.handle ===
                            meuPerfil?.handle && (
                            <button
                              type="button"
                              onClick={() =>
                                excluirComentario(
                                  comentario.id
                                )
                              }
                              style={{
                                ...estiloComentarioAcao,
                                color:
                                  '#dc2626',
                              }}
                            >
                              Excluir
                            </button>
                          )}
                        </div>

                        {respondendoId ===
                          comentario.id && (
                          <form
                            onSubmit={(e) =>
                              publicarResposta(
                                e,
                                comentario.id
                              )
                            }
                            style={{
                              display: 'flex',
                              gap: '7px',
                              marginTop:
                                '10px',
                            }}
                          >
                            <input
                              autoFocus
                              type="text"
                              value={
                                textoResposta
                              }
                              onChange={(e) =>
                                setTextoResposta(
                                  e.target
                                    .value
                                )
                              }
                              placeholder={`Responder a ${comentario.autor}...`}
                              maxLength={1000}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding:
                                  '8px 10px',
                                border:
                                  '1px solid #cbd5e1',
                                borderRadius:
                                  '16px',
                                fontSize:
                                  '11px',
                                outline:
                                  'none',
                              }}
                            />

                            <button
                              type="submit"
                              disabled={
                                !textoResposta.trim()
                              }
                              style={{
                                border:
                                  'none',
                                background:
                                  'none',
                                color:
                                  textoResposta.trim()
                                    ? '#7c3aed'
                                    : '#cbd5e1',
                                fontWeight:
                                  'bold',
                                fontSize:
                                  '10px',
                                cursor:
                                  textoResposta.trim()
                                    ? 'pointer'
                                    : 'default',
                              }}
                            >
                              Enviar
                            </button>
                          </form>
                        )}

                        {Array.isArray(
                          comentario.respostas
                        ) &&
                          comentario
                            .respostas
                            .length > 0 && (
                            <div
                              style={{
                                marginTop:
                                  '12px',
                                marginLeft:
                                  '16px',
                                paddingLeft:
                                  '12px',
                                borderLeft:
                                  '2px solid #e9d5ff',
                              }}
                            >
                              {comentario.respostas.map(
                                (
                                  resposta
                                ) => (
                                  <div
                                    key={
                                      resposta.id
                                    }
                                    style={{
                                      marginBottom:
                                        '10px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display:
                                          'flex',
                                        gap: '8px',
                                        alignItems:
                                          'flex-start',
                                      }}
                                    >
                                      <img
                                        src={
                                          resposta.avatar
                                        }
                                        alt=""
                                        style={{
                                          width:
                                            '27px',
                                          height:
                                            '27px',
                                          borderRadius:
                                            '50%',
                                          objectFit:
                                            'cover',
                                          flexShrink: 0,
                                        }}
                                      />

                                      <div
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                        }}
                                      >
                                        <div
                                          style={{
                                            backgroundColor:
                                              '#faf5ff',
                                            borderRadius:
                                              '10px',
                                            padding:
                                              '8px 10px',
                                          }}
                                        >
                                          <div
                                            style={{
                                              display:
                                                'flex',
                                              justifyContent:
                                                'space-between',
                                              gap: '8px',
                                            }}
                                          >
                                            <b
                                              style={{
                                                fontSize:
                                                  '10px',
                                                color:
                                                  '#0f172a',
                                              }}
                                            >
                                              {
                                                resposta.autor
                                              }{' '}
                                              <span
                                                style={{
                                                  color:
                                                    '#7c3aed',
                                                  fontSize:
                                                    '9px',
                                                }}
                                              >
                                                {
                                                  resposta.handle
                                                }
                                              </span>
                                            </b>

                                            <span
                                              style={{
                                                fontSize:
                                                  '8px',
                                                color:
                                                  '#94a3b8',
                                                flexShrink: 0,
                                              }}
                                            >
                                              {formatarTempo(
                                                resposta.criadoEm
                                              )}
                                            </span>
                                          </div>

                                          <p
                                            style={{
                                              margin:
                                                '4px 0 0',
                                              fontSize:
                                                '11px',
                                              color:
                                                '#334155',
                                              lineHeight:
                                                '1.4',
                                              whiteSpace:
                                                'pre-wrap',
                                              overflowWrap:
                                                'anywhere',
                                            }}
                                          >
                                            {
                                              resposta.texto
                                            }
                                          </p>
                                        </div>

                                        <div
                                          style={{
                                            display:
                                              'flex',
                                            gap: '10px',
                                            marginTop:
                                              '5px',
                                            paddingLeft:
                                              '3px',
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              curtirResposta(
                                                comentario.id,
                                                resposta.id
                                              )
                                            }
                                            style={{
                                              ...estiloComentarioAcao,
                                              color:
                                                resposta.curtido
                                                  ? '#dc2626'
                                                  : '#64748b',
                                            }}
                                          >
                                            {resposta.curtido
                                              ? '❤️'
                                              : '♡'}{' '}
                                            Curtir
                                            {(resposta.likes ||
                                              0) >
                                            0
                                              ? ` (${resposta.likes})`
                                              : ''}
                                          </button>

                                          {resposta.handle ===
                                            meuPerfil?.handle && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                excluirResposta(
                                                  comentario.id,
                                                  resposta.id
                                                )
                                              }
                                              style={{
                                                ...estiloComentarioAcao,
                                                color:
                                                  '#dc2626',
                                              }}
                                            >
                                              Excluir
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

const estiloAcao = {
  minWidth: 0,
  border: 'none',
  background: 'transparent',
  color: '#475569',
  cursor: 'pointer',
  padding: '8px 4px',
  borderRadius: '8px',
  fontWeight: 'bold',
  fontSize: '11px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  whiteSpace: 'nowrap',
};

const estiloComentarioAcao = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 'bold',
};

const estiloBotaoMenu = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  backgroundColor: 'transparent',
  padding: '9px 10px',
  borderRadius: '7px',
  color: '#334155',
  fontSize: '11px',
  cursor: 'pointer',
};

const estiloSeta = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: 'rgba(0,0,0,0.65)',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: '34px',
  height: '34px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};