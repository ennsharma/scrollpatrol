import {installVision} from './vision-background';
import {videoSite} from './video';
import {normalizePost,type PostContext} from './context';
import {normalize,requestFor,decision,siteFor} from './core';
const ready=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
installVision(ready);
const cache=new Map<string,ReturnType<typeof decision>&{needsFrames?:boolean}>();
let chain:Promise<unknown>=Promise.resolve();
let historyChain:Promise<unknown>=Promise.resolve();
let backoffUntil=0;
async function evaluate(apiKey:string,text:string|PostContext,rules:string[],threshold:number,assessVisual=false){
  const res=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(requestFor(text,rules,assessVisual)),signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new Error(res.status===401||res.status===403?'TypeSafe rejected this key. Check the key and account access.':res.status===429?'TypeSafe rate limit reached. Wait a moment and try again.':`TypeSafe unavailable (HTTP ${res.status}). Try again shortly.`);
  const answers=(await res.json()).answers;
  const result=decision(answers,rules,threshold);
  return {...result,needsFrames:assessVisual&&!result.muted?decision({r0:answers.needsVisual},['visual evidence'],.5).muted:false};
}
function errorText(e:unknown){return e instanceof Error?(e.name==='TimeoutError'?'TypeSafe timed out. Check your connection and try again.':e.message):'Connection failed. Try again.';}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.type==='testConnection'){
    if(sender.url!==chrome.runtime.getURL('popup.html'))return;
    void (async()=>{
      await ready;
      const {apiKey}=await chrome.storage.local.get('apiKey');
      if(typeof apiKey!=='string'||!apiKey){reply({ok:false,error:'Add a Jev API key first.'});return;}
      const started=Date.now();
      try{
        await evaluate(apiKey,'We raised a seed round to build our startup.',['Startup fundraising announcements'],.85);
        if((await chrome.storage.local.get('apiKey')).apiKey!==apiKey){reply({ok:false,error:'Key changed. Test the current key again.'});return;}
        const connection={ok:true,checkedAt:Date.now(),latencyMs:Date.now()-started};
        await chrome.storage.local.set({connection});await chrome.storage.local.remove('lastError');backoffUntil=0;reply(connection);
      }catch(e){const error=errorText(e);if((await chrome.storage.local.get('apiKey')).apiKey===apiKey)await chrome.storage.local.set({connection:{ok:false,checkedAt:Date.now(),error}});reply({ok:false,error});}
    })().catch(()=>reply({ok:false,error:'Could not read or save extension settings. Reload Scrollpatrol and try again.'}));return true;
  }
  if(msg?.type==='recordHidden'){
    const job=historyChain.then(async()=>{
      await ready;
      const site=siteFor(new URL(sender.url||'https://invalid').hostname);
      if(!sender.tab||!site||typeof msg.text!=='string'||typeof msg.rule!=='string')return;
      let url='';
      try{const candidate=new URL(msg.url);if(candidate.protocol==='https:'&&siteFor(candidate.hostname)===site)url=candidate.href;}catch{}
      const {hiddenPosts=[]}=await chrome.storage.local.get('hiddenPosts');
      const entry={source:typeof msg.source==='string'?msg.source.slice(0,80):'Metadata',community:typeof msg.community==='string'?msg.community.slice(0,200):'',text:msg.text.slice(0,240),author:typeof msg.author==='string'?msg.author.slice(0,200):'',rule:msg.rule.slice(0,200),score:typeof msg.score==='number'&&Number.isFinite(msg.score)?Math.max(0,Math.min(1,msg.score)):0,url,site,hiddenAt:Date.now()};
      const old=Array.isArray(hiddenPosts)?hiddenPosts:[];
      await chrome.storage.local.set({hiddenPosts:[entry,...old.filter(p=>url?p.url!==url:p.text!==entry.text||p.author!==entry.author||p.community!==entry.community||p.site!==site)].slice(0,50)});
    });historyChain=job.catch(()=>{});job.then(()=>reply({ok:true})).catch(()=>reply({ok:false}));return true;
  }
  if(msg?.type!=='classify') return;
  const run=async()=>{
    await ready;
    const site=siteFor(new URL(sender.url||'https://invalid').hostname);
    if(!sender.tab||!site||(!msg.post&&typeof msg.text!=='string')) throw new Error('Unsupported request');
    const post=normalizePost(msg.post??msg.text);post.site=site;
    const {settings,apiKey}=await chrome.storage.local.get(['settings','apiKey']);
    const config=normalize(settings);
    if(!config.deeper)delete post.visual;
    if(!config.enabled||!config.sites[site]||!config.rules.length) return {muted:false,skipped:!config.enabled?'Filtering is paused.':!config.sites[site]?'Filtering is disabled for this site.':'No mute rules configured.'};
    if(typeof apiKey!=='string'||!apiKey) throw new Error('Add your Jev API key in Scrollpatrol.');
    const key=JSON.stringify([post,config.rules,config.threshold,config.deeper]);
    if(cache.has(key)) return cache.get(key);
    if(Date.now()<backoffUntil) throw new Error('API paused after an error. Try again shortly.');
    let result;
    try{result=await evaluate(apiKey,post,config.rules,config.threshold,config.deeper&&videoSite(site)&&!post.visual);}catch(e){backoffUntil=Date.now()+60000;throw e;}
    if(cache.size>=1000) cache.delete(cache.keys().next().value!);
    cache.set(key,result);
    await chrome.storage.local.remove('lastError');
    return result;
  };
  const job=chain.then(run); chain=job.catch(()=>{});
  job.then(reply).catch(async e=>{const error=errorText(e);await chrome.storage.local.set({lastError:error});reply({muted:false,error});});
  return true;
});
chrome.storage.onChanged.addListener((changes)=>{
  if(!changes.settings&&!changes.apiKey&&!changes.geminiKey)return;
  cache.clear();backoffUntil=0;
  if(changes.apiKey)void chrome.storage.local.remove('connection');
  void chrome.tabs.query({}).then(tabs=>{for(const tab of tabs)if(tab.id)void chrome.tabs.sendMessage(tab.id,{type:'settingsChanged'}).catch(()=>{});});
});
