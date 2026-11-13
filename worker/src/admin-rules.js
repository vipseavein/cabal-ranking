import {getRules,validateRules,measureRules,topicClause,RULE_SIZES} from './rules.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function ensureCategories(db,rules){
  const actual=await db.prepare('SELECT DISTINCT category_en FROM quiz_questions').all();
  const found=new Set((actual.results||[]).map(x=>String(x.category_en).toLowerCase().trim()));
  const invalid=rules.topics.filter(x=>!found.has(x.toLowerCase()));
  // Allow legacy aliases for initial config, but require actual categories for edits.
  if(invalid.length)return {valid:false,invalid};
  return {valid:true,invalid:[]};
}
async function preview(db,rules){
  const stats=await measureRules(db,rules);
  const {sql,params}=topicClause(rules);
  const counts=await db.prepare('SELECT category_en,COUNT(*) AS count FROM quiz_questions WHERE '+sql+' GROUP BY category_en ORDER BY category_en').bind(...params).all();
  return {...stats,categoryCounts:counts.results||[]};
}
export async function handleRulesAdmin(request,db,action){
  try {
    if(request.method==='GET'&&action==='rules'){
      const current=await getRules(db);
      const info=await preview(db,current.rules);
      return json({...current,preview:info});
    }
    if(request.method==='GET'&&action==='rules/history'){
      const result=await db.prepare('SELECT id,version,action,before_json,after_json,changed_at FROM quiz_rule_history ORDER BY changed_at DESC LIMIT 30').all();
      return json({rows:result.results||[]});
    }
    if(request.method==='POST'&&action==='rules/preview'){
      const rules=validateRules(await request.json());
      const categories=await ensureCategories(db,rules);
      return json({rules,categoryValidation:categories,...await preview(db,rules)});
    }
    if(request.method==='PUT'&&action==='rules'){
      const input=await request.json();
      const rules=validateRules(input.rules);
      if(!Number.isInteger(input.expectedVersion))return json({error:'Version required'},400);
      const categories=await ensureCategories(db,rules);
      if(!categories.valid)return json({error:'Unknown categories: '+categories.invalid.join(', ')},400);
      const check=await preview(db,rules);
      if(!check.valid)return json({error:'Not enough questions for selected quotas',preview:check},409);
      const old=await getRules(db);
      if(old.version!==input.expectedVersion)return json({error:'Rules changed by another admin. Reload before saving.',version:old.version},409);
      const after=JSON.stringify(rules),before=JSON.stringify(old.rules);
      const version=old.version+1;
      const update=db.prepare('UPDATE quiz_rule_config SET rules_json=?,version=?,updated_at=? WHERE id=1 AND version=?').bind(after,version,Date.now(),old.version);
      const history=db.prepare('INSERT INTO quiz_rule_history(id,version,action,before_json,after_json,changed_at) VALUES(?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),version,'update',before,after,Date.now());
      await db.batch([update,history]);
      return json({ok:true,version,rules});
    }
    if(request.method==='POST'&&action==='rules/rollback'){
      const input=await request.json();
      const revision=String(input.revisionId||'');
      if(!/^[a-f0-9-]{36}$/i.test(revision))return json({error:'Invalid history ID'},400);
      if(!Number.isInteger(input.expectedVersion))return json({error:'Version required'},400);
      const row=await db.prepare('SELECT before_json FROM quiz_rule_history WHERE id=?').bind(revision).first();
      if(!row||!row.before_json)return json({error:'Revision cannot be restored'},404);
      const rules=validateRules(JSON.parse(row.before_json));
      const cats=await ensureCategories(db,rules);
      const check=await preview(db,rules);
      if(!cats.valid||!check.valid)return json({error:'Old rules no longer match available categories or question counts'},409);
      const old=await getRules(db);
      if(old.version!==input.expectedVersion)return json({error:'Rules changed by another admin. Reload.'},409);
      const newVersion=old.version+1;
      await db.batch([
        db.prepare('UPDATE quiz_rule_config SET rules_json=?,version=?,updated_at=? WHERE id=1 AND version=?').bind(JSON.stringify(rules),newVersion,Date.now(),old.version),
        db.prepare('INSERT INTO quiz_rule_history(id,version,action,before_json,after_json,changed_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),newVersion,'rollback',JSON.stringify(old.rules),JSON.stringify(rules),Date.now())
      ]);
      return json({ok:true,version:newVersion,rules});
    }
    return json({error:'Unknown rules endpoint'},404);
  } catch(e){console.error('Quiz rules:',e);return json({error:e.message||'Invalid rule'},400)}
}
