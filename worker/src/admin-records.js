// Admin-only ranking record removal. Reuses QUIZ_ADMIN_TOKEN authentication in admin.js.
// Deletes are archived to D1 before removal, in one transaction per batch.
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const validTier=n=>[15,30,50].includes(n);
const validDay=s=>/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const validMonth=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
async function snapshot(db,mode,body){
 const size=Number(body.size);
 if(!validTier(size))throw Error('Invalid tier');
 if(mode==='single'){
  const id=String(body.sessionId||'');
  if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid record ID');
  const r=await db.prepare('SELECT * FROM quiz_results WHERE session_id=? AND total=?').bind(id,size).all();
  return {records:r.results||[],periodKey:null};
 }
 if(!['day','month'].includes(mode))throw Error('Choose single, day or month');
 const key=String(body.key||'');
 if(mode==='day'&&!validDay(key))throw Error('Invalid date. Use YYYY-MM-DD (GMT+7)');
 if(mode==='month'&&!validMonth(key))throw Error('Invalid month. Use YYYY-MM');
 const column=mode==='day'?'day_key':'month_key';
 const r=await db.prepare('SELECT * FROM quiz_results WHERE total=? AND '+column+'=? ORDER BY completed_at,session_id').bind(size,key).all();
 return {records:r.results||[],periodKey:key};
}
export async function handleRankingDelete(request,db,action){
 try{
  if(request.method==='POST'&&action==='rankings/delete-preview'){
   const body=await request.json(),mode=String(body.mode||'');
   const {records,periodKey}=await snapshot(db,mode,body);
   const previewId=crypto.randomUUID();
   const ids=records.map(x=>x.session_id);
   // Do not expose every affected record or private email in the preview response.
   await db.prepare('INSERT INTO quiz_delete_previews(id,session_ids,tier_size,mode,period_key,total,created_at,consumed) VALUES(?,?,?,?,?,?,?,0)')
     .bind(previewId,JSON.stringify(ids),Number(body.size),mode,periodKey,ids.length,Date.now()).run();
   return reply({previewId,mode,size:Number(body.size),key:periodKey,total:ids.length,examples:records.slice(0,8).map(r=>({sessionId:r.session_id,playerName:r.player_name,score:r.score,total:r.total,durationMs:r.duration_ms,completedAt:r.completed_at})),expiresInSeconds:300});
  }
  if(request.method==='POST'&&action==='rankings/delete-confirm'){
   const body=await request.json(),id=String(body.previewId||'');
   if(!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'Invalid preview token'},400);
   const preview=await db.prepare('SELECT * FROM quiz_delete_previews WHERE id=?').bind(id).first();
   if(!preview||preview.consumed)return reply({error:'Preview missing or already used. Refresh preview.'},409);
   if(Date.now()-Number(preview.created_at)>300000)return reply({error:'Preview expired. Create a new preview.'},410);
   if(body.confirmation!=='DELETE '+preview.total)return reply({error:'Type DELETE '+preview.total+' to confirm.'},400);
   const ids=JSON.parse(preview.session_ids||'[]');
   if(!Array.isArray(ids)||ids.length!==Number(preview.total)||ids.length>10000)return reply({error:'Invalid preview record count'},409);
   const archiveBatch=crypto.randomUUID();
   let removed=0;
   // Each slice has an atomic snapshot / deletion / marker update.
   for(let offset=0;offset<ids.length;offset+=30){
    const part=ids.slice(offset,offset+30);
    const rows=await db.prepare('SELECT * FROM quiz_results WHERE session_id IN ('+part.map(()=>'?').join(',')+') AND total=?').bind(...part,Number(preview.tier_size)).all();
    const found=rows.results||[];
    if(found.length!==part.length)return reply({error:'Ranking data changed since preview. Some records may already be deleted; check the archive.',removed,archiveBatch},409);
    const stmts=[];
    for(const rec of found)stmts.push(db.prepare('INSERT INTO quiz_deleted_records(id,session_id,record_json,reason,deleted_at,batch_id) VALUES(?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),rec.session_id,JSON.stringify(rec),preview.mode+(preview.period_key?':'+preview.period_key:''),Date.now(),archiveBatch));
    for(const rec of found)stmts.push(db.prepare('DELETE FROM quiz_results WHERE session_id=? AND total=?').bind(rec.session_id,Number(preview.tier_size)));
    await db.batch(stmts);
    removed+=found.length;
   }
   await db.prepare('UPDATE quiz_delete_previews SET consumed=1 WHERE id=? AND consumed=0').bind(id).run();
   return reply({ok:true,removed,archiveBatch,mode:preview.mode,size:preview.tier_size,key:preview.period_key});
  }
  if(request.method==='GET'&&action==='rankings/delete-history'){
   const r=await db.prepare('SELECT batch_id,COUNT(*) AS count,MIN(deleted_at) AS deleted_at,MIN(reason) AS reason FROM quiz_deleted_records GROUP BY batch_id ORDER BY deleted_at DESC LIMIT 30').all();
   return reply({rows:r.results||[]});
  }
  return reply({error:'Unknown management action'},404);
 }catch(e){console.error('Ranking management:',e);return reply({error:e.message||'Ranking change failed'},400)}
}
