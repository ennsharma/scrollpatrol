import {normalize,requestFor,decision,siteFor} from './core';
const ready=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const cache=new Map<string,ReturnType<typeof decision>>();
let chain:Promise<unknown>=Promise.resolve();
let backoffUntil=0;
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.type!=='classify') return;
  const run=async()=>{
    await ready;
    const site=siteFor(new URL(sender.url||'https://invalid').hostname);
    if(!sender.tab||!site||typeof msg.text!=='string'||msg.text.length>6000) throw new Error('Unsupported request');
    const {settings,apiKey}=await chrome.storage.local.get(['settings','apiKey']);
    const config=normalize(settings);
    if(!config.enabled||!config.sites[site]||!config.rules.length) return {muted:false};
    if(!apiKey) throw new Error('Add your Jev API key in NopeScope.');
    const key=JSON.stringify([msg.text,config.rules,config.threshold]);
    if(cache.has(key)) return cache.get(key);
    if(Date.now()<backoffUntil) throw new Error('API paused after an error. Try again shortly.');
    const res=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(requestFor(msg.text,config.rules)),signal:AbortSignal.timeout(15000)});
    if(!res.ok){backoffUntil=Date.now()+60000;throw new Error(res.status===401?'Invalid Jev API key. Update it in NopeScope.':`Jev unavailable (${res.status}). Posts remain visible.`);}
    const result=decision((await res.json()).answers,config.rules,config.threshold);
    if(cache.size>=1000) cache.delete(cache.keys().next().value!);
    cache.set(key,result);
    await chrome.storage.local.remove('lastError');
    return result;
  };
  const job=chain.then(run); chain=job.catch(()=>{});
  job.then(reply).catch(async e=>{const error=e instanceof Error?e.message:'Classification failed';await chrome.storage.local.set({lastError:error});reply({muted:false,error});});
  return true;
});
chrome.storage.onChanged.addListener((changes)=>{
  if(!changes.settings&&!changes.apiKey)return;
  cache.clear();backoffUntil=0;
  void chrome.tabs.query({}).then(tabs=>{for(const tab of tabs)if(tab.id)void chrome.tabs.sendMessage(tab.id,{type:'settingsChanged'}).catch(()=>{});});
});
