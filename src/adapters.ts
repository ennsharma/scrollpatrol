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
