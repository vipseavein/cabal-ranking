const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(error,status=400)=>json({error},status);

function isoWeekKey(ms){const d=new Date(ms+7*3600000);const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y=x.getUTCFullYear(),y0=new Date(Date.UTC(y,0,1)),w=Math.ceil((((x-y0)/86400000)+1)/7);return `${y}-W${String(w).padStart(2,'0')}`}
function keys(ms=Date.now()){const d=new Date(ms+7*3600000),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();return{day:`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,week:isoWeekKey(ms),month:`${y}-${String(m).padStart(2,'0')}`,year:String(y)}}
export async function onRequestGet({request,env}){
  try{
    if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);
    const u=new URL(request.url),period=u.searchParams.get('period')||'all',size=Number(u.searchParams.get('size')||100);
    if(!['all','day','week','month','year'].includes(period))return fail('Invalid period.');
    if(![20,50,100].includes(size))return fail('Quiz size must be 20, 50, or 100.');
    const k=keys(),fields={day:'day_key',week:'week_key',month:'month_key',year:'year_key'};
    let clauses=['total=?'],bind=[size];
    if(period!=='all'){clauses.push(`${fields[period]}=?`);bind.push(k[period])}
    const where='WHERE '+clauses.join(' AND ');
    const sql=`WITH best AS (
      SELECT player_name,player_name_key,score,total,duration_ms,completed_at,
      ROW_NUMBER() OVER (PARTITION BY player_name_key ORDER BY score DESC,duration_ms ASC,completed_at ASC) AS rn
      FROM quiz_results ${where}
    )
    SELECT player_name,score,total,duration_ms,completed_at
    FROM best WHERE rn=1 ORDER BY score DESC,duration_ms ASC,completed_at ASC LIMIT 100`;
    const res=await env.QUIZ_DB.prepare(sql).bind(...bind).all();
    return json({period,size,tier:size===20?'High':size===50?'Highest':'Ultimate',key:period==='all'?null:k[period],rows:(res.results||[]).map((x,i)=>({rank:i+1,playerName:x.player_name,score:x.score,total:x.total,durationMs:x.duration_ms,completedAt:x.completed_at}))});
  }catch(e){console.error(e);return fail('Unable to load leaderboard.',500)}
}
