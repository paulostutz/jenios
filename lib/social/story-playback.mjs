import { storyIsActive } from './story-lifetime.mjs';
export const STORY_IMAGE_MS = 5000;
export const STORY_VIDEO_MAX_SECONDS = 90;
export function storyAuthorKey(story) {
  return String(story.authorId || story.author_id || story.handle || story.id);
}
export function storyGroups(stories, now = Date.now()) {
  const groups = new Map(), seen = new Set();
  for (const story of stories || []) {
    if (!story?.id || seen.has(story.id) || !storyIsActive(story, now)) continue;
    seen.add(story.id);
    const key = storyAuthorKey(story);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(story);
  }
  return [...groups.values()].map(items => items.sort((a, b) =>
    Date.parse(a.criadoEm || a.created_at) - Date.parse(b.criadoEm || b.created_at) || String(a.id).localeCompare(String(b.id))));
}
export function adjacentStoryId(sequence, currentId, direction) {
  const index = sequence.findIndex(story => story.id === currentId);
  if (index < 0) return null;
  return sequence[index + (direction < 0 ? -1 : 1)]?.id || null;
}
export function storyMedia(story) {
  if (story.sharedPost) return story.sharedPost.media?.[0] || null;
  return story.src ? { url: story.src, type: story.tipo === 'video' ? 'video' : 'image' } : null;
}
export function storyTapDirection(start, end, width, elapsedMs) {
  if (elapsedMs >= 250 || Math.abs(end - start) > 24 || width <= 0) return 0;
  return end < width / 3 ? -1 : 1;
}
