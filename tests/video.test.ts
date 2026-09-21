import {describe,it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {posts,postContext,postUrl} from '../src/adapters';
import {normalize,siteFor,requestFor} from '../src/core';
const doc=(html:string,url:string)=>new JSDOM(html,{url}).window.document;
describe('short video adapters',()=>{
 it('migrates saved settings and recognizes only supported hosts',()=>{
  expect(normalize({sites:{reddit:false} as any}).sites).toMatchObject({reddit:false,youtube:true,tiktok:true,instagram:true});
  expect(siteFor('www.youtube.com')).toBe('youtube');expect(siteFor('www.youtube.com.evil.test')).toBeNull();
 });
 it('reads modern Shorts titles and owner without confusing mentions',()=>{
  const d=doc('<ytd-reel-video-renderer><video></video><span class="ytReelChannelBarViewModelChannelName"><a href="/@owner/shorts">@owner</a></span><h1 class="ytShortsVideoTitleViewModelShortsVideoTitle">A cooking video <a href="/@mentioned">@mentioned</a></h1><a href="/shorts/abc">Watch</a><div id="comments">Unrelated</div></ytd-reel-video-renderer>','https://www.youtube.com/shorts/abc');
  const p=posts(d,'youtube')[0],c=postContext(p,'youtube');expect(c.author?.name).toBe('@owner');expect(c.text).toBe('A cooking video @mentioned');expect(c.contentTypes).toEqual(['video']);expect(postUrl(p,'youtube')).toBe('https://www.youtube.com/shorts/abc');
 });
 it('reads TikTok captions, author and sound separately',()=>{
  const d=doc('<article data-e2e="recommend-list-item"><video></video><span data-e2e="video-author-uniqueid">owner</span><div data-e2e="video-desc">Cooking #food with @someone</div><a data-e2e="video-music">Original sound - someone</a><a href="/@owner/video/123">Watch</a></article>','https://www.tiktok.com/');
  const p=posts(d,'tiktok');expect(p).toHaveLength(1);expect(postContext(p[0],'tiktok')).toMatchObject({text:'Cooking #food with @someone',author:{name:'owner'},audio:'Original sound - someone'});expect(postUrl(p[0],'tiktok')).toBe('https://www.tiktok.com/@owner/video/123');
 });
 it('reads current TikTok avatar ownership even without a caption',()=>{
  const d=doc('<article data-e2e="recommend-list-item-container"><section data-e2e="feed-video"><video></video><a href="/@owner">Display Name</a><a href="/music/song-123" aria-label="Watch more videos with music Song"></a></section><a data-e2e="video-author-avatar" href="/@owner"></a></article>','https://www.tiktok.com/');
  const p=posts(d,'tiktok');expect(p).toHaveLength(1);expect(postContext(p[0],'tiktok')).toMatchObject({text:'',author:{name:'owner'},audio:'Song'});
 });
 it('finds individual anonymous Reel cards and excludes controls',()=>{
  const card=(name:string)=>`<section><div><video></video></div><div><a href="/${name}/reels/">${name}</a><div role="button">Follow</div></div><div role="button">Cooking #food with @mentioned</div><div role="button" aria-label="Play">Play</div></section>`;
  const d=doc('<main>'+card('owner')+card('other')+'</main>','https://www.instagram.com/reels/');
  const p=posts(d,'instagram');expect(p).toHaveLength(2);expect(postContext(p[0],'instagram')).toMatchObject({author:{name:'owner'},text:'Cooking #food with @mentioned'});expect(postContext(p[1],'instagram').author?.name).toBe('other');expect(postUrl(p[0],'instagram')).toBe('');
 });
 it('ignores messages, regular YouTube videos, and Instagram profiles',()=>{
  for(const [site,url] of [['youtube','https://www.youtube.com/watch?v=abc'],['instagram','https://www.instagram.com/direct/inbox/'],['instagram','https://www.instagram.com/owner/'],['tiktok','https://www.tiktok.com/messages']] as const){
   const d=doc('<ytd-reel-video-renderer><video></video><a href="/owner/reels/">owner</a></ytd-reel-video-renderer>',url);expect(posts(d,site)).toEqual([]);
  }
 });
 it('bounds audio context and preserves the metadata-only model instruction',()=>{
  const r=requestFor({site:'youtube',text:'Caption',audio:'x'.repeat(1000)},['music']);expect(r.state.post.audio).toHaveLength(300);expect(r.questions.r0.instructions.question).toContain('not a transcript');
 });
});
