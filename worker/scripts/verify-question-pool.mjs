import {readFileSync} from 'node:fs';
function extract(path){
 const data=JSON.parse(readFileSync(path,'utf8'));
 const item=Array.isArray(data)?data[0]:data;
 if(!item?.success||!Array.isArray(item.results))throw Error(path+': D1 response invalid');
 return item;
}
const plan=extract('pool-plan.json').results.map(r=>String(r.detail||''));
if(!plan.some(x=>x.includes('idx_quiz_question_pool_type_random')&&x.includes('SEARCH')))throw Error('No indexed SEEK in query plan: '+plan.join(' / '));
if(plan.some(x=>/SCAN quiz_questions|USE TEMP B-TREE/i.test(x)))throw Error('Unindexed bank scan or sort: '+plan.join(' / '));
const stats=extract('pool-counts.json').results[0];
if(!stats||Number(stats.questions)<15000||Number(stats.questions)!==Number(stats.pool))throw Error('Question pool is missing records: '+JSON.stringify(stats));
if(Number(stats.special)<3||Number(stats.questions)-Number(stats.special)<50)throw Error('Pool lacks enough questions for tier quotas');
const sample=extract('pool-sample.json');
if(sample.results.length!==8)throw Error('Unexpected sample size '+sample.results.length);
const reads=Number(sample.meta?.rows_read);
if(!Number.isFinite(reads)||reads>1000)throw Error('Indexed sampling still reads too many rows: '+sample.meta?.rows_read);
console.log('SUCCESS: indexed D1 query, no full scan, '+stats.questions+' synchronized questions, '+stats.special+' special, 8-row sample read '+reads+' rows.');
