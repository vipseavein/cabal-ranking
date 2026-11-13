// Split SQL triggers into individual statements. Wrangler/D1 trigger-aware SQL parsing
// can fail when multiple CREATE TRIGGER bodies are shipped together.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const source=readFileSync('question-pool-triggers.sql','utf8');
const blocks=[...source.matchAll(/(CREATE TRIGGER[\s\S]*?END;)/g)].map(m=>m[1]);
if(blocks.length!==4)throw Error('Expected exactly four automatic pool-sync triggers; got '+blocks.length);
mkdirSync('.wrangler-pool-triggers',{recursive:true});
blocks.forEach((sql,i)=>writeFileSync('.wrangler-pool-triggers/'+String(i+1).padStart(2,'0')+'.sql',sql+'\n'));
console.log('Split '+blocks.length+' safe SQL trigger statements.');
