// Same-origin Cloudflare Pages proxy for the isolated CABAL Quiz staging API.
// Keeps the browser on cabal-ranking.pages.dev and retains all quiz data in D1 staging.
const API_ORIGIN='https://cabal-quiz-api-staging.seavein.workers.dev';
const ALLOWED=new Set(['health','leaderboard','start','answer','finish','record']);
export async function onRequest({request,params}) {
  const path=Array.isArray(params.path)?params.path.join('/'):String(params.path||'');
  if (!ALLOWED.has(path)) return Response.json({error:'Not found'},{status:404});
  if (!['GET','POST','OPTIONS'].includes(request.method)) return Response.json({error:'Method not allowed'},{status:405});
  const destination=new URL('/api/quiz/'+path+new URL(request.url).search,API_ORIGIN);
  try {
    const upstream=new Request(destination,request);
    const result=await fetch(upstream);
    const headers=new Headers(result.headers);
    headers.set('cache-control','no-store');
    return new Response(result.body,{status:result.status,headers});
  } catch(e) {
    console.error('Quiz proxy request failed',e);
    return Response.json({error:'Quiz API proxy unavailable'},{status:502,headers:{'cache-control':'no-store'}});
  }
}
