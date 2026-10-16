'use client';
import { useEffect, useMemo, useState } from 'react';
import { storyExpiry } from '../../lib/social/story-lifetime.mjs';
import { adjacentStoryId, storyAuthorKey, storyGroups } from '../../lib/social/story-playback.mjs';
import StoryViewer from './StoryViewer';

export default function SocialStories({ meuPerfil, stories = [], onAdicionarStory, onExcluirStory, onOpenPost, ocultarMeuStory = false }) {
  const [selectedId, setSelectedId] = useState(null), [now, setNow] = useState(() => Date.now());
  const groups = useMemo(() => storyGroups(stories, now), [stories, now]);
  const sequence = useMemo(() => groups.flat(), [groups]);
  const current = sequence.find(story => story.id === selectedId);
  const mine = groups.find(group => storyAuthorKey(group[0]) === meuPerfil?.id);
  useEffect(() => { setSelectedId(null); }, [meuPerfil?.id]);
  useEffect(() => { setNow(Date.now()); }, [stories]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (selectedId && !current) setSelectedId(null);
    if (!current) return;
    const remaining = storyExpiry(current) - Date.now();
    const timer = setTimeout(() => { setSelectedId(null); setNow(Date.now()); }, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [selectedId, current]);
  useEffect(() => {
    const openMine = () => { const own = storyGroups(stories).find(group => storyAuthorKey(group[0]) === meuPerfil?.id); if (own?.length) { setNow(Date.now()); setSelectedId(own[0].id); } };
    window.addEventListener('jenios:abrir-meu-story', openMine);
    return () => window.removeEventListener('jenios:abrir-meu-story', openMine);
  }, [stories, meuPerfil?.id]);
  function move(direction) { const active = storyGroups(stories).flat(); setSelectedId(adjacentStoryId(active, selectedId, direction)); setNow(Date.now()); }
  const bubble = { border: 'none', background: 'transparent', cursor: 'pointer', minWidth: 76, textAlign: 'center' };
  const avatar = { width: 62, height: 62, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed', padding: 2, boxSizing: 'border-box' };
  return <>
    <section style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', alignItems: 'center' }}>
        {!ocultarMeuStory && <div style={{ minWidth: 76, textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 62, height: 62, margin: '0 auto' }}>
            <button type="button" aria-label="Ver meus Stories" onClick={() => { if (mine?.length) setSelectedId(mine[0].id); }} style={{ padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
              <img src={meuPerfil?.avatar} alt="Meus Stories" style={{ ...avatar, border: mine ? '3px solid #7c3aed' : '2px solid #cbd5e1' }}/>
            </button>
            <button type="button" aria-label="Adicionar Story" onClick={onAdicionarStory} style={{ position: 'absolute', bottom: -3, right: -3, width: 23, height: 23, borderRadius: '50%', border: '2px solid white', backgroundColor: '#7c3aed', color: '#fff', cursor: 'pointer' }}>+</button>
          </div><span style={{ fontSize: 11 }}>Seu Story</span>
        </div>}
        {groups.filter(group => storyAuthorKey(group[0]) !== meuPerfil?.id).map(group => {
          const story = group[0];
          return <button key={storyAuthorKey(story)} type="button" aria-label={`Ver Stories de ${story.autor || story.handle || 'usuário'}`} onClick={() => setSelectedId(story.id)} style={bubble}>
            <img src={story.avatar || meuPerfil?.avatar} alt={story.autor || 'Story'} style={avatar}/><div style={{ fontSize: 11, marginTop: 4 }}>{story.handle || story.autor}</div>
          </button>;
        })}
      </div>
    </section>
    {current && <StoryViewer key={current.id} story={current} segments={groups.find(group => storyAuthorKey(group[0]) === storyAuthorKey(current)) || [current]} hasPrevious={sequence.findIndex(story => story.id === current.id) > 0} onPrevious={() => move(-1)} onNext={() => move(1)} onClose={() => setSelectedId(null)} onDelete={onExcluirStory} canDelete={current.authorId === meuPerfil?.id && typeof onExcluirStory === 'function'} onOpenPost={onOpenPost}/>}
  </>;
}
