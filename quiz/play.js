(()=>{
'use strict';
const API=(window.CABAL_QUIZ_API_BASE||'')+'/api/quiz';
const LANGKEY='cabalRankingQuizLang';
const STORE='cabalQuizTieredActiveTimedV3';
const QUESTION_LIMIT_MS=15000;
const LETTERS=['A','B','C','D'];
const localizedOption=value=>{const text=String(value??'');return lang==='en'?text.replace(/(\d+(?:[.,]\d+)?)\s+giây\b/gi,(_,n)=>n+' '+(Number(n)===1?'second':'seconds')).replace(/(\d+(?:[.,]\d+)?)\s+phút\b/gi,(_,n)=>n+' '+(Number(n)===1?'minute':'minutes')).replace(/\bgiây\b/gi,'seconds').replace(/\bphút\b/gi,'minutes'):text;};
let lang=localStorage.getItem(LANGKEY)||'en';
let questionDeadline=0,autoTimeoutPending=false,advancing=false;
let typedName=localStorage.getItem('cabalQuizLastName')||'',typedEmail='',nameStatus=null,nameChecking=false,nameCheckSeq=0,nameCheckTimer=null;
let phase='home',sessionId=null,questions=[],current=0,feedback={},startedClientAt=0,finishResult=null,savedResult=null,answering=false,finishing=false,saving=false,reviewOpen=false,reviewFilter='wrong',error='';

try{
  const s=JSON.parse(sessionStorage.getItem(STORE)||'null');
  if(s?.sessionId&&Array.isArray(s.questions)&&[15,30,50].includes(s.questions.length)){
    ({sessionId,questions,current,feedback,startedClientAt,finishResult,savedResult,phase,questionDeadline}=s);
    reviewOpen=false; reviewFilter='wrong';
  }
}catch(_){ }

const t=(vi,en)=>lang==='vi'?vi:en;
const h=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const tier=n=>n===15?'High':n===30?'Highest':'Ultimate';
const fmt=ms=>{const sec=Math.max(0,Math.floor(ms/1000)),m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};
const scoreNow=()=>Object.values(feedback).filter(x=>x?.isCorrect).length;
function persist(){if(!sessionId)return;sessionStorage.setItem(STORE,JSON.stringify({sessionId,questions,current,feedback,startedClientAt,finishResult,savedResult,phase,questionDeadline}))}
function clearPersist(){sessionStorage.removeItem(STORE)}
async function api(path,options={}){const r=await fetch(API+path,{headers:{'content-type':'application/json',...(options.headers||{})},...options});let d={};try{d=await r.json()}catch(_){ }if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
function toast(msg){let el=document.getElementById('quizToast');if(!el){el=document.createElement('div');el.id='quizToast';el.className='quiz-toast';document.body.appendChild(el)}el.textContent=msg;el.style.display='block';clearTimeout(el._t);el._t=setTimeout(()=>el.style.display='none',3200)}
function langButtons(){return `<div class="quiz-lang"><button class="quiz-btn ${lang==='en'?'active':''}" data-lang="en">EN</button><button class="quiz-btn ${lang==='vi'?'active':''}" data-lang="vi">VI</button></div>`}
function tierCard(n,label,descVi,descEn){return `<article class="quiz-tier-card tier-${n}"><div class="quiz-tier-badge">${label}</div><div class="quiz-tier-count">${n}</div><div class="quiz-tier-label">${t('câu hỏi','questions')}</div><p>${t(descVi,descEn)}</p><button class="quiz-btn primary quiz-tier-start" data-start-size="${n}">${t('Bắt đầu','Start')} ${label}</button></article>`}
function home(){return `<div class="quiz-page-shell"><section class="quiz-page-hero"><div><div class="quiz-kicker">CABAL KNOWLEDGE CHALLENGE</div><h1>${t('Thử thách kiến thức CABAL','CABAL Knowledge Challenge')}</h1><p>${t('Chọn cấp độ theo số lượng câu hỏi. Mỗi lượt lấy câu ngẫu nhiên từ ngân hàng 15.000 câu và vị trí A/B/C/D được xáo trộn lại.','Choose a tier by question count. Every attempt draws random questions from the 15,000-question bank and reshuffles A/B/C/D positions.')}</p></div>${langButtons()}</section><section class="quiz-tier-grid">${tierCard(15,'High','Nhanh, phù hợp để luyện tập hoặc chơi hằng ngày.','Fast mode for practice and daily play.')}${tierCard(30,'Highest','Cân bằng giữa độ dài, kiến thức và tốc độ.','Balanced challenge for knowledge and speed.')}${tierCard(50,'Ultimate','Bài kiểm tra đầy đủ dành cho người chơi CABAL nhiều kinh nghiệm.','Full challenge for experienced CABAL players.')}</section><div class="quiz-page-info"><div><b>${t('15 giây mỗi câu','15 seconds per question')}</b><span>${t('Mỗi câu tự động hết giờ sau 15 giây.','Each question automatically times out after 15 seconds.')}</span></div><div><b>${t('Xếp hạng riêng','Separate rankings')}</b><span>High • Highest • Ultimate</span></div><div><b>${t('Ưu tiên điểm và thời gian','Score + time')}</b><span>${t('Điểm cao trước, cùng điểm thì thời gian nhanh hơn.','Higher score first; faster time breaks ties.')}</span></div></div></div>`}
function loading(){return `<div class="quiz-page-shell"><div class="quiz-card quiz-loading"><div class="quiz-spinner"></div><b>${t('Đang tạo câu hỏi ngẫu nhiên…','Creating random questions…')}</b><div class="quiz-note">${t('Vị trí đáp án đang được xáo trộn cho lượt này.','Answer positions are being shuffled for this attempt.')}</div></div></div>`}
function question(){const q=questions[current];if(!q)return home();const fb=feedback[q.id];const elapsed=Date.now()-startedClientAt;const answered=Object.keys(feedback).length;return `<div class="quiz-page-shell"><div class="quiz-card quiz-question-card"><div class="quiz-play-header"><div><div class="quiz-pills"><span class="quiz-tier-badge compact">${tier(questions.length)}</span><span class="quiz-pill">${h(lang==='vi'?q.category_vi:q.category_en)}</span>${(lang==='vi'?q.subtopic_vi:q.subtopic_en)?`<span class="quiz-pill">${h(lang==='vi'?q.subtopic_vi:q.subtopic_en)}</span>`:''}<span class="quiz-pill">${h(lang==='vi'?q.difficulty_vi:q.difficulty_en)}</span></div><div class="quiz-title">${h(lang==='vi'?q.question_vi:q.question_en)}</div></div><div class="quiz-live-stats"><div class="quiz-countdown-stat"><b id="quizCountdown" class="quiz-countdown ${!fb&&questionDeadline-Date.now()<=5000?'urgent':''}">${fb?'✓':String(Math.max(0,Math.ceil((questionDeadline-Date.now())/1000))).padStart(2,'0')}s</b><small>${t('Còn lại','Time left')}</small></div><div><b id="quizTimer">${fmt(elapsed)}</b><small>${t('Tổng thời gian','Total time')}</small></div><div><b>${scoreNow()}</b><small>${t('Điểm','Score')}</small></div></div></div><div class="quiz-progress"><span style="width:${((current+1)/questions.length)*100}%"></span></div><div class="quiz-meta"><span>${t('Câu','Question')} ${current+1} / ${questions.length}</span><span>${answered}/${questions.length} ${t('đã trả lời','answered')}</span></div><div class="quiz-options">${LETTERS.map(L=>{let cls='';if(fb){if(L===fb.correctLetter)cls='correct';else if(L===fb.answer&&!fb.isCorrect)cls='wrong';else cls='locked'}return `<button class="quiz-option ${cls}" data-answer="${L}" ${fb||answering||Date.now()>=questionDeadline?'disabled':''}><span class="quiz-letter">${L}</span><span>${h(localizedOption(q.options[L]))}</span></button>`}).join('')}</div>${fb?`<div class="quiz-feedback ${fb.isCorrect?'ok':'bad'}"><div class="quiz-feedback-icon">${fb.isCorrect?'✓':'✕'}</div><div><b>${fb.timedOut?t('Hết thời gian!','Time is up!'):fb.isCorrect?t('Chính xác!','Correct!'):t('Chưa chính xác','Incorrect')}</b><span>${t('Đáp án đúng','Correct answer')}: <strong>${fb.correctLetter}</strong> — ${h(localizedOption(fb.correctAnswer))}</span></div></div>`:''}<div class="quiz-play-footer"><button type="button" class="quiz-btn quiz-cancel" id="cancelQuiz">✕ ${t('Hủy','Cancel')}</button>${langButtons()}<button class="quiz-btn primary" id="nextQuestion" ${fb?'':'disabled'}>${current===questions.length-1?t('Hoàn thành bài','Finish Quiz'):t('Câu tiếp theo','Next Question')} →</button></div></div></div>`}
function reviewRows(){const arr=questions.map((q,i)=>({q,i,fb:feedback[q.id]})).filter(x=>reviewFilter==='all'||!x.fb?.isCorrect);if(!arr.length)return `<div class="quiz-review-empty">${t('Không có câu trả lời sai. Xuất sắc!','No incorrect answers. Excellent!')}</div>`;return arr.map(({q,i,fb})=>`<article class="quiz-review-item ${fb?.isCorrect?'ok':'bad'}"><div class="quiz-review-num">#${i+1}</div><div class="quiz-review-body"><h4>${h(lang==='vi'?q.question_vi:q.question_en)}</h4><div class="quiz-review-answer"><span>${t('Bạn chọn','Your answer')}: <b>${fb?.answer||'—'}</b>${fb?.answer?` — ${h(localizedOption(q.options[fb.answer]))}`:''}</span><span class="quiz-review-correct">${t('Đáp án đúng','Correct answer')}: <b>${fb?.correctLetter||'—'}</b>${fb?.correctAnswer?` — ${h(localizedOption(fb.correctAnswer))}`:''}</span></div></div></article>`).join('')}

function bestLine(b){return !b?'':t('Hạng #','Rank #')+b.rank+'  •  '+b.score+'/'+b.total+'  •  '+fmt(b.durationMs)}
function recordSavedBanner(){
 const kind=savedResult?.comparison;
 const badge=kind==='improved'?'★':kind==='not_improved'?'●':'✓';
 const msg=kind==='improved'?t('Chúc mừng! Bạn đã phá kỷ lục '+savedResult.tier+' của mình.','Congratulations! You broke your '+savedResult.tier+' record!'):
  kind==='not_improved'?t('Kỷ lục cũ vẫn tốt hơn, thứ hạng của bạn được giữ nguyên.','Your previous best remains on the leaderboard.'):
  t('Đã lưu kỷ lục đầu tiên ở cấp độ '+savedResult.tier+'.','Your first '+savedResult.tier+' record is saved!');
 return '<div class="quiz-record-saved '+h(kind)+'"><span>'+badge+'</span><div><b>'+h(msg)+'</b><small>'+h(savedResult.playerName)+' • '+h(bestLine(savedResult.best))+'</small></div></div>';
}
function recordSaveCard(){
 const size=finishResult?.total||15;
 const tierName=tier(size);
 return '<section class="quiz-record-focus tier-'+size+'" id="recordCard">'+
  '<div class="quiz-record-heading"><div class="quiz-record-icon">★</div><div><div class="quiz-record-eyebrow">'+t('BƯỚC CUỐI CÙNG • LƯU THÀNH TÍCH','FINAL STEP • SAVE YOUR RESULT')+'</div>'+
  '<h2>'+t('Lưu thành tích của bạn','Save your ranking record')+'</h2>'+
  '<p>'+t('Nhập Name / IGN để ghi nhận kỷ lục tốt nhất trong cấp độ '+tierName+'.','Enter your Name / IGN to keep your best '+tierName+' result.')+'</p></div><span class="quiz-record-tier">'+h(tierName)+'</span></div>'+
  (error?'<div class="quiz-error">'+h(error)+'</div>':'')+
  '<div class="quiz-record-fields"><div class="quiz-record-main"><label for="playerName">'+t('NAME / IGN • BẮT BUỘC','NAME / IGN • REQUIRED')+'</label>'+
  '<input id="playerName" class="quiz-input quiz-record-name" maxlength="32" autocomplete="nickname" value="'+h(typedName)+'" placeholder="'+t('Nhập tên nhân vật…','Enter your character name…')+'"></div>'+
  '<div class="quiz-record-email"><label for="playerEmail">'+t('EMAIL • KHÔNG BẮT BUỘC','EMAIL • OPTIONAL')+'</label>'+
  '<input id="playerEmail" class="quiz-input" type="email" maxlength="254" autocomplete="email" inputmode="email" value="'+h(typedEmail)+'" placeholder="'+t('Email để đối chiếu giải thưởng','For event verification only')+'"></div></div>'+
  '<div id="quizNameStatus" class="quiz-record-status" role="status" aria-live="polite"></div>'+
  '<div class="quiz-record-bottom"><span>🔒 '+t('Email không công khai trên Ranking. Mỗi IGN chỉ hiển thị kỷ lục tốt nhất ở từng cấp độ.','Email stays private. Each IGN shows only its best result per tier.')+'</span>'+
  '<button class="quiz-btn primary quiz-record-submit" id="saveRecord" '+(saving||typedName.trim().length<2?'disabled':'')+'>'+ (saving?t('Đang lưu…','Saving…'):t('Lưu vào Ranking','Save my ranking'))+' →</button></div></section>';
}
function renderNameStatus(){
 const el=document.getElementById('quizNameStatus');
 if(!el)return;
 const entered=typedName.trim();
 if(entered.length<2){el.className='quiz-record-status neutral';el.innerHTML='⌨ '+t('Nhập Name / IGN (ít nhất 2 ký tự) để kiểm tra kỷ lục.','Type your Name / IGN (at least 2 characters) to check your record.');return;}
 if(nameChecking){el.className='quiz-record-status neutral';el.textContent=t('Đang kiểm tra kỷ lục…','Checking existing record…');return;}
 if(!nameStatus){el.className='quiz-record-status neutral';el.textContent=t('Đang xác minh tên nhân vật…','Checking character name…');return;}
 const info=nameStatus,old=info.best;
 if(info.comparison==='new'){el.className='quiz-record-status fresh';el.innerHTML='✓ <strong>'+t('Chưa có kỷ lục '+tier(info.current.total)+' cho tên này.','No existing '+tier(info.current.total)+' record for this name.')+'</strong> '+t('Bạn có thể lưu thành tích đầu tiên.','You can save your first record.');return;}
 const detail='<span class="quiz-record-old">'+h(bestLine(old))+'</span>';
 if(info.comparison==='improved'){
  el.className='quiz-record-status improved';
  el.innerHTML='★ <strong>'+t('Chúc mừng! Bạn đã phá kỷ lục '+info.tier+'!','Congratulations! You beat your '+info.tier+' record!')+'</strong> '+detail;
 }else{
  el.className='quiz-record-status existing';
  el.innerHTML='● <strong>'+t('Tên này đã có kỷ lục ở '+info.tier+'.','This name already exists in '+info.tier+' rankings.')+'</strong> '+detail+' '+t('Kết quả cũ vẫn tốt hơn.','The existing record remains better.');
 }
}
async function checkName(){
 const name=typedName.replace(/\s+/g,' ').trim(),seq=++nameCheckSeq;
 if(name.length<2||!finishResult){nameStatus=null;nameChecking=false;renderNameStatus();return;}
 nameChecking=true;nameStatus=null;renderNameStatus();
 try{
  const data=await api('/player-status?name='+encodeURIComponent(name)+'&size='+finishResult.total+'&sessionId='+encodeURIComponent(sessionId),{method:'GET'});
  if(seq!==nameCheckSeq||phase!=='completed')return;
  nameStatus=data;
 }catch(e){
  if(seq!==nameCheckSeq)return;
  nameStatus=null;toast(t('Không thể kiểm tra tên. Vẫn có thể thử lưu.','Could not check name. You can still try saving.'));
 }finally{if(seq===nameCheckSeq){nameChecking=false;renderNameStatus()}}
}
function bindNameCard(){
 const nameInput=document.getElementById('playerName'),emailInput=document.getElementById('playerEmail');
 if(!nameInput)return;
 nameInput.addEventListener('input',()=>{
  typedName=nameInput.value;nameStatus=null;nameChecking=false;
  clearTimeout(nameCheckTimer);nameCheckSeq++;
  const button=document.getElementById('saveRecord');if(button)button.disabled=saving||typedName.trim().length<2;
  renderNameStatus();
  if(typedName.trim().length>=2)nameCheckTimer=setTimeout(checkName,420);
 });
 emailInput?.addEventListener('input',()=>{typedEmail=emailInput.value});
 renderNameStatus();
 if(typedName.trim().length>=2&&!nameStatus&&!nameChecking){clearTimeout(nameCheckTimer);nameCheckTimer=setTimeout(checkName,300)}
}

function completed(){if(!finishResult)return home();const pct=Math.round(finishResult.score/finishResult.total*100),saved=!!savedResult;return `<div class="quiz-page-shell"><section class="quiz-card quiz-finish-card"><div class="quiz-celebrate">✦</div><div class="quiz-kicker">${t('HOÀN THÀNH','COMPLETED')} • ${finishResult.tier}</div><h1>${t('Chúc mừng! Bạn đã hoàn thành bài trắc nghiệm.','Congratulations! You completed the quiz.')}</h1><div class="quiz-result-grid"><div><b>${finishResult.score}/${finishResult.total}</b><span>${t('Điểm','Score')}</span></div><div><b>${pct}%</b><span>${t('Chính xác','Accuracy')}</span></div><div><b>${fmt(finishResult.durationMs)}</b><span>${t('Thời gian','Time')}</span></div><div><b>#${savedResult?.rank||finishResult.rank}</b><span>${saved?t('Xếp hạng','Ranking'):t('Xếp hạng tạm tính','Provisional rank')}</span></div></div>${saved?recordSavedBanner():recordSaveCard()}<div class="quiz-finish-actions"><button class="quiz-btn" id="toggleReview">${reviewOpen?t('Ẩn đáp án','Hide Review'):t('Xem câu trả lời đúng','Review Correct Answers')}</button><button class="quiz-btn primary" id="newQuiz">${t('Làm lượt mới','New Quiz')}</button><button class="quiz-btn" type="button" id="viewRanking">${t('Xem Ranking','View Ranking')} ↓</button>${langButtons()}</div></section>${reviewOpen?`<section class="quiz-card quiz-review"><div class="quiz-review-head"><div><div class="quiz-kicker">${t('XEM LẠI ĐÁP ÁN','ANSWER REVIEW')}</div><h2>${t('Kiểm tra những câu bạn đã trả lời','Review your answers')}</h2></div><div class="quiz-tabs"><button class="quiz-btn ${reviewFilter==='wrong'?'active':''}" data-review-filter="wrong">${t('Chỉ câu sai','Incorrect only')}</button><button class="quiz-btn ${reviewFilter==='all'?'active':''}" data-review-filter="all">${t('Tất cả câu','All questions')}</button></div></div>${reviewRows()}</section>`:''}</div>`}
function render(){if(phase==='loading')return loading();if(phase==='quiz')return question();if(phase==='completed'||phase==='saved')return completed();return home()}
function renderApp(){document.getElementById('quizApp').innerHTML=render();bind();window.CABAL_QUIZ_BOARD?.show(phase!=='quiz'&&phase!=='loading')}
async function start(n){phase='loading';error='';renderApp();try{const d=await api('/start',{method:'POST',body:JSON.stringify({count:n})});sessionId=d.sessionId;questions=d.questions||[];current=0;feedback={};startedClientAt=Date.now();questionDeadline=Number(d.questionDeadline)||Date.now()+QUESTION_LIMIT_MS;autoTimeoutPending=false;finishResult=null;savedResult=null;phase='quiz';persist();renderApp()}catch(e){phase='home';renderApp();toast(e.message||t('Không thể bắt đầu Quiz.','Unable to start quiz.'))}}
async function answer(letter){
 const q=questions[current];
 if(!q||feedback[q.id]||answering)return;
 answering=true;renderApp();
 try{
   const d=await api('/answer',{method:'POST',body:JSON.stringify({sessionId,questionId:q.id,answer:letter})});
   feedback[q.id]=d;persist();
   if(d.timedOut){autoTimeoutPending=true;setTimeout(()=>{autoTimeoutPending=false;if(phase==='quiz'&&feedback[q.id])next()},850)}
 }catch(e){toast(e.message||t('Không thể kiểm tra đáp án.','Unable to check answer.'))}
 finally{answering=false;renderApp()}
}
async function next(){
 const q=questions[current];
 if(!feedback[q?.id]||advancing)return;
 if(current<questions.length-1){
   advancing=true;
   try{
     const d=await api('/advance',{method:'POST',body:JSON.stringify({sessionId})});
     current=Number(d.questionIndex);
     questionDeadline=Number(d.questionDeadline);
     autoTimeoutPending=false;persist();renderApp();
   }catch(e){toast(e.message||t('Không thể chuyển câu.','Unable to advance.'))}
   finally{advancing=false}
   return;
 }
 if(finishing)return;finishing=true;renderApp();
 try{finishResult=await api('/finish',{method:'POST',body:JSON.stringify({sessionId})});phase='completed';persist()}
 catch(e){toast(e.message||t('Không thể hoàn thành bài.','Unable to finish quiz.'))}
 finally{finishing=false;renderApp()}
}
function clockTick(){
 if(phase!=='quiz')return;
 const q=questions[current],fb=q&&feedback[q.id];
 const cd=document.getElementById('quizCountdown');
 if(cd){
   const remaining=Math.max(0,questionDeadline-Date.now());
   cd.textContent=fb?'✓':String(Math.ceil(remaining/1000)).padStart(2,'0')+'s';
   cd.classList.toggle('urgent',!fb&&remaining<=5000);
 }
 const elapsed=document.getElementById('quizTimer');
 if(elapsed)elapsed.textContent=fmt(Date.now()-startedClientAt);
 if(q&&!fb&&!answering&&!advancing&&!autoTimeoutPending&&questionDeadline&&Date.now()>=questionDeadline){
   autoTimeoutPending=true;
   answer('TIMEOUT');
 }
}
async function save(){
 const name=typedName.replace(/\s+/g,' ').trim(),email=typedEmail.trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast(t('Email không hợp lệ.','Invalid email address.'));return;}
 if(name.length<2){toast(t('Name cần ít nhất 2 ký tự.','Name must contain at least 2 characters.'));document.getElementById('playerName')?.focus();return;}
 if(saving)return;
 saving=true;error='';clearTimeout(nameCheckTimer);nameCheckSeq++;renderApp();
 try{
  savedResult=await api('/record',{method:'POST',body:JSON.stringify({sessionId,playerName:name,email})});
  localStorage.setItem('cabalQuizLastName',name);phase='saved';clearPersist();
 }catch(e){error=e.message||t('Không thể lưu Record.','Unable to save record.');phase='completed';persist()}
 finally{saving=false;renderApp();if(savedResult)window.CABAL_QUIZ_BOARD?.load()}
}
function setLang(v){clearTimeout(nameCheckTimer);nameCheckSeq++;lang=v==='vi'?'vi':'en';localStorage.setItem(LANGKEY,lang);renderApp()}
function reset(){clearTimeout(nameCheckTimer);nameCheckSeq++;nameStatus=null;typedEmail='';clearPersist();phase='home';sessionId=null;questions=[];current=0;feedback={};finishResult=null;savedResult=null;reviewOpen=false;error='';questionDeadline=0;autoTimeoutPending=false;renderApp()}
function bind(){document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));document.querySelectorAll('[data-start-size]').forEach(b=>b.onclick=()=>start(+b.dataset.startSize));document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answer(b.dataset.answer));const n=document.getElementById('nextQuestion');if(n)n.onclick=next;const s=document.getElementById('saveRecord');if(s){s.onclick=save;bindNameCard();}const nq=document.getElementById('newQuiz');if(nq)nq.onclick=reset;const cancel=document.getElementById('cancelQuiz');if(cancel)cancel.onclick=()=>{if(confirm(t('Hủy lượt chơi hiện tại? Kết quả chưa lưu sẽ mất.','Cancel this attempt? Unsaved progress will be lost.')))reset()};const rank=document.getElementById('viewRanking');if(rank)rank.onclick=()=>{window.CABAL_QUIZ_BOARD?.load();document.getElementById('quizLeaderboard')?.scrollIntoView({behavior:'smooth',block:'start'})};const tr=document.getElementById('toggleReview');if(tr)tr.onclick=()=>{reviewOpen=!reviewOpen;renderApp()};document.querySelectorAll('[data-review-filter]').forEach(b=>b.onclick=()=>{reviewFilter=b.dataset.reviewFilter;renderApp()});if(phase==='quiz'){clearInterval(bind._tick);bind._tick=setInterval(clockTick,100);clockTick()}else clearInterval(bind._tick)}
renderApp();
const requestedTier=Number(new URLSearchParams(location.search).get('size'));
if(phase==='home'&&[15,30,50].includes(requestedTier))start(requestedTier);
})();
