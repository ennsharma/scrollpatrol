import {describe,it,expect} from 'vitest';
import {confusion,latency} from '../benchmarks/metrics.mjs';
import {cases} from '../benchmarks/cases.mjs';
describe('benchmark reporting',()=>{
 it('uses inclusive production thresholds and distinguishes false positives from misses',()=>{
  expect(confusion([{expected:true,score:.85},{expected:true,score:.84},{expected:false,score:.9},{expected:false,score:.1}])).toEqual({n:4,tp:1,tn:1,fp:1,fn:1,errors:0,precision:.5,recall:.5,falsePositiveRate:.5,accuracy:.5});
 });
 it('counts errors separately while modeling fail-open behavior and undefined precision',()=>{
  expect(confusion([{expected:true,error:'timeout'},{expected:false,error:'timeout'}])).toEqual({n:2,tp:0,tn:1,fp:0,fn:1,errors:2,precision:null,recall:0,falsePositiveRate:0,accuracy:.5});
 });
 it('uses nearest-rank percentiles without interpreting absent measurements as zero',()=>{
  expect(latency([])).toEqual({n:0,p50:null,p95:null,min:null,max:null});
  expect(latency([1,2,3,4,100].map(ms=>({ms})))).toEqual({n:5,p50:3,p95:100,min:1,max:100});
 });
 it('keeps a balanced set of positive and negative cases in every group',()=>{
  expect(cases).toHaveLength(36);expect(new Set(cases.map(c=>c.id)).size).toBe(36);
  for(const group of new Set(cases.map(c=>c.group))){const rows=cases.filter(c=>c.group===group);expect(rows.some(c=>c.expected)).toBe(true);expect(rows.some(c=>!c.expected)).toBe(true);}
 });
});
