// Public smoke test of dynamically configured topic quotas without writing leaderboard records.
import {readFileSync} from 'node:fs';
const rulesOutput=JSON.parse(readFileSync('pool-rules.json','utf8'));
const rules=JSON.parse((Array.isArray(rulesOutput)?rulesOutput[0]:rulesOutput).results[0].rules_json);
const topics=new Set(rules.topics.map(s=>s.toLowerCase().trim()));
const base='https://cabal-quiz-api-staging.seavein.workers.dev';
for(const count of [15,30,50]){
 const response=await fetch(base+'/api/quiz/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({count})});
 const quiz=await response.json();
 if(!response.ok)throw Error('Start '+count+' failed: '+JSON.stringify(quiz));
 const ids=new Set(quiz.questions.map(q=>q.id));
 const special=quiz.questions.filter(q=>topics.has(String(q.category_en||'').toLowerCase().trim())).length;
 if(quiz.questions.length!==count||ids.size!==count||special!==rules.quotas[count]||!(quiz.questionDeadline>Date.now()-2000))
    throw Error(count+': distribution or timer mismatch: '+JSON.stringify({length:quiz.questions.length,ids:ids.size,special,expected:rules.quotas[count]}));
 console.log('PASS '+count+' questions, unique IDs, exact '+special+' special quota, timer valid (unranked staging session).');
}
