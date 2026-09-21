import {it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
it('collapses HN post and metadata and restores both when settings change',async()=>{
 const dom=new JSDOM('<body><table><tr class="athing"><td><span class="titleline">Funding news</span></td></tr><tr><td class="subtext">12 comments</td></tr></table></body>',{url:'https://news.ycombinator.com',runScripts:'outside-only'});
 const w=dom.window;let listener:(m:unknown)=>void=()=>{};
 (w as any).chrome={runtime:{sendMessage:async()=>({muted:true,rule:'Fundraising'}),onMessage:{addListener:(fn:any)=>listener=fn}}};
 w.eval(readFileSync('dist/content.js','utf8'));
 await new Promise(r=>setTimeout(r,500));
 expect(w.document.querySelector<HTMLElement>('.athing')!.style.display).toBe('none');
 expect(w.document.querySelector<HTMLElement>('.subtext')!.parentElement!.style.display).toBe('none');
 listener({type:'settingsChanged'});
 expect(w.document.querySelector<HTMLElement>('.athing')!.style.display).toBe('');
 expect(w.document.querySelectorAll('tr')).toHaveLength(2);
 w.close();
});
