export function confusion(rows,threshold=.85){
 let tp=0,tn=0,fp=0,fn=0,errors=0;
 for(const r of rows){if(r.error)errors++;const pred=!r.error&&r.score>=threshold;if(r.expected){if(pred)tp++;else fn++;}else{if(pred)fp++;else tn++;}}
 return {n:rows.length,tp,tn,fp,fn,errors,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,falsePositiveRate:fp+tn?fp/(fp+tn):null,accuracy:rows.length?(tp+tn)/rows.length:null};
}
export function latency(rows){const a=rows.map(r=>r.ms).filter(Number.isFinite).sort((a,b)=>a-b);const q=p=>a.length?a[Math.max(0,Math.ceil(p*a.length)-1)]:null;return {n:a.length,p50:q(.5),p95:q(.95),min:a[0]??null,max:a.at(-1)??null};}
