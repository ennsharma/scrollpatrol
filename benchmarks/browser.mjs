import {chromium} from '@playwright/test';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
if(!process.env.TYPESAFE_API_KEY){try{process.loadEnvFile('.env.benchmark');}catch{}}
if(!process.env.TYPESAFE_API_KEY)throw new Error('TYPESAFE_API_KEY required');
const profile=await mkdtemp(resolve(tmpdir(),'scrollpatrol-benchmark-'));
const extension=resolve('dist');
const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
const report={startedAt:new Date().toISOString(),kind:'Live Jev, synthetic HN DOM, real extension',observations:[],limitations:['Five deliberately positive short synthetic posts; not representative feed accuracy.','Headless Chromium on this machine; UI timings include scheduling, messaging, serial queue and API.','Cache check only covers the same service-worker lifetime.']};
try{
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
 await worker.evaluate(async key=>{
  globalThis.benchRequests=[];const original=globalThis.fetch;
  globalThis.fetch=async(...args)=>{if(globalThis.benchRequests.length>=5)throw new Error('Benchmark live request cap reached');const r={start:performance.now()};globalThis.benchRequests.push(r);try{const result=await original(...args);r.ms=performance.now()-r.start;r.status=result.status;return result;}catch(e){r.error=true;throw e;}};
  await chrome.storage.local.set({apiKey:key,settings:{enabled:true,rules:['Startup fundraising announcements'],threshold:.85}});
 },process.env.TYPESAFE_API_KEY);
 const page=await ctx.newPage();await page.setViewportSize({width:1280,height:900});
 await page.route('https://news.ycombinator.com/**',r=>r.fulfill({contentType:'text/html',body:'<html><body><table id="feed"></table></body></html>'}));
 await page.goto('https://news.ycombinator.com/');
 const titles=['We raised a $4 million seed round to build accounting software.','Our startup closed a $9 million Series A today.','We are announcing a $2 million pre-seed investment in our company.','We raised $15 million in Series B financing for our startup.','Our startup just closed its $6 million seed funding round.'];
 async function add(items,offset){await page.evaluate(({items,offset})=>{globalThis.timings??=[];const feed=document.querySelector('#feed');for(const [i,title]of items.entries()){const tr=document.createElement('tr');tr.className='athing';tr.id=String(100+offset+i);const cell=document.createElement('td');const span=document.createElement('span');span.className='titleline';span.textContent=title;cell.append(span);tr.append(cell);const at=performance.now();feed.append(tr);const sub=document.createElement('tr');sub.innerHTML='<td class="subtext">12 comments</td>';feed.append(sub);const observer=new MutationObserver(()=>{if(getComputedStyle(tr).display==='none'){globalThis.timings.push({id:tr.id,ms:performance.now()-at});observer.disconnect();}});observer.observe(tr,{attributes:true});}}, {items,offset});}
 await add(titles.slice(0,3),0);await page.waitForFunction(()=>globalThis.timings?.length===3,{},{timeout:60000});
 report.observations.push({experiment:'Three simultaneously inserted cards',timings:await page.evaluate(()=>globalThis.timings.slice())});
 await add(titles.slice(3),3);await page.waitForFunction(()=>globalThis.timings?.length===5,{},{timeout:60000});
 report.observations.push({experiment:'Two later DOM additions',timings:await page.evaluate(()=>globalThis.timings.slice(3))});
 const callsBefore=await worker.evaluate(()=>globalThis.benchRequests.length);
 await page.reload();await add(titles,0);await page.waitForFunction(()=>globalThis.timings?.length===5,{},{timeout:15000});
 report.observations.push({experiment:'Same posts after reload with warm worker cache',newApiCalls:(await worker.evaluate(()=>globalThis.benchRequests.length))-callsBefore,timings:await page.evaluate(()=>globalThis.timings)});
 const before=Date.now();await page.getByRole('button',{name:'Show post'}).first().click();await page.locator('.athing').first().waitFor({state:'visible'});report.revealAutomationRoundTripMs=Date.now()-before;
 report.requests=await worker.evaluate(()=>globalThis.benchRequests);
 report.success=true;
}catch(e){report.success=false;report.error=e.name==='TimeoutError'?'Timed out waiting for a browser outcome':'Browser experiment failed';process.exitCode=1;}
finally{const out=`benchmarks/results/browser-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;await mkdir('benchmarks/results',{recursive:true});await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));console.log(out);await ctx.close();await rm(profile,{recursive:true,force:true});}
