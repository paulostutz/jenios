'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STORY_IMAGE_MS, STORY_VIDEO_MAX_SECONDS, storyMedia, storyTapDirection } from '../../lib/social/story-playback.mjs';
import styles from './StoryViewer.module.css';

// Mounted with key=story.id: every transition resets timers and cancels the old media.
export default function StoryViewer({ story, segments, hasPrevious, onPrevious, onNext, onClose, onDelete, onOpenPost, canDelete }) {
  const media = storyMedia(story), isVideo = media?.type === 'video';
  const video = useRef(null), dialog = useRef(null), press = useRef(null), elapsed = useRef(0), finished = useRef(false);
  const callbacks = useRef({ onPrevious, onNext, onClose });
  callbacks.current = { onPrevious, onNext, onClose };
  const [ready, setReady] = useState(!media), [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false), [holding, setHolding] = useState(false), [hidden, setHidden] = useState(false);
  const [muted, setMuted] = useState(true), [error, setError] = useState(''), [needsPlay, setNeedsPlay] = useState(false), [deleting, setDeleting] = useState(false);
  const stopped = paused || holding || hidden || deleting;
  const move = useCallback(direction => {
    if (finished.current) return;
    if (direction < 0 && !hasPrevious) return;
    finished.current = true;
    video.current?.pause();
    callbacks.current[direction < 0 ? 'onPrevious' : 'onNext']();
  }, [hasPrevious]);

  useEffect(() => {
    const previousFocus = document.activeElement, oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const visibility = () => setHidden(document.hidden);
    visibility(); document.addEventListener('visibilitychange', visibility);
    const keys = event => {
      if (event.key === 'Escape') { event.preventDefault(); callbacks.current.onClose(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      else if (event.code === 'Space' && !event.target.closest('button,a,input,textarea,select')) { event.preventDefault(); setPaused(value => !value); }
      else if (event.key === 'Tab') {
        const focusable = [...(dialog.current?.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]') || [])];
        const index = focusable.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (!event.shiftKey && (index === focusable.length - 1 || index < 0)) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    window.addEventListener('keydown', keys);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('visibilitychange', visibility); window.removeEventListener('keydown', keys); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [move]);

  useEffect(() => {
    if (isVideo || !ready || stopped) return;
    let frame, last = performance.now(), shown = elapsed.current;
    const tick = now => {
      elapsed.current += Math.min(250, now - last); last = now;
      if (elapsed.current - shown >= 80) { shown = elapsed.current; setProgress(Math.min(1, elapsed.current / STORY_IMAGE_MS)); }
      if (elapsed.current >= STORY_IMAGE_MS) { move(1); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isVideo, ready, stopped, move]);

  useEffect(() => {
    const element = video.current;
    if (!isVideo || !element) return;
    let active = true;
    if (stopped) element.pause();
    else element.play().then(() => { if (active) setNeedsPlay(false); }).catch(() => { if (active) setNeedsPlay(true); });
    return () => { active = false; element.pause(); };
  }, [isVideo, stopped]);

  function startPress(event) {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button,a,input,textarea,select,[data-story-interactive]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    press.current = { x: event.clientX - rect.left, y: event.clientY, at: performance.now(), left: rect.left, width: rect.width };
    event.currentTarget.setPointerCapture?.(event.pointerId); setHolding(true);
  }
  function endPress(event) {
    const start = press.current; press.current = null; setHolding(false);
    if (!start || Math.abs(event.clientY - start.y) > 24) return;
    const direction = storyTapDirection(start.x, event.clientX - start.left, start.width, performance.now() - start.at);
    if (direction) move(direction);
  }
  const failed = () => { setError('Não foi possível carregar esta mídia. Use Próximo para continuar.'); if (!isVideo) setReady(true); };
  const element = !media ? null : isVideo ? <video ref={video} src={media.url} className={styles.media} playsInline muted={muted} preload="metadata" onLoadedData={() => setReady(true)} onPlaying={() => { setReady(true); setNeedsPlay(false); }} onEnded={() => move(1)} onError={failed} onTimeUpdate={event => {
    const { currentTime, duration } = event.currentTarget;
    const total = Number.isFinite(duration) && duration > 0 ? Math.min(duration, STORY_VIDEO_MAX_SECONDS) : STORY_VIDEO_MAX_SECONDS;
    setProgress(Math.min(1, currentTime / total));
    if (currentTime >= STORY_VIDEO_MAX_SECONDS) move(1);
  }}/> : <img src={media.url} alt="Story" className={styles.media} draggable={false} onLoad={() => setReady(true)} onError={failed}/>;
  const index = segments.findIndex(item => item.id === story.id);
  return <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Visualizar Story" className={styles.viewer}>
      <div className={styles.progress} aria-label={`Story ${index + 1} de ${segments.length}`}>
        {segments.map((item, position) => <div className={styles.segment} key={item.id}><div className={styles.fill} style={{ transform: `scaleX(${position < index ? 1 : position === index ? progress : 0})` }}/></div>)}
      </div>
      <header className={styles.header}><strong className={styles.author}>{story.autor || story.handle || 'JENIOS'}</strong><div className={styles.controls}>
        <button className={styles.control} type="button" aria-label={paused ? 'Continuar Story' : 'Pausar Story'} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>
        {isVideo && <button className={styles.control} type="button" aria-label={muted ? 'Ativar som' : 'Silenciar'} onClick={() => setMuted(value => !value)}>{muted ? 'Som' : 'Silenciar'}</button>}
        <button className={styles.control} type="button" aria-label="Fechar Story" onClick={onClose}>×</button>
      </div></header>
      <div className={styles.stage} data-story-stage onPointerDown={startPress} onPointerUp={endPress} onPointerCancel={() => { press.current = null; setHolding(false); }} onContextMenu={event => event.preventDefault()}>
        {story.sharedPost ? <div className={styles.shared}><small>Publicação compartilhada</small><p><strong>{story.sharedPost.profile?.display_name || 'Usuário JENIOS'}</strong></p><p data-story-interactive>{story.sharedPost.body}</p>{element}</div> : element}
      </div>
      {!ready && !error && <p className={styles.notice} role="status">Carregando Story…</p>}
      {error && <p className={styles.notice} role="status">{error}</p>}
      {needsPlay && <button className={styles.control} type="button" onClick={() => { setPaused(false); video.current?.play().then(() => setNeedsPlay(false)).catch(() => setError('Toque em Próximo para continuar.')); }}>Reproduzir vídeo</button>}
      <footer className={styles.footer}>
        <button className={styles.control} type="button" aria-label="Story anterior" disabled={!hasPrevious} onClick={() => move(-1)}>❮ Anterior</button>
        {story.sharedPost && <button className={styles.control} type="button" onClick={() => { onClose(); onOpenPost?.(story.sharedPost.id); }}>Ver publicação original</button>}
        {canDelete && <button className={styles.control} type="button" disabled={deleting} onClick={async () => { if (!window.confirm('Excluir este Story?')) return; setDeleting(true); try { await onDelete(story.id); onClose(); } catch { setError('Não foi possível excluir o Story. Tente novamente.'); } finally { setDeleting(false); } }}>Excluir meu Story</button>}
        <button className={styles.control} type="button" aria-label="Próximo Story" onClick={() => move(1)}>Próximo ❯</button>
      </footer><p className={styles.hint}>Toque à direita para avançar, à esquerda para voltar. Segure para pausar.</p>
    </section>
  </div>;
}
