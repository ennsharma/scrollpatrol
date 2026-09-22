import {build} from 'esbuild';
import {mkdir,writeFile,readFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cases,keywords,rules} from './cases.mjs';
import {confusion,latency} from './metrics.mjs';
if(!process.env.TYPESAFE_API_KEY){try{process.loadEnvFile('.env.benchmark');}catch{}}
const live=process.argv.includes('--live');
if(live&&!process.env.TYPESAFE_API_KEY)throw new Error('Set TYPESAFE_API_KEY locally; never put it in a command argument.');
const bundled=await build({entryPoints:['src/core.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {requestFor,decision}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const hash=x=>createHash('sha256').update(x).digest('hex');
const jobs=[];
// Alternate ordering within pairs to reduce systematic first-call/order effects.
for(const [i,c] of cases.entries())for(const variant of i%2?['text-only','full']:['full','text-only'])jobs.push({id:c.id,group:c.group,expected:c.expected,variant,post:variant==='full'?c.post:{text:c.post.text},rules:[c.rule]});
const distractors=['Political arguments','Job openings','Cryptocurrency price predictions','Sports results','Restaurant reviews','Travel photography','Real estate listings','Celebrity gossip','Medical advice'];
for(let repeat=0;repeat<5;repeat++)for(const count of [1,5,10])jobs.push({id:`scale-${count}-${repeat}`,group:'scaling',variant:`${count}-rules`,post:cases[0].post,rules:[rules.funding,...distractors.slice(0,count-1)]});
for(const id of ['bait-4','evidence-5','evidence-6'])for(let i=0;i<2;i++){const c=cases.find(c=>c.id===id);jobs.push({...c,id:`${id}-repeat-${i}`,sourceId:id,variant:'repeat',rules:[c.rule]});}
if(jobs.length>100)throw new Error('Hard request cap exceeded');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const out=`benchmarks/results/${stamp}-${live?'live':'dry'}`;
await mkdir(out,{recursive:true});
const manifest={startedAt:new Date().toISOString(),mode:live?'live':'dry',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,platform:process.platform,requestsPlanned:jobs.length,threshold:.85,modelAlias:'jev-latest',datasetSha256:hash(await readFile('benchmarks/cases.mjs')),productionPromptSha256:hash(bundled.outputFiles[0].text),runnerSha256:hash(await readFile('benchmarks/run.mjs')),inputUsdPerMillion:.042,outputUsdPerMillion:0,pricingSource:'https://typesafe.ai/blog/introducing-system-one-models-and-jev',limitations:['Synthetic cases and labels authored by coding assistant, not independent human labels or a representative feed sample.','No DOM extraction or UI timing in this API experiment. No Gemini calls.','One network/location/time window; no local cache, sequential requests, HTTP connection reuse possible.','Text-only variant retains full-context target labels to measure loss from missing evidence.','Threshold sweep is exploratory on the same cases, not held-out validation.','Basic keyword baseline is illustrative, not an optimized competing classifier.']};
await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
await writeFile(`${out}/cases.json`,JSON.stringify(cases,null,2));
const rows=[];let consecutiveErrors=0;
for(const [index,j] of jobs.entries()){
 const payload=requestFor(j.post,j.rules);const row={id:j.id,sourceId:j.sourceId,group:j.group,variant:j.variant,expected:j.expected,ruleCount:j.rules.length,requestSha256:hash(JSON.stringify(payload)),requestBytes:Buffer.byteLength(JSON.stringify(payload))};
 if(live){const start=performance.now();let response;
  try{response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});row.status=response.status;
   if(!response.ok)throw new Error(`HTTP_${response.status}`);
   const data=await response.json();row.ms=performance.now()-start;decision(data.answers,j.rules,.85);row.score=data.answers.r0.noul;row.scores=j.rules.map((_,i)=>data.answers[`r${i}`].noul);row.model=typeof data.model==='string'?data.model:null;
   row.inputTokens=Number.isInteger(data.usage?.input_tokens)&&data.usage.input_tokens>=0?data.usage.input_tokens:null;
   row.outputTokens=Number.isInteger(data.usage?.output_tokens)&&data.usage.output_tokens>=0?data.usage.output_tokens:null;
   row.estimatedUsd=row.inputTokens===null?null:row.inputTokens*.042/1e6;
   consecutiveErrors=0;
  }catch(e){row.ms=performance.now()-start;row.error=response&&!response.ok?`HTTP_${response.status}`:e.name==='TimeoutError'?'timeout':'network_or_invalid_response';consecutiveErrors++;}
 }
 rows.push(row);await appendFile(`${out}/rows.jsonl`,JSON.stringify(row)+'\n');
 if(live)console.log(`${index+1}/${jobs.length} ${j.id} ${j.variant}: ${row.error??row.score} (${Math.round(row.ms)}ms)`);
 if([401,403,429].includes(row.status)||consecutiveErrors>=3)break;
}
const full=rows.filter(r=>r.variant==='full'),textOnly=rows.filter(r=>r.variant==='text-only');
const baseline=cases.map(c=>({...c,score:keywords[c.group].test(c.post.text)?1:0}));
const valid=rows.filter(r=>!r.error&&Number.isFinite(r.ms));
const report={...manifest,finishedAt:new Date().toISOString(),requestsAttempted:live?rows.length:0,errors:rows.filter(r=>r.error).length,models:[...new Set(valid.map(r=>r.model))],cost:{reportedInputTokens:valid.reduce((s,r)=>s+(r.inputTokens??0),0),reportedOutputTokens:valid.reduce((s,r)=>s+(r.outputTokens??0),0),requestsMissingUsage:valid.filter(r=>r.inputTokens===null).length,estimatedUsdKnownUsage:valid.reduce((s,r)=>s+(r.estimatedUsd??0),0),note:'Estimate from published input-token price, not an invoice. Failed calls may incur unreported costs.'},latencySuccessfulApi:latency(valid),latencyAllAttempts:latency(rows),keywordBaseline:confusion(baseline),...(live?{full:confusion(full),textOnly:confusion(textOnly),thresholds:[.5,.7,.85,.95,.99].map(t=>({threshold:t,...confusion(full,t)})),groups:Object.fromEntries(Object.keys(rules).map(g=>[g,confusion(full.filter(r=>r.group===g))])),scaling:[1,5,10].map(n=>{const s=rows.filter(r=>r.group==='scaling'&&r.ruleCount===n);return {ruleCount:n,attempts:s.length,latency:latency(s.filter(r=>!r.error)),meanInputTokens:s.filter(r=>r.inputTokens!==null&&!r.error).reduce((s,r)=>s+r.inputTokens,0)/s.filter(r=>r.inputTokens!==null&&!r.error).length};}),mistakes:full.filter(r=>r.error||((r.score>=.85)!==r.expected)),repeats:rows.filter(r=>r.variant==='repeat')}: {})};
await writeFile(`${out}/summary.json`,JSON.stringify(report,null,2));console.log(`Saved ${out}`);
