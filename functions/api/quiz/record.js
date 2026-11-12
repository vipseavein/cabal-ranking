const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(error,status=400)=>json({error},status);
function cleanName(v){const s=String(v??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim();if(s.length<2||s.length>32)throw new Error('Name must be 2-32 characters.');return s}
function keyName(s){return s.normalize('NFKC').toLocaleLowerCase('en-US')}
function isoWeekKey(ms){const d=new Date(ms+7*3600000);const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y=x.getUTCFullYear(),y0=new Date(Date.UTC(y,0,1)),w=Math.ceil((((x-y0)/86400000)+1)/7);return `${y}-W${String(w).padStart(2,'0')}`}
function periodKeys(ms){const d=new Date(ms+7*3600000),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();return{dayKey:`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,weekKey:isoWeekKey(ms),monthKey:`${y}-${String(m).padStart(2,'0')}`,yearKey:String(y)}}
async function rankFor(env,total,score,durationMs){const r=await env.QUIZ_DB.prepare('SELECT COUNT(*) AS n FROM quiz_results WHERE total=? AND (score>? OR (score=? AND duration_ms<?))').bind(total,score,score,durationMs).first();return Number(r?.n||0)+1}
export async function onRequestPost({request,env}){
  try{
    if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
    const body=await request.json(),sessionId=String(body.sessionId||'').trim(),playerName=cleanName(body.playerName);
    const s=await env.QUIZ_DB.prepare('SELECT completed,recorded,score,total,duration_ms,completed_at FROM quiz_sessions WHERE id=?').bind(sessionId).first();
    if(!s)return fail('Quiz session not found.',404);
    if(!s.completed)return fail('Finish the quiz before saving a record.',409);
    if(s.recorded)return fail('This result was already saved.',409);
    const total=Number(s.total),score=Number(s.score),durationMs=Number(s.duration_ms),completedAt=Number(s.completed_at),p=periodKeys(completedAt);
    const insert=env.QUIZ_DB.prepare('INSERT INTO quiz_results (session_id,player_name,player_name_key,score,total,duration_ms,completed_at,day_key,week_key,month_key,year_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(sessionId,playerName,keyName(playerName),score,total,durationMs,completedAt,p.dayKey,p.weekKey,p.monthKey,p.yearKey);
    const update=env.QUIZ_DB.prepare('UPDATE quiz_sessions SET recorded=1 WHERE id=? AND recorded=0').bind(sessionId);
    await env.QUIZ_DB.batch([insert,update]);
    return json({saved:true,playerName,score,total,durationMs,rank:await rankFor(env,total,score,durationMs),tier:total===20?'High':total===50?'Highest':'Ultimate'});
  }catch(e){console.error(e);if(e?.message?.startsWith('Name must'))return fail(e.message);return fail('Unable to save quiz record.',500)}
}
