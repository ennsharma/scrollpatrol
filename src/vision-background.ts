import {normalize,siteFor} from './core';
import {videoPage,videoSite} from './video';
import {ANALYSIS_ALLOWANCE_USD,describeFrames,parseVisual,prepareFrames,reserveAnalysis,usageToday,type Visual} from './vision';
interface Entry {id:string;visual:Visual;at:number}
const TTL=7*24*60*60*1000;
export function installVision(ready:Promise<void>){
  let chain:Promise<unknown>=Promise.resolve(),backoff=0;
  async function entries(){const {visionCache}=await chrome.storage.local.get('visionCache');return (Array.isArray(visionCache)?visionCache:[]).filter((e:Entry)=>typeof e.id==='string'&&Number.isFinite(e.at)&&Date.now()-e.at<TTL).slice(0,200) as Entry[];}
  chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
    if(!['visualLookup','analyzeFrames','testVision'].includes(msg?.type))return;
    const run=async()=>{
      await ready;
      const test=msg.type==='testVision';
      const loc=new URL(sender.url||'https://invalid'),site=siteFor(loc.hostname);
      if(test?sender.url!==chrome.runtime.getURL('popup.html'):(!sender.tab||!site||!videoSite(site)||!videoPage(site,loc.pathname)))throw new Error('Unsupported visual-analysis request.');
      const data=await chrome.storage.local.get(['settings','geminiKey','visionUsage']);const config=normalize(data.settings);
      if(!test&&(!config.enabled||!config.deeper||!config.sites[site!]||!config.rules.length))return {skipped:'Deeper filtering is off.'};
      const key=data.geminiKey;
      if(typeof key!=='string'||!key)throw new Error('Add and test a Gemini key under Deeper video filtering.');
      if(!test&&(typeof msg.id!=='string'||! /^[a-f0-9]{64}$/.test(msg.id)))throw new Error('Missing video identity.');
      const id=site+':'+msg.id;
      const cached=test?undefined:(await entries()).find(e=>e.id===id);
      if(cached)return {visual:parseVisual(cached.visual,cached.visual.frames),cached:true};
      const usage=usageToday(data.visionUsage);
      reserveAnalysis(usage,config.dailyBudget);
      if(!test&&Date.now()<backoff)throw new Error('Visual analysis paused briefly after a provider error.');
      if(msg.type==='visualLookup')return {capture:true};
      let frames:string[];
      if(test){
        const canvas=new OffscreenCanvas(64,64),ctx=canvas.getContext('2d')!;ctx.fillStyle='#2155dd';ctx.fillRect(0,0,64,64);ctx.fillStyle='#ffcc33';ctx.fillRect(16,16,32,32);
        const blob=await canvas.convertToBlob({type:'image/jpeg'});frames=[btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))];
      }else frames=await prepareFrames(msg.frames);
      // Reserve before the network call. Failed/timed-out calls retain their
      // allowance so retries and service-worker restarts cannot overspend it.
      const latest=await chrome.storage.local.get(['settings','geminiKey','visionUsage']);
      const latestConfig=normalize(latest.settings);
      if(latest.geminiKey!==key||(!test&&(!latestConfig.enabled||!latestConfig.deeper||!latestConfig.sites[site!]||!latestConfig.rules.length)))return {skipped:'Visual settings changed before analysis.'};
      const reserved=reserveAnalysis(usageToday(latest.visionUsage),latestConfig.dailyBudget);
      await chrome.storage.local.set({visionUsage:reserved});
      try{
        const result=await describeFrames(key,frames);backoff=0;
        const current=await chrome.storage.local.get(['geminiKey','settings']);
        if(current.geminiKey!==key||(!test&&!normalize(current.settings).deeper))return {skipped:'Visual settings changed during analysis.'};
        await chrome.storage.local.set({visionUsage:{...reserved,estimatedUsd:reserved.estimatedUsd+result.estimatedUsd},visionStatus:{ok:true,at:Date.now(),message:`${test?'Image connection verified':'Frames analyzed'}${result.estimatedUsd>ANALYSIS_ALLOWANCE_USD?' · token estimate exceeded the reserved allowance; review provider pricing.':''}`}});
        if(result.estimatedUsd>ANALYSIS_ALLOWANCE_USD){backoff=Date.now()+24*60*60*1000;await chrome.storage.local.set({visionUsage:{...reserved,reservedUsd:Math.max(config.dailyBudget,reserved.reservedUsd),estimatedUsd:reserved.estimatedUsd+result.estimatedUsd}});}
        if(!test)await chrome.storage.local.set({visionCache:[{id,visual:result.visual,at:Date.now()},...(await entries()).filter(e=>e.id!==id)].slice(0,200)});
        return {ok:true,visual:result.visual,cached:false};
      }catch(e){backoff=Date.now()+60000;throw e;}
    };
    const job=chain.then(run);chain=job.catch(()=>{});
    job.then(reply).catch(async e=>{
      const error=e instanceof Error?(e.name==='TimeoutError'?'Gemini timed out. Metadata filtering stays on.':e.message):'Visual analysis failed.';
      try{await chrome.storage.local.set({visionStatus:{ok:false,at:Date.now(),message:error}});}catch{}
      reply({error});
    });return true;
  });
}
