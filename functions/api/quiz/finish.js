const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(error,status=400)=>json({error},status);

async function rankFor(env,total,score,durationMs){const r=await env.QUIZ_DB.prepare('SELECT COUNT(*) AS n FROM quiz_results WHERE total=? AND (score>? OR (score=? AND duration_ms<?))').bind(total,score,score,durationMs).first();return Number(r?.n||0)+1}
export async function onRequestPost({request,env}){
  try{
    if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
    const body=await request.json(),sessionId=String(body.sessionId||'').trim();
    if(!sessionId)return fail('Missing sessionId.');
    const s=await env.QUIZ_DB.prepare('SELECT question_ids,answers_json,started_at,expires_at,completed,completed_at,score,total,duration_ms FROM quiz_sessions WHERE id=?').bind(sessionId).first();
    if(!s)return fail('Quiz session not found.',404);
    let payload,answers;try{payload=JSON.parse(s.question_ids);answers=JSON.parse(s.answers_json||'{}')}catch(_){return fail('Invalid quiz session.',500)}
    const total=Array.isArray(payload)?payload.length:Number(s.total||0);
    if(![20,50,100].includes(total))return fail('Invalid quiz size.',500);
    if(s.completed){
      const score=Number(s.score||0),durationMs=Number(s.duration_ms||0);
      return json({score,total,durationMs,completedAt:Number(s.completed_at||0),rank:await rankFor(env,total,score,durationMs),tier:total===20?'High':total===50?'Highest':'Ultimate',review:Object.values(answers)});
    }
    const now=Date.now();if(Number(s.expires_at)<now)return fail('Quiz session expired.',410);
    if(Object.keys(answers).length!==total)return fail(`Please answer all ${total} questions.`);
    let score=0;for(const item of Object.values(answers))if(item?.isCorrect)score++;
    const durationMs=Math.max(0,now-Number(s.started_at));
    await env.QUIZ_DB.prepare('UPDATE quiz_sessions SET completed=1,completed_at=?,score=?,total=?,duration_ms=? WHERE id=? AND completed=0')
      .bind(now,score,total,durationMs,sessionId).run();
    return json({score,total,durationMs,completedAt:now,rank:await rankFor(env,total,score,durationMs),tier:total===20?'High':total===50?'Highest':'Ultimate',review:Object.values(answers)});
  }catch(e){console.error(e);return fail('Unable to finish quiz.',500)}
}
