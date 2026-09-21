import type {Site} from './core';
import type {PostContext} from './context';
export const videoSite=(site:Site)=>site==='youtube'||site==='tiktok'||site==='instagram';
export function videoPage(site:Site,path:string){
  if(site==='youtube')return /^\/shorts(?:\/|$)/.test(path);
  if(site==='instagram')return /^\/reels(?:\/|$)/.test(path);
  if(site==='tiktok')return /^\/(?:$|foryou\/?$|following\/?$|friends\/?$)/.test(path);
  return true;
}
const clean=(s:string|null|undefined)=>s?.replace(/\s+/g,' ').trim()||'';
function path(a:Element){try{return new URL(a.getAttribute('href')||'',a.ownerDocument.location.href).pathname;}catch{return '';}}
function igOwner(el:Element){return Array.from(el.querySelectorAll('a[href]')).find(a=>/^\/[\w.]+\/reels\/$/.test(path(a)));}
export function videoPosts(doc:Document,site:Site):HTMLElement[]{
  if(!videoPage(site,doc.location.pathname))return [];
  if(site==='youtube')return Array.from(doc.querySelectorAll<HTMLElement>('ytd-reel-video-renderer'));
  if(site==='tiktok')return Array.from(doc.querySelectorAll<HTMLElement>('[data-e2e^="recommend-list-item"], [data-e2e="feed-item"], article')).filter(el=>!!el.querySelector('video')&&!!el.querySelector('[data-e2e="video-desc"], [data-e2e="browse-video-desc"], [data-e2e="video-author-avatar"]')).filter((el,_,all)=>!all.some(other=>other!==el&&other.contains(el)));
  const found=new Set<HTMLElement>();
  for(const video of doc.querySelectorAll('video')){
    // Reels uses anonymous wrappers; stop at the smallest single-player owner card.
    for(let el=video.parentElement;el&&el!==doc.body;el=el.parentElement){
      if(el.querySelectorAll('video').length>1)break;
      if(igOwner(el)){found.add(el);break;}
    }
  }
  return [...found];
}
export function videoContext(el:HTMLElement,site:Site):PostContext{
  let text='',name='',audio='';
  if(site==='youtube'){
    text=clean(el.querySelector('ytd-reel-player-header-renderer #title, .ytShortsVideoTitleViewModelShortsVideoTitle, h2')?.textContent);
    name=clean(el.querySelector('#channel-name a, #channel-info a, .ytReelChannelBarViewModelChannelName a')?.textContent);
    audio=clean(el.querySelector('a[href*="/source/"], .ytReelSoundMetadataViewModel')?.textContent);
  }else if(site==='tiktok'){
    text=clean(el.querySelector('[data-e2e="video-desc"], [data-e2e="browse-video-desc"]')?.textContent);
    name=clean(el.querySelector('[data-e2e="video-author-uniqueid"], [data-e2e="browse-username"], [data-e2e="video-author"]')?.textContent);
    const owner=el.querySelector('a[data-e2e="video-author-avatar"]');
    if(owner)name=path(owner).match(/^\/@([^/]+)\/?$/)?.[1]||name;
    if(!name){const link=el.querySelector('a[href*="/video/"]');if(link)name=path(link).match(/^\/@([^/]+)\/video\//)?.[1]||'';}
    const sound=el.querySelector('[data-e2e="video-music"], [data-e2e="browse-music"], a[href^="/music/"]');
    audio=clean(sound?.textContent)||clean(sound?.getAttribute('aria-label')).replace(/^Watch more videos with music /,'');
  }else{
    const owner=igOwner(el);if(owner)name=path(owner).split('/')[1];
    // Caption buttons are leaf controls; player and follow controls are not captions.
    text=Array.from(el.querySelectorAll('[role="button"], button')).filter(n=>!n.querySelector('[role="button"],button,video,svg')&&!n.hasAttribute('aria-label')).map(n=>clean(n.textContent)).filter(t=>t&&!/^(Follow|Following|Follow back|Audio is muted|Audio is playing|Play button icon|More|See more)$/i.test(t)).join(' ');
    audio=clean(el.querySelector('a[href*="/reels/audio/"]')?.textContent);
  }
  return {site,text,...(name?{author:{name,role:'author' as const}}:{}),...(audio?{audio}:{}),contentTypes:['video']};
}
export function videoUrl(el:HTMLElement,site:Site){
  const selector=site==='youtube'?'a[href*="/shorts/"]':site==='tiktok'?'a[href*="/video/"]':'a[href*="/reel/"], a[href*="/reels/"]';
  const pattern=site==='youtube'?/^\/shorts\/[^/]+/:site==='tiktok'?/^\/@[^/]+\/video\/\d+/:/^\/reels?\/(?!audio\/)[\w-]+\/?$/;
  for(const a of el.querySelectorAll(selector)){if(pattern.test(path(a)))return new URL(path(a),el.ownerDocument.location.origin).href;}
  const id=el.getAttribute('video-id');if(site==='youtube'&&id&&/^[\w-]+$/.test(id))return `https://www.youtube.com/shorts/${id}`;
  // The current URL only belongs to the onscreen player, never to preloaded cards.
  const rect=el.getBoundingClientRect(),loc=el.ownerDocument.location;
  if(rect.height>0&&rect.top<=(el.ownerDocument.defaultView?.innerHeight||0)/2&&rect.bottom>(el.ownerDocument.defaultView?.innerHeight||0)/2&&pattern.test(loc.pathname))return loc.origin+loc.pathname;
  return '';
}
export function coverVideo(el:HTMLElement,rule:string,onReveal:()=>void):()=>void{
  const position=el.style.getPropertyValue('position'),priority=el.style.getPropertyPriority('position');
  if(getComputedStyle(el).position==='static')el.style.setProperty('position','relative','important');
  el.setAttribute('data-scrollsafe-video-muted','');
  const cover=document.createElement('div');cover.setAttribute('data-scrollsafe-cover','');
  cover.style.cssText='position:absolute!important;inset:0!important;z-index:2147483647!important;visibility:visible!important;display:block!important;background:#111827!important;';
  const shadow=cover.attachShadow({mode:'open'}),box=document.createElement('div');
  box.style.cssText='box-sizing:border-box;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;color:#f8fafc;font:15px system-ui;text-align:center;background:#111827;';
  const label=document.createElement('span');label.textContent=`Muted: ${rule}`;
  const hint=document.createElement('small');hint.textContent='Scroll to the next video, or reveal this one.';
  const button=document.createElement('button');button.textContent='Show video';button.style.cssText='font:inherit;background:#fff;color:#111827;border:0;border-radius:8px;padding:10px 18px;cursor:pointer';
  box.append(label,hint,button);shadow.append(box);el.append(cover);
  const muted=new Map<HTMLMediaElement,boolean>();
  const stop=()=>{for(const media of el.querySelectorAll<HTMLMediaElement>('video,audio')){if(!muted.has(media))muted.set(media,media.muted);if(!media.muted)media.muted=true;media.pause();}};
  el.addEventListener('play',stop,true);el.addEventListener('volumechange',stop,true);stop();
  const restore=()=>{el.removeEventListener('play',stop,true);el.removeEventListener('volumechange',stop,true);for(const [media,value] of muted)media.muted=value;el.removeAttribute('data-scrollsafe-video-muted');cover.remove();if(position)el.style.setProperty('position',position,priority);else el.style.removeProperty('position');};
  button.onclick=e=>{e.stopPropagation();onReveal();};
  return restore;
}
