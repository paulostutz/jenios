export function storyExpiry(story){
 const created=Date.parse(story.criadoEm||story.created_at),expires=Date.parse(story.expiresAt||story.expires_at);
 return Number.isFinite(created)?Math.min(created+86400000,Number.isFinite(expires)?expires:Infinity):NaN;
}
export function storyIsActive(story,now=Date.now()){
 const created=Date.parse(story.criadoEm||story.created_at);
 return Number.isFinite(created)&&created<=now&&storyExpiry(story)>now;
}
