const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(error,status=400)=>json({error},status);

export async function onRequestGet({env}){try{if(!env.QUIZ_DB)return fail('QUIZ_DB binding is not configured.',500);const q=await env.QUIZ_DB.prepare('SELECT COUNT(*) AS n FROM quiz_questions').first();const r=await env.QUIZ_DB.prepare('SELECT COUNT(*) AS n FROM quiz_results').first();return json({ok:true,questionCount:Number(q?.n||0),resultCount:Number(r?.n||0),expectedQuestions:9999})}catch(e){console.error(e);return fail('Database unavailable.',500)}}
