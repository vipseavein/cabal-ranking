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
export async function pickQuestions(db,count,columns){
  const {rules}=await getRules(db),{sql,params}=topicClause(rules),quota=rules.quotas[count];
  if(!Number.isInteger(quota))throw Error('Rule not configured for this quiz size');
  const special=quota?await db.prepare('SELECT '+columns+' FROM quiz_questions WHERE '+sql+' ORDER BY RANDOM() LIMIT ?').bind(...params,quota).all():{success:true,results:[]};
  const generalCount=count-quota;
  const general=generalCount?await db.prepare('SELECT '+columns+' FROM quiz_questions WHERE NOT ('+sql+') ORDER BY RANDOM() LIMIT ?').bind(...params,generalCount).all():{success:true,results:[]};
  if(!special.success||!general.success||special.results.length!==quota||general.results.length!==generalCount)throw Error('Question bank does not have enough questions for current quiz rules');
  return [...special.results,...general.results];
}
