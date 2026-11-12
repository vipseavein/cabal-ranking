(()=>{
'use strict';
const root=document.getElementById('quizLeaderboard');
if(!root)return;
const apiRoot=(window.CABAL_QUIZ_API_BASE||'')+'/api/quiz';
const SIZE_LABEL={15:'High',30:'Highest',50:'Ultimate'};
let size=15,period='all',rows=[],loading=false,error='',visible=true,seq=0;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const vi=()=>localStorage.getItem('cabalRankingQuizLang')==='vi';
const t=(a,b)=>vi()?a:b;
const fmt=ms=>{let sec=Math.floor(Math.max(0,Number(ms)||0)/1000);return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`};
function render(){
if(!visible){root.hidden=true;return}root.hidden=false;
const sizes=[15,30,50].map(n=>`<button type="button" class="quiz-btn ${size===n?'active':''}" data-board-size="${n}">${SIZE_LABEL[n]} <small>${n}</small></button>`).join('');
const periods=[['all','Tất cả','Overall'],['day','Hôm nay','Daily'],['week','Tuần','Weekly'],['month','Tháng','Monthly'],['year','Năm','Yearly']].map(([k,v,e])=>`<button type="button" class="quiz-btn ${period===k?'active':''}" data-board-period="${k}">${t(v,e)}</button>`).join('');
const rowHtml=loading?`<tr><td colspan="5">${t('Đang tải...','Loading leaderboard...')}</td></tr>`:error?`<tr><td colspan="5" class="quiz-error">${esc(error)}</td></tr>`:rows.length?rows.map(r=>`<tr><td class="qrank">#${r.rank}</td><td class="name">${esc(r.playerName)}</td><td>${r.score}/${r.total}</td><td>${fmt(r.durationMs)}</td><td>${r.completedAt?new Intl.DateTimeFormat(vi()?'vi-VN':'en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(r.completedAt)):'—'}</td></tr>`).join(''):`<tr><td colspan="5">${t('Chưa có kỷ lục ở hạng này.','No records for this tier yet.')}</td></tr>`;
root.innerHTML=`<section class="quiz-card quiz-inline-board"><div class="quiz-board-header"><div><div class="quiz-kicker">CABAL KNOWLEDGE RANKING</div><h2>${t('Bảng xếp hạng Quiz','Quiz Leaderboard')} <span>${SIZE_LABEL[size]}</span></h2><p>${t('Điểm cao xếp trước, hòa điểm ưu tiên thời gian nhanh hơn.','Highest score first; faster time breaks ties.')} • GMT+7</p></div><button class="quiz-btn" id="boardRefresh" type="button">↻ ${t('Làm mới','Refresh')}</button></div><div class="quiz-board-controls">${sizes}</div><div class="quiz-tabs quiz-board-periods">${periods}</div><div class="tablewrap"><table class="ranktable quiz-lb-table"><thead><tr><th>#</th><th>IGN</th><th>${t('Điểm','Score')}</th><th>${t('Thời gian','Time')}</th><th>${t('Ngày','Date')}</th></tr></thead><tbody>${rowHtml}</tbody></table></div></section>`;
root.querySelectorAll('[data-board-size]').forEach(b=>b.onclick=()=>{size=Number(b.dataset.boardSize);load()});
root.querySelectorAll('[data-board-period]').forEach(b=>b.onclick=()=>{period=b.dataset.boardPeriod;load()});
root.querySelector('#boardRefresh').onclick=load;
}
async function load(){const my=++seq;loading=true;error='';render();try{const r=await fetch(`${apiRoot}/leaderboard?size=${size}&period=${encodeURIComponent(period)}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'HTTP '+r.status);if(my===seq)rows=Array.isArray(d.rows)?d.rows:[]}catch(e){if(my===seq){rows=[];error=e.message||'Unable to load leaderboard.'}}finally{if(my===seq){loading=false;render()}}}
function show(v){visible=!!v;render()}
window.CABAL_QUIZ_BOARD={load,show,render};
load();
})();
