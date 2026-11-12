const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(error,status=400)=>json({error},status);

const BANK_SIZE=15000, TTL_MS=3*60*60*1000, ALLOWED_SIZES=[20,50,100];
const LETTERS=['A','B','C','D'];
function randomInt(max){const r=new Uint32Array(1);crypto.getRandomValues(r);return r[0]%max}
function randomIds(count){const a=Array.from({length:BANK_SIZE},(_,i)=>i+1);for(let i=0;i<count;i++){const j=i+randomInt(BANK_SIZE-i);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,count).map(n=>'Q'+String(n).padStart(5,'0'))}
function shuffleQuestion(q){
  const canonical={A:q.option_a,B:q.option_b,C:q.option_c,D:q.option_d};
  const order=[...LETTERS];
  for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]]}
  const options={}; let correctLetter='A';
  LETTERS.forEach((publicLetter,i)=>{const originalLetter=order[i];options[publicLetter]=canonical[originalLetter];if(originalLetter===q.correct)correctLetter=publicLetter});
  return {
    public:{id:q.id,category_vi:q.category_vi,category_en:q.category_en,subtopic_vi:q.subtopic_vi,subtopic_en:q.subtopic_en,difficulty_vi:q.difficulty_vi,difficulty_en:q.difficulty_en,question_vi:q.question_vi,question_en:q.question_en,options},
    private:{id:q.id,correctLetter,correctAnswer:canonical[q.correct]}
  };
}
export async function onRequestPost({request,env}){
  try{
    if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
    let body={};try{body=await request.json()}catch(_){}
    const count=Number(body.count||100);
    if(!ALLOWED_SIZES.includes(count))return fail('Quiz size must be 20, 50, or 100.');
    const ids=randomIds(count), marks=ids.map(()=>'?').join(',');
    const res=await env.QUIZ_DB.prepare(`SELECT id,category_vi,category_en,subtopic_vi,subtopic_en,difficulty_vi,difficulty_en,question_vi,question_en,option_a,option_b,option_c,option_d,correct FROM quiz_questions WHERE id IN (${marks})`).bind(...ids).all();
    if(!res.success||res.results.length!==count)return fail('Question bank is not fully seeded (expected 15,000 questions).',503);
    const map=new Map(res.results.map(x=>[x.id,x]));
    const shuffled=ids.map(id=>shuffleQuestion(map.get(id)));
    const now=Date.now(),sessionId=crypto.randomUUID();
    await env.QUIZ_DB.prepare('INSERT INTO quiz_sessions (id,question_ids,answers_json,started_at,expires_at,completed,recorded,total) VALUES (?,?,?,?,?,0,0,?)')
      .bind(sessionId,JSON.stringify(shuffled.map(x=>x.private)),'{}',now,now+TTL_MS,count).run();
    return json({sessionId,questionCount:count,tier:count===20?'High':count===50?'Highest':'Ultimate',questions:shuffled.map(x=>x.public)});
  }catch(e){console.error(e);return fail('Unable to create quiz session.',500)}
}
