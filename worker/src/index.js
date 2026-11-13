import {handleAdmin} from './admin.js';
import {pickQuestions} from './rules.js';
const ALLOWED_SIZES=[15,30,50];
const LETTERS=['A','B','C','D'];
const BANK_SIZE=15000;
const TTL_MS=3*60*60*1000;
const QUESTION_LIMIT_MS=15000;

function corsHeaders(){
  return {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*',
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type'
  };
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:corsHeaders()});}
function fail(error,status=400){return json({error},status);}
function randomInt(max){const r=new Uint32Array(1);crypto.getRandomValues(r);return r[0]%max;}
function randomIds(count){
  const a=Array.from({length:BANK_SIZE},(_,i)=>i+1);
  for(let i=0;i<count;i++){const j=i+randomInt(BANK_SIZE-i);[a[i],a[j]]=[a[j],a[i]];}
  return a.slice(0,count).map(n=>'Q'+String(n).padStart(5,'0'));
}
function tier(total){return total===15?'High':total===30?'Highest':'Ultimate';}
function shuffleQuestion(q){
  const canonical={A:q.option_a,B:q.option_b,C:q.option_c,D:q.option_d};
  const order=[...LETTERS];
  for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}
  const options={}; let correctLetter='A';
  LETTERS.forEach((publicLetter,i)=>{
    const originalLetter=order[i];
    options[publicLetter]=canonical[originalLetter];
    if(originalLetter===q.correct)correctLetter=publicLetter;
  });
  return {
    public:{
      id:q.id,
      category_vi:q.category_vi,category_en:q.category_en,
      subtopic_vi:q.subtopic_vi,subtopic_en:q.subtopic_en,
      difficulty_vi:q.difficulty_vi,difficulty_en:q.difficulty_en,
      question_vi:q.question_vi,question_en:q.question_en,
      options
    },
    private:{id:q.id,correctLetter,correctAnswer:canonical[q.correct]}
  };
}
function cleanName(v){
  const s=String(v??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim();
  if(s.length<2||s.length>32)throw new Error('Name must be 2-32 characters.');
  return s;
}
function keyName(s){return s.normalize('NFKC').toLocaleLowerCase('en-US');}
function isoWeekKey(ms){
  const d=new Date(ms+7*3600000);
  const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
  const day=x.getUTCDay()||7;
  x.setUTCDate(x.getUTCDate()+4-day);
  const y=x.getUTCFullYear(),y0=new Date(Date.UTC(y,0,1));
  const w=Math.ceil((((x-y0)/86400000)+1)/7);
  return `${y}-W${String(w).padStart(2,'0')}`;
}
function periodKeys(ms=Date.now()){
  const d=new Date(ms+7*3600000),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();
  return {
    dayKey:`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    weekKey:isoWeekKey(ms),
    monthKey:`${y}-${String(m).padStart(2,'0')}`,
    yearKey:String(y)
  };
}
async function rankFor(env,total,score,durationMs){
  const r=await env.QUIZ_DB.prepare(`
    WITH best AS (
      SELECT player_name_key,score,duration_ms,
      ROW_NUMBER() OVER (PARTITION BY player_name_key ORDER BY score DESC,duration_ms ASC,completed_at ASC) AS rn
      FROM quiz_results WHERE total=?
    )
    SELECT COUNT(*) AS n FROM best
    WHERE rn=1 AND (score>? OR (score=? AND duration_ms<?))
  `).bind(total,score,score,durationMs).first();
  return Number(r?.n||0)+1;
}
// Compare with ONE best result per normalized IGN in the same tier.
// Strictly lower scores and strictly slower equal-score results only. No artificial estimates.
async function peerStatistics(env,total,score,durationMs){
  const stats=await env.QUIZ_DB.prepare(`
    WITH ranked AS (
      SELECT player_name_key,score,duration_ms,
        ROW_NUMBER() OVER (PARTITION BY player_name_key ORDER BY score DESC,duration_ms ASC,completed_at ASC) AS rn
      FROM quiz_results WHERE total=?
    ), best AS (SELECT score,duration_ms FROM ranked WHERE rn=1)
    SELECT COUNT(*) AS players,
      SUM(CASE WHEN score<? THEN 1 ELSE 0 END) AS lower_scores,
      SUM(CASE WHEN score=? THEN 1 ELSE 0 END) AS same_score,
      SUM(CASE WHEN score=? AND duration_ms>? THEN 1 ELSE 0 END) AS slower_same_score
    FROM best
  `).bind(total,score,score,score,durationMs).first();
  const players=Number(stats?.players||0),lower=Number(stats?.lower_scores||0),
    same=Number(stats?.same_score||0),slower=Number(stats?.slower_same_score||0);
  return {
    population:players,lowerScores:lower,sameScorePlayers:same,slowerSameScore:slower,
    scorePercentile:players?Math.round(lower*100/players):null,
    speedPercentile:same?Math.round(slower*100/same):null
  };
}
async function questionLimit(env,sessionId){
  const r=await env.QUIZ_DB.prepare('SELECT limit_ms FROM quiz_session_limits WHERE session_id=?').bind(sessionId).first();
  return Number(r?.limit_ms||QUESTION_LIMIT_MS);
}
async function startQuiz(request,env){
  if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
  let body={};try{body=await request.json();}catch(_){}
  const count=Number(body.count||50);
  if(!ALLOWED_SIZES.includes(count))return fail('Quiz size must be 15, 30, or 50.');
  // Read D1 rules for every NEW session; no Worker redeploy needed after edits.
  const selectFields='id,category_vi,category_en,subtopic_vi,subtopic_en,difficulty_vi,difficulty_en,question_vi,question_en,option_a,option_b,option_c,option_d,correct';
  let selected;
  try{selected=await pickQuestions(env.QUIZ_DB,count,selectFields)}
  catch(e){console.error('Quiz selection rules:',e);return fail('Question bank or quiz rules invalid.',503)}
  for(let i=selected.length-1;i>0;i--){const j=randomInt(i+1);[selected[i],selected[j]]=[selected[j],selected[i]];}
  const shuffled=selected.map(shuffleQuestion);
  const now=Date.now(),sessionId=crypto.randomUUID();
  const timerSetting=await env.QUIZ_DB.prepare('SELECT seconds FROM quiz_tier_timers WHERE tier_size=?').bind(count).first();
  const limitMs=Number(timerSetting?.seconds||15)*1000;
  await env.QUIZ_DB.batch([
    env.QUIZ_DB.prepare(`
      INSERT INTO quiz_sessions
      (id,question_ids,answers_json,started_at,expires_at,completed,recorded,total)
      VALUES (?,?,?,?,?,0,0,?)
    `).bind(sessionId,JSON.stringify(shuffled.map(x=>x.private)),'{}',now,now+TTL_MS,count),
    env.QUIZ_DB.prepare('INSERT INTO quiz_question_timers(session_id,question_index,started_at) VALUES (?,0,?)').bind(sessionId,now),
    env.QUIZ_DB.prepare('INSERT INTO quiz_session_limits(session_id,limit_ms) VALUES (?,?)').bind(sessionId,limitMs)
  ]);
  return json({sessionId,questionCount:count,tier:tier(count),questions:shuffled.map(x=>x.public),questionDeadline:now+limitMs,questionLimitSeconds:limitMs/1000});
}
async function answerQuiz(request,env){
  if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
  const body=await request.json();
  const sessionId=String(body.sessionId||'').trim();
  const questionId=String(body.questionId||'').trim();
  const answer=String(body.answer||'').toUpperCase();
  if(!sessionId||!questionId||![...LETTERS,'TIMEOUT'].includes(answer))return fail('Invalid answer payload.');
  const s=await env.QUIZ_DB.prepare('SELECT question_ids,answers_json,expires_at,completed FROM quiz_sessions WHERE id=?').bind(sessionId).first();
  if(!s)return fail('Quiz session not found.',404);
  if(s.completed)return fail('Quiz already completed.',409);
  if(Number(s.expires_at)<Date.now())return fail('Quiz session expired.',410);
  let payload,answers;
  try{payload=JSON.parse(s.question_ids);answers=JSON.parse(s.answers_json||'{}');}catch(_){return fail('Invalid quiz session.',500);}
  const q=Array.isArray(payload)?payload.find(x=>x&&x.id===questionId):null;
  if(!q)return fail('Question does not belong to this session.',404);
  if(answers[questionId])return json(answers[questionId]);
  const timer=await env.QUIZ_DB.prepare('SELECT question_index,started_at FROM quiz_question_timers WHERE session_id=?').bind(sessionId).first();
  if(!timer)return fail('Quiz timer session missing; restart the quiz.',409);
  const index=Number(timer.question_index);
  if(payload[index]?.id!==questionId)return fail('Answer the current question first.',409);
  const now=Date.now();
  const limitMs=await questionLimit(env,sessionId);
  const timedOut=now>=Number(timer.started_at)+limitMs||answer==='TIMEOUT';
  const selected=timedOut?'TIMEOUT':answer;
  const result={questionId,answer:selected,isCorrect:!timedOut&&selected===q.correctLetter,correctLetter:q.correctLetter,correctAnswer:q.correctAnswer,timedOut};
  answers[questionId]=result;
  await env.QUIZ_DB.prepare('UPDATE quiz_sessions SET answers_json=? WHERE id=? AND completed=0').bind(JSON.stringify(answers),sessionId).run();
  return json(result);
}
async function advanceQuiz(request,env){
  if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
  const body=await request.json(),sessionId=String(body.sessionId||'').trim();
  if(!sessionId)return fail('Missing sessionId.');
  const s=await env.QUIZ_DB.prepare('SELECT question_ids,answers_json,expires_at,completed FROM quiz_sessions WHERE id=?').bind(sessionId).first();
  if(!s)return fail('Quiz session not found.',404);
  if(s.completed)return fail('Quiz already completed.',409);
  if(Number(s.expires_at)<Date.now())return fail('Quiz session expired.',410);
  let payload,answers;
  try{payload=JSON.parse(s.question_ids);answers=JSON.parse(s.answers_json||'{}');}catch(_){return fail('Invalid quiz session.',500);}
  const timer=await env.QUIZ_DB.prepare('SELECT question_index,started_at FROM quiz_question_timers WHERE session_id=?').bind(sessionId).first();
  if(!timer)return fail('Quiz timer missing.',409);
  const index=Number(timer.question_index);
  if(!payload[index])return fail('Invalid current question.',409);
  if(!answers[payload[index].id])return fail('Please answer or wait for timeout before continuing.',409);
  if(index>=payload.length-1)return fail('Last question reached. Finish the quiz.',409);
  const nextIndex=index+1,now=Date.now();
  const updated=await env.QUIZ_DB.prepare('UPDATE quiz_question_timers SET question_index=?,started_at=? WHERE session_id=? AND question_index=?').bind(nextIndex,now,sessionId,index).run();
  if(!updated.meta?.changes)return fail('Question already advanced. Reload your quiz.',409);
  const limitMs=await questionLimit(env,sessionId);
  return json({questionIndex:nextIndex,questionDeadline:now+limitMs,questionLimitSeconds:limitMs/1000});
}
async function finishQuiz(request,env){
  if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
  const body=await request.json(),sessionId=String(body.sessionId||'').trim();
  if(!sessionId)return fail('Missing sessionId.');
  const s=await env.QUIZ_DB.prepare('SELECT question_ids,answers_json,started_at,expires_at,completed,completed_at,score,total,duration_ms FROM quiz_sessions WHERE id=?').bind(sessionId).first();
  if(!s)return fail('Quiz session not found.',404);
  let payload,answers;try{payload=JSON.parse(s.question_ids);answers=JSON.parse(s.answers_json||'{}');}catch(_){return fail('Invalid quiz session.',500);}
  const total=Array.isArray(payload)?payload.length:Number(s.total||0);
  if(!ALLOWED_SIZES.includes(total))return fail('Invalid quiz size.',500);
  if(s.completed){
    const score=Number(s.score||0),durationMs=Number(s.duration_ms||0);
    return json({score,total,durationMs,completedAt:Number(s.completed_at||0),rank:await rankFor(env,total,score,durationMs),tier:tier(total),peerStats:await peerStatistics(env,total,score,durationMs),review:Object.values(answers)});
  }
  const now=Date.now();
  if(Number(s.expires_at)<now)return fail('Quiz session expired.',410);
  if(Object.keys(answers).length!==total)return fail(`Please answer all ${total} questions.`);
  let score=0;for(const item of Object.values(answers))if(item?.isCorrect)score++;
  const durationMs=Math.max(0,now-Number(s.started_at));
  await env.QUIZ_DB.prepare('UPDATE quiz_sessions SET completed=1,completed_at=?,score=?,total=?,duration_ms=? WHERE id=? AND completed=0')
    .bind(now,score,total,durationMs,sessionId).run();
  return json({score,total,durationMs,completedAt:now,rank:await rankFor(env,total,score,durationMs),tier:tier(total),peerStats:await peerStatistics(env,total,score,durationMs),review:Object.values(answers)});
}
// Best records use normalized IGN and separate tiers; IGN itself is not identity verification.
async function bestForName(env,name,size){
 const rec=await env.QUIZ_DB.prepare('SELECT player_name,score,total,duration_ms,completed_at FROM quiz_results WHERE player_name_key=? AND total=? ORDER BY score DESC,duration_ms ASC,completed_at ASC LIMIT 1').bind(keyName(name),size).first();
 if(!rec)return null;
 return {playerName:rec.player_name,score:Number(rec.score),total:size,durationMs:Number(rec.duration_ms),completedAt:Number(rec.completed_at),rank:await rankFor(env,size,Number(rec.score),Number(rec.duration_ms))};
}
function beats(score,durationMs,old){return !old||score>old.score||(score===old.score&&durationMs<old.durationMs)}
async function playerStatus(request,env){
 if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
 const u=new URL(request.url),name=cleanName(u.searchParams.get('name')),size=Number(u.searchParams.get('size'));
 if(!ALLOWED_SIZES.includes(size))return fail('Invalid tier.',400);
 const sid=String(u.searchParams.get('sessionId')||'').trim();
 if(!sid||sid.length>128)return fail('Valid sessionId required.',400);
 const attempt=await env.QUIZ_DB.prepare('SELECT score,total,duration_ms,completed FROM quiz_sessions WHERE id=?').bind(sid).first();
 if(!attempt||!attempt.completed||Number(attempt.total)!==size)return fail('Completed session not found.',404);
 const score=Number(attempt.score),durationMs=Number(attempt.duration_ms);
 const best=await bestForName(env,name,size);
 return json({exists:!!best,tier:tier(size),best,comparison:!best?'new':beats(score,durationMs,best)?'improved':'not_improved',current:{score,total:size,durationMs}});
}
async function recordQuiz(request,env){
 if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
 const body=await request.json(),sessionId=String(body.sessionId||'').trim(),playerName=cleanName(body.playerName);
 const rawEmail=String(body.email??'').trim();
 if(rawEmail.length>254||rawEmail&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)||/[<>\r\n]/.test(rawEmail)))return fail('Invalid email address.',400);
 const email=rawEmail.toLowerCase();
 const s=await env.QUIZ_DB.prepare('SELECT completed,recorded,score,total,duration_ms,completed_at FROM quiz_sessions WHERE id=?').bind(sessionId).first();
 if(!s)return fail('Quiz session not found.',404);
 if(!s.completed)return fail('Finish the quiz before saving a record.',409);
 if(s.recorded)return fail('This result was already saved.',409);
 const total=Number(s.total),score=Number(s.score),durationMs=Number(s.duration_ms),completedAt=Number(s.completed_at),p=periodKeys(completedAt);
 const oldBest=await bestForName(env,playerName,total);
 const improved=beats(score,durationMs,oldBest);
 const statements=[];
 if(improved)statements.push(env.QUIZ_DB.prepare('INSERT INTO quiz_results (session_id,player_name,player_name_key,score,total,duration_ms,completed_at,day_key,week_key,month_key,year_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(sessionId,playerName,keyName(playerName),score,total,durationMs,completedAt,p.dayKey,p.weekKey,p.monthKey,p.yearKey));
 statements.push(env.QUIZ_DB.prepare('UPDATE quiz_sessions SET recorded=1 WHERE id=? AND recorded=0').bind(sessionId));
 if(email)statements.push(env.QUIZ_DB.prepare('INSERT INTO quiz_player_contacts(session_id,email,supplied_at) VALUES(?,?,?)').bind(sessionId,email,Date.now()));
 await env.QUIZ_DB.batch(statements);
 const best=improved?{playerName,score,total,durationMs,completedAt,rank:await rankFor(env,total,score,durationMs)}:oldBest;
 return json({saved:true,updatedBest:improved,comparison:!oldBest?'new':improved?'improved':'not_improved',playerName,tier:tier(total),score,total,durationMs,best,oldBest,rank:best.rank});
}
async function leaderboard(request,env){
  if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
  const u=new URL(request.url),period=u.searchParams.get('period')||'all',size=Number(u.searchParams.get('size')||50);
  if(!['all','day','week','month','year'].includes(period))return fail('Invalid period.');
  if(!ALLOWED_SIZES.includes(size))return fail('Quiz size must be 15, 30, or 50.');
  const now=periodKeys(),keyMap={day:now.dayKey,week:now.weekKey,month:now.monthKey,year:now.yearKey},fieldMap={day:'day_key',week:'week_key',month:'month_key',year:'year_key'};
  let where='WHERE total=?',bind=[size];
  if(period!=='all'){where+=` AND ${fieldMap[period]}=?`;bind.push(keyMap[period]);}
  const sql=`
    WITH best AS (
      SELECT player_name,player_name_key,score,total,duration_ms,completed_at,
      ROW_NUMBER() OVER (PARTITION BY player_name_key ORDER BY score DESC,duration_ms ASC,completed_at ASC) AS rn
      FROM quiz_results ${where}
    )
    SELECT player_name,score,total,duration_ms,completed_at
    FROM best WHERE rn=1
    ORDER BY score DESC,duration_ms ASC,completed_at ASC
    LIMIT 100
  `;
  const res=await env.QUIZ_DB.prepare(sql).bind(...bind).all();
  return json({period,size,tier:tier(size),key:period==='all'?null:keyMap[period],rows:(res.results||[]).map((x,i)=>({rank:i+1,playerName:x.player_name,score:x.score,total:x.total,durationMs:x.duration_ms,completedAt:x.completed_at}))});
}
async function publicTierTimers(env){
  if(!env.QUIZ_DB)return fail('QUIZ_DB binding missing.',500);
  const r=await env.QUIZ_DB.prepare('SELECT tier_size,seconds FROM quiz_tier_timers WHERE tier_size IN (15,30,50) ORDER BY tier_size').all();
  return json({tiers:(r.results||[]).map(x=>({size:Number(x.tier_size),seconds:Number(x.seconds)}))});
}
async function health(env){
  if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
  const q=await env.QUIZ_DB.prepare('SELECT COUNT(*) AS n FROM quiz_questions').first();
  const r=await env.QUIZ_DB.prepare('SELECT COUNT(*) AS n FROM quiz_results').first();
  return json({ok:true,questionCount:Number(q?.n||0),resultCount:Number(r?.n||0),expectedQuestions:15000,questionLimitSeconds:15,quizSizes:ALLOWED_SIZES,tiers:{15:'High',30:'Highest',50:'Ultimate'}});
}

export default {
  async fetch(request,env){
    try{
      const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'');
      if(path.startsWith('/api/quiz/admin/'))return await handleAdmin(request,env,url);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
      if(request.method==='POST'&&path==='/api/quiz/start')return await startQuiz(request,env);
      if(request.method==='POST'&&path==='/api/quiz/answer')return await answerQuiz(request,env);
      if(request.method==='POST'&&path==='/api/quiz/advance')return await advanceQuiz(request,env);
      if(request.method==='POST'&&path==='/api/quiz/finish')return await finishQuiz(request,env);
      if(request.method==='POST'&&path==='/api/quiz/record')return await recordQuiz(request,env);
      if(request.method==='GET'&&path==='/api/quiz/player-status')return await playerStatus(request,env);
      if(request.method==='GET'&&path==='/api/quiz/leaderboard')return await leaderboard(request,env);
      if(request.method==='GET'&&path==='/api/quiz/health')return await health(env);
      if(request.method==='GET'&&path==='/api/quiz/timers')return await publicTierTimers(env);
      return fail('Not found.',404);
    }catch(e){
      console.error(e);
      if(e?.message?.startsWith('Name must'))return fail(e.message,400);
      return fail('Internal server error.',500);
    }
  }
};
