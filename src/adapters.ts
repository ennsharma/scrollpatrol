import {videoSite,videoPosts,videoContext,videoUrl} from './video';
import type {Site} from './core';
import {normalizePost,type PostContext} from './context';
export function posts(doc:Document,site:Site):HTMLElement[] {
  if(videoSite(site))return videoPosts(doc,site);
  const selector={hn:'tr.athing',linkedin:'.feed-shared-update-v2, [role="listitem"][componentkey^="update-card-focus"]',reddit:'shreddit-post, shreddit-ad-post, .thing.link'}[site as 'hn'|'linkedin'|'reddit'];
  const found=Array.from(doc.querySelectorAll<HTMLElement>(selector));
  return found.filter(el=>!found.some(parent=>parent!==el&&parent.contains(el)));
}
export function postText(el:HTMLElement,site:Site):string {
  if(videoSite(site))return videoContext(el,site).text;
  const selector={hn:'.titleline',linkedin:'.update-components-text, [data-testid="expandable-text-box"]',reddit:'[slot="title"], [slot="text-body"], a.title'}[site as 'hn'|'linkedin'|'reddit'];
  const fragments=Array.from(el.querySelectorAll(selector)).filter(n=>!n.closest('[componentkey^="replaceableComment_"]')).map(n=>n.textContent||'');
  return (fragments.join('\n')||el.getAttribute('post-title')||'').replace(/\s+/g,' ').trim().slice(0,6000);
}
export function related(el:HTMLElement,site:Site):HTMLElement[] {
  const next=el.nextElementSibling as HTMLElement|null;
  return site==='hn'&&next?.querySelector('.subtext')?[el,next]:[el];
}
export function postUrl(el:HTMLElement,site:Site):string {
  if(videoSite(site))return videoUrl(el,site);
  if(site==='hn'&&/^\d+$/.test(el.id))return `https://news.ycombinator.com/item?id=${el.id}`;
  if(site==='linkedin'){
    const urn=el.getAttribute('data-urn');
    if(urn&&/^urn:li:activity:\d+$/.test(urn))return `https://www.linkedin.com/feed/update/${urn}/`;
  }
  const raw=site==='reddit'?(el.getAttribute('permalink')||el.querySelector<HTMLAnchorElement>('a.comments, a[href*="/comments/"]')?.getAttribute('href')):el.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"], a[href*="/posts/"]')?.getAttribute('href');
  if(!raw)return '';
  try{const url=new URL(raw,el.ownerDocument.location.href);if(url.protocol!=='https:')return '';return url.href;}catch{return '';}
}

