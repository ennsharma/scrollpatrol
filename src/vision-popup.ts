import type {Settings} from './core';
import {usageToday} from './vision';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let testing=false;
export async function renderVisionStatus(){
  const wasTesting=testing;
  const data=await chrome.storage.local.get(['geminiKey','visionStatus','visionUsage','visionCache']);
  if(!wasTesting&&!testing&&!$<HTMLInputElement>('gemini-key').value)$('vision-connection').textContent=!data.geminiKey?'No Gemini key saved.':(data.visionStatus as {message?:string}|undefined)?.message||'Key saved — not tested yet.';
  const usage=usageToday(data.visionUsage);
  $('vision-usage').textContent=`Today (UTC): $${usage.reservedUsd.toFixed(3)} of allowance used · ${usage.calls} analysis attempts. Estimated Gemini token cost: $${usage.estimatedUsd.toFixed(4)}. ${Array.isArray(data.visionCache)?data.visionCache.length:0} cached descriptions.`;
}
export async function initVision(config:Settings,save:()=>Promise<void>){
  $<HTMLInputElement>('deeper').checked=config.deeper;
  $<HTMLInputElement>('daily-budget').value=String(config.dailyBudget);
  $('deeper').onchange=async e=>{config.deeper=(e.target as HTMLInputElement).checked;await save();};
  $('daily-budget').onchange=async e=>{
    const value=Number((e.target as HTMLInputElement).value);
    if(!Number.isFinite(value)||value<.001||value>5){$('vision-connection').textContent='Choose a daily allowance between $0.001 and $5.';$<HTMLInputElement>('daily-budget').value=String(config.dailyBudget);return;}
    config.dailyBudget=value;await save();
  };
  $('gemini-key').oninput=()=>{$('vision-connection').textContent='Key entered. Click Save & test image access.';};
  $('vision-form').onsubmit=e=>{e.preventDefault();void test();};
  $('remove-gemini').onclick=async()=>{await chrome.storage.local.remove(['geminiKey','visionStatus']);$<HTMLInputElement>('gemini-key').value='';await renderVisionStatus();};
  $('clear-vision-cache').onclick=async()=>{await chrome.storage.local.remove('visionCache');await renderVisionStatus();};
  chrome.storage.onChanged.addListener(changes=>{if(changes.geminiKey||changes.visionStatus||changes.visionUsage||changes.visionCache)void renderVisionStatus();});
  await renderVisionStatus();
}
async function test(){
  if(testing)return;testing=true;
  const button=$<HTMLButtonElement>('test-vision'),key=$<HTMLInputElement>('gemini-key'),remove=$<HTMLButtonElement>('remove-gemini');
  button.disabled=key.disabled=remove.disabled=true;button.textContent='Testing image access…';$('vision-connection').textContent='Saving the key and sending a small generated test image…';
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    if(key.value.trim()){await chrome.storage.local.remove('visionStatus');await chrome.storage.local.set({geminiKey:key.value.trim()});}
    const result=await Promise.race([chrome.runtime.sendMessage({type:'testVision'}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image test timed out. Try again shortly.')),30000);})]);
    if(!result?.ok)throw new Error(result?.error||'No image-test response. Reload the extension and try again.');
    key.value='';key.placeholder='Key saved · paste to replace';$('vision-connection').textContent='Image connection verified. Gemini accepted an image and returned a valid description.';
  }catch(e){$('vision-connection').textContent=e instanceof Error?e.message:'Could not save or test the Gemini key.';}
  finally{if(timer)clearTimeout(timer);testing=false;button.disabled=key.disabled=remove.disabled=false;button.textContent='Save & test image access';}
}
