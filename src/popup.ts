import {normalize,type Settings,type Site} from './core';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let config:Settings;
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
  $('test-connection').onclick=()=>{void testConnection();};
  $('clear-history').onclick=async()=>{await chrome.storage.local.remove('hiddenPosts');await renderDiagnostics();};
  chrome.storage.onChanged.addListener(changes=>{if(changes.connection||changes.hiddenPosts||changes.apiKey)void renderDiagnostics();if(changes.lastError)status(typeof changes.lastError.newValue==='string'?changes.lastError.newValue:'');});
  $('rule-form').onsubmit=async e=>{e.preventDefault();await add($<HTMLTextAreaElement>('rule').value);$<HTMLTextAreaElement>('rule').value='';};
  document.querySelectorAll<HTMLButtonElement>('[data-rule]').forEach(b=>b.onclick=()=>{void add(b.dataset.rule!);});
  $<HTMLInputElement>('enabled').onchange=async e=>{config.enabled=(e.target as HTMLInputElement).checked;await save();};
  for(const site of ['linkedin','reddit','hn'] as Site[])$<HTMLInputElement>(site).onchange=async e=>{config.sites[site]=(e.target as HTMLInputElement).checked;await save();};
  $<HTMLInputElement>('threshold').oninput=e=>{$('threshold-value').textContent=`${(e.target as HTMLInputElement).value}%`;};
  $<HTMLInputElement>('threshold').onchange=async e=>{config.threshold=Number((e.target as HTMLInputElement).value)/100;await save();};
  $('key-form').onsubmit=async e=>{e.preventDefault();const key=$<HTMLInputElement>('key');if(!key.value.trim()){status('Paste a key first.');return;}await chrome.storage.local.set({apiKey:key.value.trim()});await chrome.storage.local.remove('lastError');key.value='';await testConnection();};
  $('clear-key').onclick=async()=>{await chrome.storage.local.remove('apiKey');await chrome.storage.local.remove(['connection','lastError']);await renderDiagnostics();status('Key removed. Posts will remain visible.');};
}
async function renderDiagnostics(){
  const data=await chrome.storage.local.get(['connection','apiKey','hiddenPosts']);
  const connection=data.connection as {ok:boolean;checkedAt:number;latencyMs?:number;error?:string}|undefined;
  $('connection-status').textContent=!data.apiKey?'No key saved.':!connection?'Key saved — not tested yet.':connection.ok?`Connection verified · ${connection.latencyMs} ms. Jev returned a valid response at ${new Date(connection.checkedAt).toLocaleString()}.`: `Connection failed: ${connection.error}`;
  $('connection-status').dataset.state=connection?.ok?'success':connection?'error':'pending';
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
  const button=$<HTMLButtonElement>('test-connection');button.disabled=true;button.textContent='Testing…';
  $('connection-status').textContent='Checking TypeSafe with a small sample post…';
  try{const result=await chrome.runtime.sendMessage({type:'testConnection'});await renderDiagnostics();if(!result?.ok)$('connection-status').textContent=result?.error||'Connection check failed. Try again.';}
  catch{$('connection-status').textContent='Could not reach the extension. Reload it and try again.';}
  finally{button.disabled=false;button.textContent='Test connection';}
}
void init();
