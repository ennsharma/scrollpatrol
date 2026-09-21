import {siteFor} from './core';
import {posts,postText,related,postUrl} from './adapters';
const site=siteFor(location.hostname)!;
const seen=new WeakMap<HTMLElement,string>();
const revealed=new WeakMap<HTMLElement,string>();
const hidden=new Map<HTMLElement,()=>void>();
let generation=0,busy=false,pending=false;
let checked=0,muted=0,lastError='',lastScan=0;
const recent:Array<{text:string;score?:number;rule?:string;muted:boolean;error?:string;skipped?:string}>=[];
const retryAt=new WeakMap<HTMLElement,number>();
function collapse(el:HTMLElement,rule:string,text:string){
  const nodes=related(el,site),original=nodes.map(n=>[n.style.getPropertyValue('display'),n.style.getPropertyPriority('display')]);
  const placeholder=document.createElement(site==='hn'?'tr':'div');
  const mount=site==='hn'?placeholder.appendChild(document.createElement('td')):placeholder;
  if(mount instanceof HTMLTableCellElement) mount.colSpan=3;
  const host=mount.appendChild(document.createElement('div'));
  const shadow=host.attachShadow({mode:'open'});
  const box=document.createElement('div');box.style.cssText='font:13px system-ui;color:#25418b;background:#eff5ff;padding:12px 16px;border:1px dashed #a9bce7;border-radius:10px;margin:8px 0;display:flex;align-items:center;justify-content:space-between;gap:12px';
  const label=document.createElement('span');label.textContent=`Muted: ${rule}`;
  const button=document.createElement('button');button.textContent='Show post';button.style.cssText='font:inherit;color:#183d9a;background:white;border:1px solid #a9bce7;border-radius:6px;padding:5px 9px;cursor:pointer;white-space:nowrap';
  const restore=()=>{nodes.forEach((n,i)=>{if(original[i][0])n.style.setProperty('display',original[i][0],original[i][1]);else n.style.removeProperty('display');});placeholder.remove();hidden.delete(el);};
  button.onclick=()=>{revealed.set(el,text);restore();};box.append(label,button);shadow.append(box);
  el.before(placeholder);nodes.forEach(n=>n.style.setProperty('display','none','important'));hidden.set(el,restore);
}
async function scan(){
  if(busy){pending=true;return;}
  if(site==='linkedin'&&!location.pathname.startsWith('/feed'))return;
  busy=true;pending=false;lastScan=Date.now();const current=generation;
  try{for(const [el,restore] of hidden)if(!el.isConnected)restore();
  for(const el of posts(document,site)){
    if(current!==generation)break;
    const text=postText(el,site);
    if(hidden.has(el)&&seen.get(el)!==text)hidden.get(el)!();
    if(!text||seen.get(el)===text||revealed.get(el)===text||(retryAt.get(el)||0)>Date.now())continue;
    if(el.getBoundingClientRect().top>innerHeight+800)continue;
    seen.set(el,text);
    let result;
    try{result=await chrome.runtime.sendMessage({type:'classify',text});}
    catch{seen.delete(el);throw new Error('Feed script lost its extension connection. Refresh this page.');}
    if(current!==generation){seen.delete(el);break;}
    if(!result){seen.delete(el);throw new Error('No response from extension. Reload Scrollsafe and refresh this page.');}
    lastError=result.error||'';
    if(!result.error&&!result.skipped)checked++;
    recent.unshift({text:text.slice(0,160),score:result.score,rule:result.rule,muted:!!result.muted,error:result.error,skipped:result.skipped});if(recent.length>5)recent.pop();
    if(result?.error){seen.delete(el);retryAt.set(el,Date.now()+60000);setTimeout(schedule,61000);}
    if(result?.muted&&el.isConnected&&postText(el,site)===text){
      collapse(el,result.rule,text);muted++;
      void chrome.runtime.sendMessage({type:'recordHidden',text,rule:result.rule,score:result.score,url:postUrl(el,site)}).catch(()=>{});
    }
  }}catch(e){lastError=e instanceof Error?e.message:'Feed scan failed. Refresh this page.';}finally{busy=false;if(current!==generation||pending)schedule();}
}
let timer:ReturnType<typeof setTimeout>|undefined;
function schedule(){if(timer)return;timer=setTimeout(()=>{timer=undefined;void scan();},350);}
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true});
addEventListener('scroll',schedule,{passive:true,capture:true});
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(message?.type==='feedStatus'){
    const found=posts(document,site),readable=found.filter(el=>postText(el,site));
    reply({site,detected:found.length,readable:readable.length,checked,muted,hidden:hidden.size,busy,lastError,lastScan,recent});schedule();return;
  }
  if(message?.type!=='settingsChanged')return;generation++;checked=0;muted=0;recent.length=0;lastError='';for(const restore of [...hidden.values()])restore();for(const el of posts(document,site)){seen.delete(el);revealed.delete(el);retryAt.delete(el);}schedule();});
schedule();
