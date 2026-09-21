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
async function init(){const data=await chrome.storage.local.get(['settings','apiKey','lastError']);config=normalize(data.settings);render();$<HTMLDetailsElement>('setup').open=!data.apiKey;status(typeof data.lastError==='string'?data.lastError: (data.apiKey?'Connected. Ready to quiet your feed.':'Add a Jev key to start muting.'));
  $('rule-form').onsubmit=async e=>{e.preventDefault();await add($<HTMLTextAreaElement>('rule').value);$<HTMLTextAreaElement>('rule').value='';};
  document.querySelectorAll<HTMLButtonElement>('[data-rule]').forEach(b=>b.onclick=()=>{void add(b.dataset.rule!);});
  $<HTMLInputElement>('enabled').onchange=async e=>{config.enabled=(e.target as HTMLInputElement).checked;await save();};
  for(const site of ['linkedin','reddit','hn'] as Site[])$<HTMLInputElement>(site).onchange=async e=>{config.sites[site]=(e.target as HTMLInputElement).checked;await save();};
  $<HTMLInputElement>('threshold').oninput=e=>{$('threshold-value').textContent=`${(e.target as HTMLInputElement).value}%`;};
  $<HTMLInputElement>('threshold').onchange=async e=>{config.threshold=Number((e.target as HTMLInputElement).value)/100;await save();};
  $('key-form').onsubmit=async e=>{e.preventDefault();const key=$<HTMLInputElement>('key');if(!key.value.trim()){status('Paste a key first.');return;}await chrome.storage.local.set({apiKey:key.value.trim()});await chrome.storage.local.remove('lastError');key.value='';status('Key saved. It will be checked on the next feed post.');};
  $('clear-key').onclick=async()=>{await chrome.storage.local.remove('apiKey');status('Key removed. Posts will remain visible.');};
}
void init();
