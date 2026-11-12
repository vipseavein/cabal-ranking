const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(error,status=400)=>json({error},status);
const LETTERS=['A','B','C','D'];

export async function onRequestPost({request,env}){
  try{
    if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
    const body=await request.json();
    const sessionId=String(body.sessionId||'').trim();
    const questionId=String(body.questionId||'').trim();
    const answer=String(body.answer||'').toUpperCase();
    if(!sessionId||!questionId||!LETTERS.includes(answer))return fail('Invalid answer payload.');
    const s=await env.QUIZ_DB.prepare('SELECT question_ids,answers_json,expires_at,completed FROM quiz_sessions WHERE id=?').bind(sessionId).first();
    if(!s)return fail('Quiz session not found.',404);
    if(s.completed)return fail('Quiz already completed.',409);
    if(Number(s.expires_at)<Date.now())return fail('Quiz session expired.',410);
    let payload,answers;
    try{payload=JSON.parse(s.question_ids);answers=JSON.parse(s.answers_json||'{}')}catch(_){return fail('Invalid quiz session.',500)}
    const q=Array.isArray(payload)?payload.find(x=>x&&x.id===questionId):null;
    if(!q)return fail('Question does not belong to this session.',404);
    if(answers[questionId])return json(answers[questionId]);
    const result={questionId,answer,isCorrect:answer===q.correctLetter,correctLetter:q.correctLetter,correctAnswer:q.correctAnswer};
    answers[questionId]=result;
    await env.QUIZ_DB.prepare('UPDATE quiz_sessions SET answers_json=? WHERE id=? AND completed=0').bind(JSON.stringify(answers),sessionId).run();
    return json(result);
  }catch(e){console.error(e);return fail('Unable to check answer.',500)}
}
