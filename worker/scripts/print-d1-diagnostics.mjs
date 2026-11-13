// Safe public-action log renderer for D1 analytics: never log raw SQL, bound data, tokens, IDs.
import {readFileSync} from 'node:fs';
const file=process.argv[2],label=process.argv[3]||'account',raw=readFileSync(file,'utf8');
let v;
try{v=JSON.parse(raw)}catch{console.log(label+': UNPARSEABLE_JSON; chars='+raw.length);process.exit(0)}
const rows=Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.results)?v.results:Array.isArray(v?.insights)?v.insights:[];
console.log('### D1 '+label+' | query_groups='+rows.length);
const known=['quiz_questions','quiz_results','quiz_sessions','quiz_rule_config','quiz_question_timers','quiz_session_limits','quiz_player_contacts','quiz_admin_audit','quiz_rule_history','quiz_tier_timers','quiz_delete_previews','quiz_deleted_records'];
for(let i=0;i<Math.min(20,rows.length);i++){
 const x=rows[i],q=String(x.query||'').toLowerCase();
 const tables=known.filter(t=>q.includes(t)).join('+')||'other';
 const op=q.trim().match(/^(with|select|insert|delete|update|create|pragma)/)?.[1]||'other';
 const numbers=['totalRowsRead','avgRowsRead','numberOfTimesRun','queryEfficiency','totalDurationMs'].map(k=>k+'='+Number(x[k]||0).toFixed(k==='queryEfficiency'?3:0)).join(' ');
 console.log('rank='+(i+1)+' type='+op+' tables='+tables+' '+numbers);
}
if(!rows.length)console.log('NO_QUERY_GROUPS_OR_UNRECOGNIZED_SHAPE keys='+Object.keys(v||{}).filter(k=>/^[a-zA-Z]{1,30}$/.test(k)).join(','));
