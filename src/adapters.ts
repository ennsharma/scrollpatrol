import type {Site} from './core';
export function posts(doc:Document,site:Site):HTMLElement[] {
  const selector={hn:'tr.athing',linkedin:'.feed-shared-update-v2',reddit:'shreddit-post, .thing.link'}[site];
  return Array.from(doc.querySelectorAll<HTMLElement>(selector));
}
export function postText(el:HTMLElement,site:Site):string {
  const selector={hn:'.titleline',linkedin:'.update-components-text',reddit:'[slot="title"], [slot="text-body"], a.title'}[site];
  const fragments=Array.from(el.querySelectorAll(selector)).map(n=>n.textContent||'');
  return (fragments.join('\n')||el.getAttribute('post-title')||'').replace(/\s+/g,' ').trim().slice(0,6000);
}
export function related(el:HTMLElement,site:Site):HTMLElement[] {
  const next=el.nextElementSibling as HTMLElement|null;
  return site==='hn'&&next?.querySelector('.subtext')?[el,next]:[el];
}
export function postUrl(el:HTMLElement,site:Site):string {
  if(site==='hn'&&/^\d+$/.test(el.id))return `https://news.ycombinator.com/item?id=${el.id}`;
  if(site==='linkedin'){
    const urn=el.getAttribute('data-urn');
    if(urn&&/^urn:li:activity:\d+$/.test(urn))return `https://www.linkedin.com/feed/update/${urn}/`;
  }
  const raw=site==='reddit'?(el.getAttribute('permalink')||el.querySelector<HTMLAnchorElement>('a.comments, a[href*="/comments/"]')?.getAttribute('href')):el.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"], a[href*="/posts/"]')?.getAttribute('href');
  if(!raw)return '';
  try{const url=new URL(raw,el.ownerDocument.location.href);if(url.protocol!=='https:')return '';return url.href;}catch{return '';}
}
