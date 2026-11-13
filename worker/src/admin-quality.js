// Authenticated, read-only QA scanner. No automatic moderation or deletion.
const reply=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const columns='id,category_vi,category_en,subtopic_en,question_vi,question_en,option_a,option_b,option_c,option_d,correct';
const clauses={
 excluded_topic:"(LOWER(TRIM(category_en)) IN ('skill','skills','myth','merit','overload mastery','olv','stellar force','stellar','awakened aura','force wing','wing','wings') OR LOWER(category_en) LIKE '%dungeon%monster%')",
 hidden_stats:"(LOWER(question_en) LIKE '%monster% hp%' OR LOWER(question_en) LIKE '%boss% hp%' OR LOWER(question_en) LIKE '%mob% hp%' OR LOWER(question_en) LIKE '%how much hp%' OR LOWER(question_en) LIKE '%monster defense%' OR LOWER(question_vi) LIKE '%bao nhiêu hp%')",
 drop_rate:"(LOWER(question_en) LIKE '%exact drop rate%' OR LOWER(question_en) LIKE '%drop probability%' OR LOWER(question_en) LIKE '%drop rate of%' OR LOWER(question_vi) LIKE '%tỉ lệ rơi%' OR LOWER(question_vi) LIKE '%tỷ lệ rơi%')",
 english_units:"(LOWER(question_en) LIKE '%giây%' OR LOWER(question_en) LIKE '%phút%' OR LOWER(option_a) LIKE '%giây%' OR LOWER(option_b) LIKE '%giây%' OR LOWER(option_c) LIKE '%giây%' OR LOWER(option_d) LIKE '%giây%' OR LOWER(option_a) LIKE '%phút%' OR LOWER(option_b) LIKE '%phút%' OR LOWER(option_c) LIKE '%phút%' OR LOWER(option_d) LIKE '%phút%')",
 punctuation:"(INSTR(question_en,'???')>0 OR INSTR(question_en,'??')>0 OR INSTR(question_vi,'???')>0 OR INSTR(question_vi,'??')>0)",
 too_long:"(LENGTH(question_en)>185 OR LENGTH(question_vi)>200 OR LENGTH(option_a)>110 OR LENGTH(option_b)>110 OR LENGTH(option_c)>110 OR LENGTH(option_d)>110)",
 duplicate:"(LOWER(TRIM(question_en)) IN (SELECT LOWER(TRIM(question_en)) FROM quiz_questions GROUP BY LOWER(TRIM(question_en)) HAVING COUNT(*)>1))"
};
export async function handleQualityAdmin(request,db,action,url){
 try{
  if(request.method==='GET'&&action==='quality/summary'){
   const keys=Object.keys(clauses);
   const query='SELECT COUNT(*) AS total,'+keys.map(k=>'SUM(CASE WHEN '+clauses[k]+' THEN 1 ELSE 0 END) AS '+k).join(',')+' FROM quiz_questions';
   const [count,cat]=await Promise.all([db.prepare(query).first(),db.prepare('SELECT category_en,COUNT(*) AS n FROM quiz_questions GROUP BY category_en ORDER BY n DESC').all()]);
   return reply({total:Number(count?.total||0),flags:Object.fromEntries(keys.map(k=>[k,Number(count?.[k]||0)])),categories:cat.results||[],warning:'Flags are review candidates, not proof of incorrect questions.'});
  }
  if(request.method==='GET'&&action==='quality/items'){
   const issue=String(url.searchParams.get('issue')||'');
   if(!Object.prototype.hasOwnProperty.call(clauses,issue))return reply({error:'Unknown audit filter'},400);
   const page=Math.min(2000,Math.max(1,Number(url.searchParams.get('page'))||1));
   const where=clauses[issue];
   const [count,items]=await Promise.all([db.prepare('SELECT COUNT(*) AS n FROM quiz_questions WHERE '+where).first(),db.prepare('SELECT '+columns+' FROM quiz_questions WHERE '+where+' ORDER BY id LIMIT 60 OFFSET ?').bind((page-1)*60).all()]);
   return reply({issue,page,total:Number(count?.n||0),rows:items.results||[]});
  }
  return reply({error:'Quality route not found'},404);
 }catch(e){console.error('Quality audit',e);return reply({error:'Quality scan failed. Check Worker logs.'},500)}
}
