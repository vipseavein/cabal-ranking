// Centralized Quiz selection rules, shared by gameplay and Question Manager.
// Rules live in D1 STAGING, not hardcoded into each deployment.
export const DEFAULT_RULES={
  topics:['Skill','Skills','Myth','Merit','Stellar Force','Stellar','Overload Mastery','OLV','Wing','Wings','Wing System','Wing Mastery'],
  quotas:{15:1,30:2,50:3}
};
export const RULE_SIZES=[15,30,50];
export function validateRules(input){
  if(!input||typeof input!=='object'||!Array.isArray(input.topics))throw Error('Choose at least one category');
  if(input.topics.length<1||input.topics.length>100)throw Error('Select 1 to 100 categories');
  const topics=[...new Set(input.topics.map(x=>String(x).trim()).filter(Boolean))];
  if(topics.length!==input.topics.length||topics.some(x=>x.length>120))throw Error('Invalid or duplicate categories');
  const quotas={};
  for(const size of RULE_SIZES){
    const n=input.quotas?.[size];
    if(!Number.isInteger(n)||n<0||n>size)throw Error('Quota for '+size+' must be an integer between 0 and '+size);
    quotas[size]=n;
  }
  return {topics,quotas};
}
export async function getRules(db){
  const row=await db.prepare('SELECT rules_json,version FROM quiz_rule_config WHERE id=1').first();
  if(!row)return {rules:DEFAULT_RULES,version:0};
  return {rules:validateRules(JSON.parse(row.rules_json)),version:Number(row.version)};
}
export function topicClause(rules){
  const keys=rules.topics.map(x=>x.toLowerCase());
  // Bind every category value; never interpolate admin input into SQL.
  return {
    sql:'LOWER(TRIM(category_en)) IN ('+keys.map(()=>'?').join(',')+')',
    params:keys
  };
}
export async function measureRules(db,rules){
  const {sql,params}=topicClause(rules);
  const [special,total]=await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM quiz_questions WHERE '+sql).bind(...params).first(),
    db.prepare('SELECT COUNT(*) AS n FROM quiz_questions').first()
  ]);
  const specials=Number(special?.n||0),totalRows=Number(total?.n||0),normal=totalRows-specials;
  const tiers=RULE_SIZES.map(size=>{
    const quota=rules.quotas[size];
    return {size,special:quota,general:size-quota,availableSpecial:specials,availableGeneral:normal,
      valid:specials>=quota&&normal>=size-quota};
  });
  return {total:totalRows,availableSpecial:specials,availableGeneral:normal,tiers,valid:tiers.every(x=>x.valid)};
}
// The old ORDER BY RANDOM() scanned ~30k-40k D1 rows PER SELECT.
// Pool + (pool_type,random_key,question_id) index seeks return only the requested rows.
// Small independent blocks improve question variety without scanning the bank.
const POOL_INDEX='idx_quiz_question_pool_type_random';
const RANDOM_SPACE=2147483647;
function randomCursor(){
  const b=new Uint32Array(1);crypto.getRandomValues(b);
  return b[0]%RANDOM_SPACE;
}
async function indexedBlock(db,poolType,columns,limit){
  const cursor=randomCursor();
  // columns is a developer-owned field list, never user input.
  const selected=columns.split(',').map(x=>'q.'+x.trim()).join(',');
  const prefix='SELECT '+selected+' FROM quiz_question_pool p INDEXED BY '+POOL_INDEX+
    ' JOIN quiz_questions q ON q.id=p.question_id WHERE p.pool_type=? AND p.random_key ';
  const first=await db.prepare(prefix+'>=? ORDER BY p.random_key,p.question_id LIMIT ?')
    .bind(poolType,cursor,limit).all();
  if(!first.success)throw Error('Indexed question pool lookup failed');
  const result=[...(first.results||[])];
  if(result.length<limit){
    const second=await db.prepare(prefix+'<? ORDER BY p.random_key,p.question_id LIMIT ?')
      .bind(poolType,cursor,limit-result.length).all();
    if(!second.success)throw Error('Indexed question pool wraparound lookup failed');
    result.push(...(second.results||[]));
  }
  return result;
}
async function samplePool(db,poolType,count,columns){
  if(count===0)return [];
  const chosen=new Map();
  // A maximum of 8 questions per index seek gives independently sampled sections.
  for(let attempt=0;chosen.size<count&&attempt<12;attempt++){
    const missing=count-chosen.size;
    const blocks=[],groups=Math.min(10,Math.ceil(missing/8));
    for(let j=0;j<groups;j++){
      const limit=Math.min(8,missing-j*8);
      blocks.push(indexedBlock(db,poolType,columns,limit));
    }
    const batch=await Promise.all(blocks);
    for(const rows of batch)for(const q of rows)if(!chosen.has(q.id))chosen.set(q.id,q);
  }
  if(chosen.size<count)throw Error('Not enough eligible questions in indexed pool. Check Rules and pool synchronization.');
  const result=[...chosen.values()];
  for(let i=result.length-1;i>0;i--){const j=randomCursor()%(i+1);[result[i],result[j]]=[result[j],result[i]];}
  return result.slice(0,count);
}
export async function pickQuestions(db,count,columns){
  const {rules}=await getRules(db),quota=rules.quotas[count];
  if(!Number.isInteger(quota)||quota<0||quota>count)throw Error('Rule not configured for this tier');
  const [special,general]=await Promise.all([
    samplePool(db,1,quota,columns),
    samplePool(db,0,count-quota,columns)
  ]);
  return [...special,...general];
}
