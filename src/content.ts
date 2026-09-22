import {captureFrame,digest,visibleVideo} from './enrichment';
import type {PostContext} from './context';
import type {Visual} from './vision';
import {videoSite,videoPage,coverVideo} from './video';
import {siteFor} from './core';
import {posts,related,postUrl,postContext} from './adapters';
const site=siteFor(location.hostname)!;
let seen=new WeakMap<HTMLElement,string>();
let revealed=new WeakMap<HTMLElement,string>();
const hidden=new Map<HTMLElement,()=>void>();
let generation=0,busy=false,pending=false;
let visualContext=new WeakMap<HTMLElement,{identity:string;visual:Visual}>();
const deepJobs=new WeakMap<HTMLElement,string>();
let deepDone=new WeakMap<HTMLElement,string>();
const hiddenIdentity=new WeakMap<HTMLElement,string>();
const lastVideoCheck=new WeakMap<HTMLElement,{identity:string;at:number}>();
const waitingVisual=new Map<HTMLElement,{identity:string;post:PostContext}>();
let visualStatus='Deeper filtering has not been needed on this tab.';
let checked=0,muted=0,lastError='',lastScan=0;
const recent:Array<{text:string;author?:string;community?:string;score?:number;rule?:string;muted:boolean;error?:string;skipped?:string;source?:string}>=[];
const retryAt=new WeakMap<HTMLElement,number>();
const identityFor=(el:HTMLElement,post:PostContext)=>{const {transcript,visual,...metadata}=post;return JSON.stringify([metadata,...(videoSite(site)?[el.getAttribute('video-id'),...Array.from(el.querySelectorAll('video')).map(v=>v.currentSrc||v.getAttribute('src'))]:[])]);};
const fingerprintFor=(el:HTMLElement,post:PostContext)=>JSON.stringify([post,identityFor(el,post)]);
function contextFor(el:HTMLElement){const post=postContext(el,site),extra=visualContext.get(el);return extra?.identity===identityFor(el,post)?{...post,visual:extra.visual}:post;}
function applyResult(el:HTMLElement,post:PostContext,result:any,identity:string,current:number){
  if(current!==generation||!el.isConnected||identityFor(el,postContext(el,site))!==identity)return;
  const source=post.visual?'Sampled frames'+(post.transcript?' + subtitles':''):post.transcript?'Subtitles + metadata':'Metadata';
  recent.unshift({text:post.text.slice(0,160),author:post.author?.name,community:post.community,score:result.score,rule:result.rule,muted:!!result.muted,error:result.error,skipped:result.skipped,source});if(recent.length>5)recent.pop();
  if(result.muted&&!hidden.has(el)&&revealed.get(el)!==identity){
    collapse(el,result.rule,identity);muted++;
    void chrome.runtime.sendMessage({type:'recordHidden',text:post.text,author:post.author?.name,community:post.community,rule:result.rule,score:result.score,url:postUrl(el,site),source}).catch(()=>{});
  }
}
async function deepen(el:HTMLElement,post:PostContext,identity:string){
  if(deepJobs.get(el)===identity||deepDone.get(el)===identity||hidden.has(el)||revealed.get(el)===identity)return;
  const video=visibleVideo(el);if(!video){visualStatus='Waiting for a visible, decoded video frame.';return;}
  deepJobs.set(el,identity);const current=generation;
  const valid=()=>current===generation&&el.isConnected&&identityFor(el,postContext(el,site))===identity;
  try{
    const id=await digest(site+'|'+(postUrl(el,site)||identity));
    let result=await chrome.runtime.sendMessage({type:'visualLookup',id});
    if(!valid())return;
    if(result?.capture){
      if(visibleVideo(el)!==video)return;
      visualStatus='Sampling the visible video…';
      const time=video.currentTime,frames=[captureFrame(video)];
      await new Promise(resolve=>setTimeout(resolve,900));
      if(!valid()||visibleVideo(el)!==video)return;
      if(Math.abs(video.currentTime-time)>.3)frames.push(captureFrame(video));
      visualStatus='Analyzing sampled frames…';
      result=await chrome.runtime.sendMessage({type:'analyzeFrames',id,frames});
    }
    if(!valid())return;
    if(!result?.visual)throw new Error(result?.error||result?.skipped||'No visual-analysis response.');
    deepDone.set(el,identity);waitingVisual.delete(el);
    visualContext.set(el,{identity,visual:result.visual});
    const enriched=contextFor(el);
    const decision=await chrome.runtime.sendMessage({type:'classify',post:enriched});
    if(!valid())return;
    visualStatus=result.cached?'Used a cached frame description.':'Sampled frames analyzed; no audio was recorded.';
    if(!decision||decision.error){seen.delete(el);throw new Error(decision?.error||'No response when checking visual evidence.');}
    seen.set(el,fingerprintFor(el,enriched));checked++;
    applyResult(el,enriched,decision,identity,current);
  }catch(e){if(valid()){visualStatus=e instanceof Error?e.message:'Visual analysis failed. Metadata filtering remains active.';deepDone.set(el,identity);setTimeout(()=>{if(deepDone.get(el)===identity){deepDone.delete(el);schedule();}},60000);}}
  finally{if(deepJobs.get(el)===identity)deepJobs.delete(el);}
}
function collapse(el:HTMLElement,rule:string,text:string){
  hiddenIdentity.set(el,text);
  if(videoSite(site)){const restore=coverVideo(el,rule,()=>{revealed.set(el,text);hidden.get(el)?.();});hidden.set(el,()=>{restore();hidden.delete(el);});return;}
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
  if(!videoPage(site,location.pathname)){for(const restore of [...hidden.values()])restore();return;}
  if(site==='linkedin'&&!location.pathname.startsWith('/feed'))return;
  busy=true;pending=false;lastScan=Date.now();const current=generation,currentPath=location.pathname;
  try{for(const [el,restore] of hidden)if(!el.isConnected)restore();
  for(const el of posts(document,site)){
    if(current!==generation)break;
    const post=contextFor(el),text=post.text,fingerprint=fingerprintFor(el,post),identity=identityFor(el,post);
    if(hidden.has(el)&&hiddenIdentity.get(el)!==identity)hidden.get(el)!();
    if(hidden.has(el))continue;
    if((!text&&!post.author&&!post.transcript&&!post.linkedArticles?.length)||seen.get(el)===fingerprint||revealed.get(el)===identity||(retryAt.get(el)||0)>Date.now())continue;
    if(el.getBoundingClientRect().top>innerHeight+800)continue;
    const prior=lastVideoCheck.get(el);if(videoSite(site)&&seen.has(el)&&prior?.identity===identity&&Date.now()-prior.at<5000)continue;
    lastVideoCheck.set(el,{identity,at:Date.now()});
    seen.set(el,fingerprint);
    let result;
    try{result=await chrome.runtime.sendMessage({type:'classify',post});}
    catch{seen.delete(el);throw new Error('Feed script lost its extension connection. Refresh this page.');}
    if(current!==generation||currentPath!==location.pathname){seen.delete(el);schedule();break;}
    if(!result){seen.delete(el);throw new Error('No response from extension. Reload Scrollpatrol and refresh this page.');}
    lastError=result.error||'';
    if(!result.error&&!result.skipped)checked++;
    applyResult(el,post,result,identity,current);
    if(result.needsFrames){waitingVisual.set(el,{identity,post});void deepen(el,post,identity);}else waitingVisual.delete(el);
    if(result?.error){seen.delete(el);retryAt.set(el,Date.now()+60000);setTimeout(schedule,61000);}

  }}catch(e){lastError=e instanceof Error?e.message:'Feed scan failed. Refresh this page.';}finally{busy=false;for(const [el,job] of waitingVisual){if(!el.isConnected||identityFor(el,postContext(el,site))!==job.identity)waitingVisual.delete(el);else void deepen(el,job.post,job.identity);}if(current!==generation||pending)schedule();}
}
let timer:ReturnType<typeof setTimeout>|undefined;
function schedule(){if(timer)return;timer=setTimeout(()=>{timer=undefined;void scan();},350);}
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','author','post-title','subreddit-name','subreddit-prefixed-name','promoted','href','content-href','componentkey','data-author','data-subreddit','post-type','permalink','video-id','src','active']});
addEventListener('scroll',schedule,{passive:true,capture:true});
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(message?.type==='feedStatus'){
    const found=posts(document,site),readable=found.filter(el=>{const p=contextFor(el);return p.text||p.author||p.transcript||p.linkedArticles?.length;});
    const contexts=readable.map(el=>contextFor(el));
    reply({site,visualStatus,transcripts:contexts.filter(p=>p.transcript).length,authors:contexts.filter(p=>p.author).length,communities:contexts.filter(p=>p.community).length,samples:contexts.slice(0,3).map(p=>({author:p.author?.name,community:p.community,text:p.text.slice(0,100),transcript:p.transcript?.slice(0,180)})),detected:found.length,readable:readable.length,checked,muted,hidden:hidden.size,busy,lastError,lastScan,recent});schedule();return;
  }
  if(message?.type!=='settingsChanged')return;generation++;visualContext=new WeakMap();visualStatus='Deeper filtering will run only when visual evidence is needed.';waitingVisual.clear();deepDone=new WeakMap();checked=0;muted=0;recent.length=0;lastError='';for(const restore of [...hidden.values()])restore();for(const el of posts(document,site)){seen.delete(el);revealed.delete(el);retryAt.delete(el);}schedule();});
schedule();

if(videoSite(site)){
  const style=document.createElement('style');style.textContent='[data-scrollpatrol-video-muted] > :not([data-scrollpatrol-cover]){visibility:hidden!important}';document.head.append(style);
  addEventListener('loadeddata',schedule,true);
  setInterval(()=>{if(document.visibilityState!=='hidden')schedule();},5000);
  let lastPath=location.pathname;setInterval(()=>{if(location.pathname!==lastPath){lastPath=location.pathname;generation++;for(const restore of [...hidden.values()])restore();seen=new WeakMap();revealed=new WeakMap();waitingVisual.clear();deepDone=new WeakMap();schedule();}},1000);
}
