// Read/write smoke test on ISOLATED staging only. Creates one unranked completed session, never a leaderboard record.
const base='https://cabal-quiz-api-staging.seavein.workers.dev';
async function call(path,body){
 const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const payload=await res.json();
 if(!res.ok)throw Error(path+' HTTP '+res.status+' '+JSON.stringify(payload));
 return payload;
}
const run=await call('/api/quiz/start',{count:15});
if(!run.sessionId||run.questions?.length!==15||!Number.isInteger(run.questionLimitSeconds)||run.questionLimitSeconds<5||run.questionLimitSeconds>120)throw Error('Start did not return timed 15-question quiz');
for(let i=0;i<15;i++){
 const q=run.questions[i];
 const answer=await call('/api/quiz/answer',{sessionId:run.sessionId,questionId:q.id,answer:'TIMEOUT'});
 if(!answer.timedOut||answer.isCorrect)throw Error('Timeout not marked incorrect at question '+i);
 if(i<14){
  const advanced=await call('/api/quiz/advance',{sessionId:run.sessionId});
  if(advanced.questionIndex!==i+1||advanced.questionLimitSeconds!==run.questionLimitSeconds)throw Error('Advance failed at '+i);
 }
}
const finish=await call('/api/quiz/finish',{sessionId:run.sessionId});
if(finish.score!==0||finish.total!==15)throw Error('Wrong finish score '+JSON.stringify(finish));
if(!finish.peerStats||!Number.isInteger(finish.peerStats.population)||!Number.isInteger(finish.peerStats.sameScorePlayers))throw Error('Missing peer benchmark metrics');
if(finish.peerStats.scorePercentile!==null&&(finish.peerStats.scorePercentile<0||finish.peerStats.scorePercentile>100))throw Error('Invalid score percentile');
if(finish.peerStats.speedPercentile!==null&&(finish.peerStats.speedPercentile<0||finish.peerStats.speedPercentile>100))throw Error('Invalid speed percentile');
if(finish.peerStats.slowerSameScore>finish.peerStats.sameScorePlayers)throw Error('Invalid same-score comparison');
const name='QA-unranked-'+run.sessionId.slice(0,8);
const status=await call('/api/quiz/player-status?name='+encodeURIComponent(name)+'&size=15&sessionId='+encodeURIComponent(run.sessionId));
if(status.exists!==false||status.comparison!=='new'||status.current.score!==0)throw Error('Unexpected player status '+JSON.stringify(status));
console.log('PASS: timed quiz with configurable per-tier seconds, 15 timeout answers, server advance, finish, name comparison, no Ranking write.');
