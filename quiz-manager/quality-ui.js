// Protected read-only quality overview and row-by-row review.
window.mountQuestionQuality=function(api){
 const $=id=>document.getElementById(id);
 const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={excluded_topic:'Excluded topics',hidden_stats:'Hidden monster stats',drop_rate:'Exact drop-rate claims',english_units:'VI units in English',punctuation:'Repeated punctuation',too_long:'Too long for timed Quiz',duplicate:'Exact duplicate EN'};
 let page=1,total=0,issue='hidden_stats',latestRows=[];
 const status=s=>$('qualityStatus').textContent=s;
 async function init(){
  status('Đang quét chất lượng toàn bộ D1 staging...');
  try{
   const data=await api('quality/summary');
   $('qualityTotal').textContent=Number(data.total||0).toLocaleString('vi-VN')+' câu được rà soát';
   $('qualityFlags').innerHTML=Object.keys(labels).map(k=>'<button type="button" class="quality-counter" data-issue="'+h(k)+'"><strong>'+Number(data.flags?.[k]||0)+'</strong><span>'+h(labels[k])+'</span></button>').join('');
   $('qualityCategories').textContent=(data.categories||[]).slice(0,25).map(x=>x.category_en+': '+x.n).join('  •  ');
   document.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>{issue=b.dataset.issue;page=1;load()});
   await load();
  }catch(e){status('Không thể quét D1: '+e.message)}
 }
 async function load(){
  status('Đang lọc '+labels[issue]+'...');
  try{
   const data=await api('quality/items?issue='+encodeURIComponent(issue)+'&page='+page);
   latestRows=data.rows||[];total=Number(data.total||0);
   $('qualityIssueTitle').textContent=labels[issue]+' — '+total+' câu cần xem xét';
   $('qualityRows').innerHTML=latestRows.map(r=>'<tr><td>'+h(r.id)+'</td><td>'+h(r.category_en)+'</td><td style="white-space:normal;min-width:380px">'+h(r.question_en)+'</td><td>'+h(r.correct)+'</td></tr>').join('')||'<tr><td colspan="4">Không có câu hỏi bị đánh dấu.</td></tr>';
   $('qualityPage').textContent='Trang '+page+'/'+Math.max(1,Math.ceil(total/60));
   $('qualityPrev').disabled=page<=1;$('qualityNext').disabled=page*60>=total;
   status('Đây là bộ lọc cảnh báo, chưa xác định câu nào sai. Không có thao tác xóa hoặc sửa tự động.');
  }catch(e){status('Lỗi: '+e.message)}
 }
 $('qualityPrev').onclick=()=>{page--;load()};
 $('qualityNext').onclick=()=>{page++;load()};
 $('qualityRefresh').onclick=init;
 $('qualityExport').onclick=async()=>{
  if(!total)return;
  if(total>15000)return status('Danh sách quá lớn, vui lòng lọc cụ thể.');
  if(!confirm('Xuất '+total+' câu được đánh dấu '+labels[issue]+' thành CSV trên máy của bạn?'))return;
  const head=['id','category_en','question_vi','question_en','option_a','option_b','option_c','option_d','correct'];
  const all=[];
  try{
   for(let n=1;n<=Math.ceil(total/60);n++){
    const d=await api('quality/items?issue='+encodeURIComponent(issue)+'&page='+n);
    all.push(...(d.rows||[]));
    status('Đang xuất '+all.length+'/'+total+' câu...');
   }
   const csv=[head,...all.map(r=>head.map(k=>String(r[k]??'')))].map(a=>a.map(x=>'"'+x.replace(/"/g,'""')+'"').join(',')).join('\r\n');
   const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='quiz-qa-'+issue+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
   status('Đã xuất '+all.length+' câu để kiểm duyệt. Không sửa D1.');
  }catch(e){status('Xuất CSV lỗi: '+e.message)}
 };
 return {init};
};