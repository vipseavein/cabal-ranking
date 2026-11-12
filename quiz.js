(()=> {
'use strict';
const API='/api/quiz';
const LANGKEY='cabalRankingQuizLang';
let lang=localStorage.getItem(LANGKEY)||'en';
let size=100, period='all', rows=null, loading=false, error='';
const t=(vi,en)=>lang==='vi'?vi:en;
const h=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=ms=>{const sec=Math.max(0,Math.floor(ms/1000)),m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};
const rerender=()=>window.CABAL_RANKING_RENDER?.();
const tier=n=>n===20?'High':n===50?'Highest':'Ultimate';
async function api(path){const r=await fetch(API+path,{headers:{'cache-control':'no-cache'}});let d={};try{d=await r.json()}catch(_){ }if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
async function load(){
  loading=true;error='';rerender();
  try{const d=await api(`/leaderboard?period=${encodeURIComponent(period)}&size=${size}`);rows=d.rows||[]}
  catch(e){rows=[];error=e.message||'Unable to load leaderboard.'}
  finally{loading=false;rerender()}
}
function render(){
  const tierButtons=[[20,'High'],[50,'Highest'],[100,'Ultimate']].map(([n,l])=>`<button class="quiz-btn ${size===n?'active':''}" data-quiz-size="${n}"><b>${l}</b><span>${n} ${t('câu','questions')}</span></button>`).join('');
  const periods=[['all',t('Top tổng','Overall')],['day',t('Hôm nay','Daily')],['week',t('Tuần','Weekly')],['month',t('Tháng','Monthly')],['year',t('Năm','Yearly')]];
  let body='';
  if(loading)body=`<tr><td colspan="5">${t('Đang tải bảng xếp hạng…','Loading leaderboard…')}</td></tr>`;
  else if(!rows?.length)body=`<tr><td colspan="5">${t('Chưa có kết quả cho hạng này.','No results for this tier yet.')}</td></tr>`;
  else body=rows.map(r=>`<tr><td class="qrank">#${r.rank}</td><td class="name">${h(r.playerName)}</td><td><span class="score">${r.score}/${r.total}</span></td><td>${fmt(r.durationMs)}</td><td>${r.completedAt?new Intl.DateTimeFormat(lang==='vi'?'vi-VN':'en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(r.completedAt)):'—'}</td></tr>`).join('');
  return `<div class="quiz-ranking-shell">
    <div class="bar quiz-ranking-head">
      <div><div class="quiz-kicker">CABAL KNOWLEDGE RANKING</div><div class="title">${t('Bảng xếp hạng','Quiz Ranking')} <span>${tier(size)}</span></div><div class="meta">${t('Điểm cao trước, nếu bằng điểm thì thời gian nhanh hơn xếp trên.','Higher score ranks first; ties are broken by faster completion time.')} • GMT+7</div></div>
      <div class="quiz-actions"><a class="quiz-btn primary" href="/quiz/">${t('Làm Quiz','Play Quiz')} →</a><button class="quiz-btn" data-quiz-lang="${lang==='en'?'vi':'en'}">${lang==='en'?'VI':'EN'}</button></div>
    </div>
    <div class="quiz-tier-tabs">${tierButtons}</div>
    <div class="quiz-tabs">${periods.map(([p,l])=>`<button class="quiz-btn ${period===p?'active':''}" data-quiz-period="${p}">${l}</button>`).join('')}</div>
    ${error?`<div class="quiz-error">${h(error)}</div>`:''}
    <div class="tablewrap"><table class="ranktable quiz-lb-table"><thead><tr><th>#</th><th>Name</th><th>${t('Điểm','Score')}</th><th>${t('Thời gian','Time')}</th><th>${t('Hoàn thành','Completed')}</th></tr></thead><tbody>${body}</tbody></table></div>
    <div class="data-note">${t('High = 20 câu • Highest = 50 câu • Ultimate = 100 câu. Mỗi hạng có bảng Top tổng, ngày, tuần, tháng và năm riêng.','High = 20 questions • Highest = 50 • Ultimate = 100. Each tier has separate overall, daily, weekly, monthly and yearly rankings.')}</div>
  </div>`;
}
function bind(){
  document.querySelectorAll('[data-quiz-size]').forEach(b=>b.onclick=()=>{size=+b.dataset.quizSize;rows=null;load()});
  document.querySelectorAll('[data-quiz-period]').forEach(b=>b.onclick=()=>{period=b.dataset.quizPeriod;rows=null;load()});
  document.querySelectorAll('[data-quiz-lang]').forEach(b=>b.onclick=()=>{lang=b.dataset.quizLang;localStorage.setItem(LANGKEY,lang);rerender()});
  if(rows===null&&!loading)load();
}
function deactivate(){}
window.CABAL_QUIZ_RANKING={render,bind,deactivate};
})();
