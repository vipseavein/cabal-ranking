const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
const tiers=[15,30,50];
export async function handleAdminTimers(request,db,action){
 try{
  if(request.method==='GET'&&action==='timers'){
   const r=await db.prepare('SELECT tier_size,seconds,version,updated_at FROM quiz_tier_timers ORDER BY tier_size').all();
   return json({tiers:r.results||[],minSeconds:5,maxSeconds:120,note:'New sessions only. Existing sessions keep their original limit.'});
  }
  if(request.method==='PUT'&&action==='timers'){
   const body=await request.json();
   if(!body||!Array.isArray(body.tiers)||body.tiers.length!==3)return json({error:'Exactly 3 tiers required'},400);
   const map=new Map();
   for(const row of body.tiers){
    const size=Number(row.size),seconds=Number(row.seconds),version=Number(row.expectedVersion);
    if(!tiers.includes(size)||map.has(size)||!Number.isInteger(seconds)||seconds<5||seconds>120||!Number.isInteger(version)||version<1)return json({error:'Tier invalid or seconds must be 5–120'},400);
    map.set(size,{seconds,version});
   }
   const existing=await db.prepare('SELECT tier_size,seconds,version FROM quiz_tier_timers ORDER BY tier_size').all();
   const old=existing.results||[];
   if(old.length!==3)return json({error:'Timer configuration table not initialized'},503);
   if(old.some(x=>Number(x.version)!==map.get(Number(x.tier_size)).version))return json({error:'Timer config was changed. Reload before saving.'},409);
   const timestamp=Date.now(),newRows=old.map(x=>({tier_size:x.tier_size,seconds:map.get(Number(x.tier_size)).seconds,version:Number(x.version)+1}));
   const commands=old.map(x=>db.prepare('UPDATE quiz_tier_timers SET seconds=?,version=?,updated_at=? WHERE tier_size=? AND version=?')
    .bind(map.get(Number(x.tier_size)).seconds,Number(x.version)+1,timestamp,Number(x.tier_size),Number(x.version)));
   commands.push(db.prepare('INSERT INTO quiz_tier_timer_audit(id,before_json,after_json,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),JSON.stringify(old),JSON.stringify(newRows),timestamp));
   await db.batch(commands);
   return json({ok:true,tiers:newRows});
  }
  if(request.method==='GET'&&action==='timers/history'){
   const r=await db.prepare('SELECT id,before_json,after_json,created_at FROM quiz_tier_timer_audit ORDER BY created_at DESC LIMIT 30').all();
   return json({rows:r.results||[]});
  }
  return json({error:'Unknown timer action'},404);
 }catch(e){console.error('Admin timer:',e);return json({error:e.message||'Timer error'},400)}
}
