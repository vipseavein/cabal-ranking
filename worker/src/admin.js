import {handleRulesAdmin} from './admin-rules.js';
// Protected Quiz Question Manager API. Secrets are never returned to frontend.
const FIELDS=['category_vi','category_en','subtopic_vi','subtopic_en','difficulty_vi','difficulty_en','question_vi','question_en','option_a','option_b','option_c','option_d','correct'];
const REQUIRED=['category_vi','category_en','question_vi','question_en','option_a','option_b','option_c','option_d','correct'];
const SELECT='id,'+FIELDS.join(',');
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
async function authorized(request,env){
  const secret=env.QUIZ_ADMIN_TOKEN;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!secret||!supplied||supplied.length>1024)return false;
  // Compare hashes rather than variable-time raw string comparisons.
  const dig=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([dig(secret),dig(supplied)]);
  let xor=0;for(let i=0;i<a.length;i++)xor|=a[i]^b[i];
  return xor===0;
}
function clean(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid row');
  const id=String(input.id||'').trim();
  if(!/^Q\d{5,8}$/.test(id))throw Error('ID must be Q followed by 5-8 digits');
  const row={id};
  for(const key of FIELDS)row[key]=String(input[key]??'').trim();
  row.correct=row.correct.toUpperCase();
  if(REQUIRED.some(key=>!row[key]))throw Error(id+': missing required field');
  if(!['A','B','C','D'].includes(row.correct))throw Error(id+': correct must be A/B/C/D');
  for(const key of FIELDS)if(row[key].length>5000)throw Error(id+': field too long '+key);
  return row;
}
async function audit(db,action,id,oldValue,newValue){
  // Store only revisions; no admin tokens or login information.
  await db.prepare('INSERT INTO quiz_admin_audit (id,action,question_id,before_json,after_json,changed_at) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),action,id,oldValue?JSON.stringify(oldValue):null,JSON.stringify(newValue),Date.now()).run();
}
export async function handleAdmin(request,env,url){
  // Block cross-site browser requests, even when they happen to include an admin token.
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return reply({error:'Cross-origin admin access denied'},403);
  if(!await authorized(request,env))return reply({error:'Admin token missing or invalid. Configure QUIZ_ADMIN_TOKEN in staging Worker secrets.'},401);
  const db=env.QUIZ_DB;if(!db)return reply({error:'Database binding missing'},500);
  const action=url.pathname.slice('/api/quiz/admin/'.length);
  try{
    if(action==='rules'||action.startsWith('rules/'))return await handleRulesAdmin(request,db,action);
    if(request.method==='GET'&&action==='ping')return reply({ok:true,environment:'staging',writeEnabled:true});
    if(request.method==='GET'&&action==='questions'){
      const query=(url.searchParams.get('q')||'').trim().slice(0,120);
      const cat=(url.searchParams.get('category')||'').trim().slice(0,100);
      const page=Math.max(1,Math.min(10000,Number(url.searchParams.get('page'))||1));
      const where=[],params=[];
      if(query){where.push('(id LIKE ? OR question_en LIKE ? OR question_vi LIKE ?)');params.push(...Array(3).fill('%'+query+'%'))}
      if(cat){where.push('category_en=?');params.push(cat)}
      const sqlWhere=where.length?' WHERE '+where.join(' AND '):'';
      const [total,rows]=await Promise.all([
        db.prepare('SELECT COUNT(*) AS n FROM quiz_questions'+sqlWhere).bind(...params).first(),
        db.prepare('SELECT '+SELECT+' FROM quiz_questions'+sqlWhere+' ORDER BY id LIMIT 40 OFFSET ?').bind(...params,(page-1)*40).all()
      ]);
      return reply({total:Number(total?.n||0),page,rows:rows.results||[]});
    }
    if(request.method==='GET'&&action==='categories'){
      const rows=await db.prepare('SELECT category_en,COUNT(*) AS n FROM quiz_questions GROUP BY category_en ORDER BY category_en').all();
      return reply({rows:rows.results||[]});
    }
    if(request.method==='PUT'&&action==='question'){
      const row=clean(await request.json());
      const old=await db.prepare('SELECT '+SELECT+' FROM quiz_questions WHERE id=?').bind(row.id).first();
      if(!old)return reply({error:'ID not found. Use import with create mode to insert new IDs.'},404);
      await db.prepare('UPDATE quiz_questions SET '+FIELDS.map(k=>k+'=?').join(',')+' WHERE id=?').bind(...FIELDS.map(k=>row[k]),row.id).run();
      await audit(db,'update',row.id,old,row);
      return reply({ok:true,id:row.id});
    }
    if(request.method==='POST'&&action==='import'){
      const input=await request.json();
      const raw=input.rows;
      if(!Array.isArray(raw)||!raw.length||raw.length>40)return reply({error:'Batch must contain 1-40 records'},400);
      if(!['upsert','update'].includes(input.mode))return reply({error:'mode must be upsert or update'},400);
      const rows=raw.map(clean),ids=new Set();
      for(const row of rows){if(ids.has(row.id))throw Error('Duplicate ID in batch: '+row.id);ids.add(row.id)}
      // Validate the entire chunk before writing anything.
      const previous=await db.prepare('SELECT '+SELECT+' FROM quiz_questions WHERE id IN ('+rows.map(()=>'?').join(',')+')').bind(...rows.map(r=>r.id)).all();
      const exists=new Map((previous.results||[]).map(x=>[x.id,x]));
      if(input.mode==='update'&&rows.some(r=>!exists.has(r.id)))return reply({error:'Update-only mode: unknown ID detected'},409);
      const sql=input.mode==='upsert'
        ?'INSERT INTO quiz_questions ('+SELECT+') VALUES ('+Array(1+FIELDS.length).fill('?').join(',')+') ON CONFLICT(id) DO UPDATE SET '+FIELDS.map(x=>x+'=excluded.'+x).join(',')
        :'UPDATE quiz_questions SET '+FIELDS.map(x=>x+'=?').join(',')+' WHERE id=?';
      const commands=rows.map(row=>db.prepare(sql).bind(...(input.mode==='upsert'?[row.id,...FIELDS.map(x=>row[x])]:[...FIELDS.map(x=>row[x]),row.id])));
      // Batch executes atomically in D1. Audit included in the same transaction.
      for(const row of rows){
        commands.push(db.prepare('INSERT INTO quiz_admin_audit (id,action,question_id,before_json,after_json,changed_at) VALUES (?,?,?,?,?,?)')
          .bind(crypto.randomUUID(),exists.has(row.id)?'import-update':'import-new',row.id,exists.has(row.id)?JSON.stringify(exists.get(row.id)):null,JSON.stringify(row),Date.now()));
      }
      await db.batch(commands);
      return reply({ok:true,created:rows.filter(r=>!exists.has(r.id)).length,updated:rows.filter(r=>exists.has(r.id)).length});
    }
    if(request.method==='GET'&&action==='history'){
      const id=(url.searchParams.get('id')||'').slice(0,40);
      if(!/^Q\d{5,8}$/.test(id))return reply({error:'Invalid ID'},400);
      const results=await db.prepare('SELECT id,action,question_id,before_json,after_json,changed_at FROM quiz_admin_audit WHERE question_id=? ORDER BY changed_at DESC LIMIT 30').bind(id).all();
      return reply({rows:results.results||[]});
    }
    return reply({error:'Admin route not found'},404);
  }catch(e){console.error('Quiz Admin',e);return reply({error:e?.message||'Request failed'},400)}
}