const COMMENT='[componentkey^="replaceableComment_"], .comments-comment-item, shreddit-comment';
const BODY='.update-components-text, [data-testid="expandable-text-box"]';
const compact=(value:string|null|undefined)=>value?.replace(/\s+/g,' ').trim()||'';
function outsideComments(el:Element){return !el.closest(COMMENT);}
function domain(href:string,base:string){try{const url=new URL(href,base);return ['https:','http:'].includes(url.protocol)?url.hostname:'';}catch{return '';}}
export function postContext(el:HTMLElement,site:Site):PostContext {
  if(videoSite(site))return normalizePost(videoContext(el,site));
  const result:PostContext={site,text:postText(el,site)};
  if(site==='linkedin'){
    // Post controls identify the owner; profile links also include reactors and mentions.
    const control=Array.from(el.querySelectorAll('button[aria-label]')).filter(outsideComments).map(n=>n.getAttribute('aria-label')||'').find(label=>/^(Hide post by |Open control menu for post by )/.test(label));
    const legacy=el.querySelector('.update-components-actor__name [aria-hidden="true"], .update-components-actor__name');
    const name=compact(control?.replace(/^(Hide post by |Open control menu for post by )/,'')||legacy?.textContent);
    const body=el.querySelector(BODY);
    const header=Array.from(el.querySelectorAll('p')).filter(n=>outsideComments(n)&&!n.closest(BODY)&&(!body||!!(n.compareDocumentPosition(body)&4)));
    const authorIndex=header.findIndex(n=>compact(n.textContent)===name);
    if(name){
      const legacyHeadline=compact(el.querySelector('.update-components-actor__description')?.textContent);
      const next=authorIndex>=0?header.slice(authorIndex+1).map(n=>compact(n.textContent)).find(t=>t&&!/^(?:[•·\s]*(?:1st|2nd|3rd\+?|Premium|Verified|Profile|Following|Follow|Promoted)|\d+\s*[smhdwy](?:\s|[•·]|$))/i.test(t)):undefined;
      result.author={name,role:'author',...(legacyHeadline||next?{headline:legacyHeadline||next}:{})};
      const social=authorIndex>0?header.slice(0,authorIndex).map(n=>compact(n.textContent)).filter(t=>/\b(likes this|reposted|commented|follows this|finds this|celebrates|loves this)\b/i.test(t)).join(' '):'';
      if(social)result.socialContext=social;
    }
    if(Array.from(el.querySelectorAll('p,span')).filter(n=>outsideComments(n)&&!n.closest(BODY)&&(!body||!!(n.compareDocumentPosition(body)&4))).some(n=>/^Promoted(?: by)?$/i.test(compact(n.textContent)))||Array.from(el.querySelectorAll('[data-view-name="feed-sponsored-label"]')).some(outsideComments))result.promoted=true;
    // Only link cards outside body text; inline mentions and comments are not articles.
    const articles=Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(n=>outsideComments(n)&&!n.closest(BODY)&&(!body||!!(body.compareDocumentPosition(n)&4))).map(n=>({title:compact(n.textContent),domain:domain(n.href,el.ownerDocument.location.href)})).filter(a=>a.title&&a.domain&&!a.domain.endsWith('linkedin.com'));
    const pulse=Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href*="/pulse/"]')).filter(n=>outsideComments(n)&&!n.closest(BODY)).map(n=>({title:compact(n.textContent),domain:'linkedin.com'})).filter(a=>a.title);
    result.linkedArticles=[...articles,...pulse].slice(0,3);
  }else if(site==='reddit'){
    const credit=el.querySelector('[slot="credit-bar"]');
    const authorLink=credit?.querySelector<HTMLAnchorElement>('a[href*="/user/"], a[href*="/u/"]')||el.querySelector<HTMLAnchorElement>('a.author');
    const name=compact(el.getAttribute('author')||el.getAttribute('data-author')||authorLink?.getAttribute('href')?.match(/\/(?:user|u)\/([^/?#]+)/)?.[1]||authorLink?.textContent).replace(/^u\//,'');
    if(name&&name!=='[deleted]')result.author={name,role:'author'};
    const subredditLink=credit?.querySelector<HTMLAnchorElement>('a[href*="/r/"]')||el.querySelector<HTMLAnchorElement>('a.subreddit');
    const subreddit=compact(el.getAttribute('subreddit-prefixed-name')||el.getAttribute('subreddit-name')||el.getAttribute('data-subreddit')||subredditLink?.getAttribute('href')?.match(/\/r\/([^/?#]+)/)?.[1]||postUrl(el,site).match(/\/r\/([^/?#]+)/)?.[1]);
    if(subreddit&&!subreddit.startsWith('u_'))result.community=subreddit.startsWith('r/')?subreddit:`r/${subreddit}`;
    result.flair=compact(el.querySelector('[slot="post-flair"], .linkflairlabel')?.textContent);
    if(el.localName==='shreddit-ad-post'||(el.hasAttribute('promoted')&&el.getAttribute('promoted')!=='false')||el.classList.contains('promoted'))result.promoted=true;
    const link=el.getAttribute('content-href')||el.querySelector<HTMLAnchorElement>('a.title')?.href;
    if(link)result.linkedArticles=[{title:compact(el.getAttribute('post-title')||el.querySelector('a.title')?.textContent),domain:domain(link,el.ownerDocument.location.href)}];
  }else{
    const metadata=related(el,site)[1];
    const name=compact(metadata?.querySelector('.hnuser')?.textContent);
    if(name)result.author={name,role:'submitter'};
    const link=el.querySelector<HTMLAnchorElement>('.titleline > a');
    if(link)result.linkedArticles=[{title:compact(link.textContent),domain:domain(link.href,el.ownerDocument.location.href)}];
  }
  result.contentTypes=[];
  if(result.text)result.contentTypes.push('text');
  if(site==='reddit'){const type=el.getAttribute('post-type');if(type==='video')result.contentTypes.push('video');if(type==='image'||type==='gallery')result.contentTypes.push('image');}
  if(Array.from(el.querySelectorAll('video,[aria-label="Video Player"],[data-testid="video-player"]')).some(outsideComments))result.contentTypes.push('video');
  if(Array.from(el.querySelectorAll('.update-components-image img, [slot="post-media-container"] img, [data-testid="image-viewer"] img')).some(n=>outsideComments(n)&&!n.closest('a[href*="/in/"], a[href*="/company/"], .update-components-actor')&&!!n.getAttribute('alt')))result.contentTypes.push('image');
  if(result.linkedArticles?.length)result.contentTypes.push('article');
  return normalizePost(result);
}
