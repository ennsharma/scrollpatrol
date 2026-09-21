import {normalize,type Settings,type Site} from './core';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let config:Settings;
let checking=false;
function connectionStatus(text:string,state='pending'){const el=$('connection-status');el.textContent=text;el.dataset.state=state;}
const status=(text:string)=>{$('status').textContent=text;};
async function save(){await chrome.storage.local.set({settings:config});status('Saved. Your feed will update automatically.');}
function render(){
  $('rules').replaceChildren();$('empty').hidden=!!config.rules.length;
  config.rules.forEach((rule,index)=>{const li=document.createElement('li'),span=document.createElement('span'),button=document.createElement('button');span.textContent=rule;button.textContent='×';button.setAttribute('aria-label',`Remove ${rule}`);button.onclick=async()=>{config.rules.splice(index,1);render();await save();};li.append(span,button);$('rules').append(li);});
  $<HTMLInputElement>('enabled').checked=config.enabled;
  for(const site of ['linkedin','reddit','hn'] as Site[])$<HTMLInputElement>(site).checked=config.sites[site];
  $<HTMLInputElement>('threshold').value=String(Math.round(config.threshold*100));$('threshold-value').textContent=`${Math.round(config.threshold*100)}%`;
}
async function add(rule:string){if(config.rules.length>=10){status('Up to 10 rules for now. Remove one to add another.');return;}if(!rule.trim()||config.rules.includes(rule.trim()))return;config.rules.push(rule.trim().slice(0,200));render();await save();}
async function init(){const data=await chrome.storage.local.get(['settings','apiKey','lastError']);config=normalize(data.settings);render();$<HTMLDetailsElement>('setup').open=!data.apiKey;status(typeof data.lastError==='string'?data.lastError: (data.apiKey?'':'Add a Jev key to start muting.'));
  await renderDiagnostics();
  $<HTMLInputElement>('key').oninput=()=>{connectionStatus('Key entered. Click Save & test to connect.');};
  $('clear-history').onclick=async()=>{await chrome.storage.local.remove('hiddenPosts');await renderDiagnostics();};
  chrome.storage.onChanged.addListener(changes=>{if(changes.connection||changes.hiddenPosts||changes.apiKey)void renderDiagnostics();if(changes.lastError)status(typeof changes.lastError.newValue==='string'?changes.lastError.newValue:'');});
  $('rule-form').onsubmit=async e=>{e.preventDefault();await add($<HTMLTextAreaElement>('rule').value);$<HTMLTextAreaElement>('rule').value='';};
  document.querySelectorAll<HTMLButtonElement>('[data-rule]').forEach(b=>b.onclick=()=>{void add(b.dataset.rule!);});
  $<HTMLInputElement>('enabled').onchange=async e=>{config.enabled=(e.target as HTMLInputElement).checked;await save();};
  for(const site of ['linkedin','reddit','hn'] as Site[])$<HTMLInputElement>(site).onchange=async e=>{config.sites[site]=(e.target as HTMLInputElement).checked;await save();};
  $<HTMLInputElement>('threshold').oninput=e=>{$('threshold-value').textContent=`${(e.target as HTMLInputElement).value}%`;};
  $<HTMLInputElement>('threshold').onchange=async e=>{config.threshold=Number((e.target as HTMLInputElement).value)/100;await save();};
  $('key-form').onsubmit=e=>{e.preventDefault();void testConnection();};
  $('clear-key').onclick=async()=>{await chrome.storage.local.remove('apiKey');await chrome.storage.local.remove(['connection','lastError']);await renderDiagnostics();status('Key removed. Posts will remain visible.');};
}
async function renderDiagnostics(){
  const data=await chrome.storage.local.get(['connection','apiKey','hiddenPosts']);
  const connection=data.connection as {ok:boolean;checkedAt:number;latencyMs?:number;error?:string}|undefined;
  if(!checking&&!$<HTMLInputElement>('key').value) $('connection-status').textContent=!data.apiKey?'No key saved.':!connection?'Key saved — not tested yet.':connection.ok?`Connection verified · ${connection.latencyMs} ms. Jev returned a valid response at ${new Date(connection.checkedAt).toLocaleString()}.`: `Connection failed: ${connection.error}`;
  if(!checking&&!$<HTMLInputElement>('key').value) $('connection-status').dataset.state=connection?.ok?'success':connection?'error':'pending';
  const entries=Array.isArray(data.hiddenPosts)?data.hiddenPosts:[];
  $('hidden-count').textContent=`(${entries.length})`;
  $('hidden-posts').replaceChildren();
  if(!entries.length){const li=document.createElement('li');li.textContent='No muted posts recorded yet.';$('hidden-posts').append(li);}
  for(const entry of entries){
    const li=document.createElement('li'),title=document.createElement(entry.url?'a':'span'),meta=document.createElement('small');
    title.textContent=entry.text;
    if(title instanceof HTMLAnchorElement){try{const url=new URL(entry.url);if(url.protocol==='https:'){title.href=url.href;title.target='_blank';title.rel='noopener noreferrer';}}catch{}}
    meta.textContent=`${entry.site} · ${new Date(entry.hiddenAt).toLocaleString()} · ${Math.round(entry.score*100)}% match\nRule: ${entry.rule}${entry.url?'':' · Post link unavailable'}`;
    li.append(title,meta);$('hidden-posts').append(li);
  }
}
async function testConnection(){
  if(checking)return;
  checking=true;
  const button=$<HTMLButtonElement>('test-connection'),key=$<HTMLInputElement>('key'),remove=$<HTMLButtonElement>('clear-key');
  button.disabled=true;remove.disabled=true;key.disabled=true;button.textContent='Connecting…';
  connectionStatus('Saving and checking your connection…');
  $('connection-status').scrollIntoView({block:'nearest'});
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const draft=key.value.trim();
    if(draft){await chrome.storage.local.remove(['connection','lastError']);await chrome.storage.local.set({apiKey:draft});}
    const {apiKey}=await chrome.storage.local.get('apiKey');
    if(!apiKey){connectionStatus('Paste your TypeSafe key first.','error');return;}
    connectionStatus('Contacting TypeSafe… This can take up to 15 seconds.');
    const result=await Promise.race([
      chrome.runtime.sendMessage({type:'testConnection'}),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connection check timed out. Reload the extension and try again.')),20000);})
    ]);
    if(result?.ok){
      key.value='';key.placeholder='Key saved · paste to replace';
      connectionStatus(`Connected to TypeSafe · ${result.latencyMs} ms. Jev returned a valid response.`, 'success');
    }else{connectionStatus(result?.error||'No response from the extension. Reload it at chrome://extensions and try again.','error');}
  }catch(e){
    const detail=e instanceof Error?e.message:'';
    connectionStatus(/timed out/.test(detail)?detail:'Could not save or check the key. Reload Scrollsafe at chrome://extensions and try again.','error');
  }finally{
    if(timer)clearTimeout(timer);
    checking=false;button.disabled=false;remove.disabled=false;key.disabled=false;button.textContent='Save & test';
    $('connection-status').scrollIntoView({block:'nearest'});
  }
}
void init().catch(()=>{connectionStatus('Setup failed to load. Reload Scrollsafe at chrome://extensions and reopen this popup.','error');$<HTMLDetailsElement>('setup').open=true;});
