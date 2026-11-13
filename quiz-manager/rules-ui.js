// Mounted only after successful admin-token authentication. Token stays in parent closure.
window.mountQuizRules=function(api){
 const $=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 let loaded=false,available=[],rules=null,version=null,history=[];
 const counts=[15,30,50];
 const defaultNames=['skill','skills','myth','merit','stellar force','stellar','overload mastery','olv','wing','wings','wing system','wing mastery'];
 function state(s,isErr){$('rulesStatus').textContent=s;$('rulesStatus').style.borderColor=isErr?'#aa4151':'#286180'}
 function readForm(){
   const topics=[...document.querySelectorAll('#rulesTopics input:checked')].map(x=>x.value);
   const quotas=Object.fromEntries(counts.map(size=>[size,Number($('ruleQuota'+size).value)]));
   if(!topics.length)throw Error('Chọn ít nhất một chủ đề');
   for(const size of counts)if(!Number.isInteger(quotas[size])||quotas[size]<0||quotas[size]>size)throw Error('Giới hạn không hợp lệ ở mức '+size);
   return {topics,quotas};
 }
 function updateTiers(){
   for(const size of counts){
     const n=Number($('ruleQuota'+size).value);
     $('ruleRest'+size).textContent=Number.isInteger(n)&&n>=0&&n<=size?(size-n)+' câu khác':'Không hợp lệ';
   }
 }
 function renderForm(){
   const selected=new Set((rules?.topics||[]).map(x=>x.toLowerCase()));
   const unknown=(rules?.topics||[]).filter(x=>!available.some(a=>a.name.toLowerCase()===x.toLowerCase()));
   $('rulesTopics').innerHTML=available.map(x=>'<label class="topic-option"><input type="checkbox" value="'+safe(x.name)+'" '+(selected.has(x.name.toLowerCase())?'checked':'')+'><span>'+safe(x.name)+'</span><small>'+x.count+' câu</small></label>').join('');
   $('rulesUnmatched').textContent=unknown.length?'Tên chủ đề cũ không còn trong D1: '+unknown.join(', ')+'. Những tên này sẽ được bỏ khỏi cấu hình khi bạn lưu.':'';
   for(const size of counts)$('ruleQuota'+size).value=rules.quotas[size];
   $('ruleVersion').textContent='Phiên bản '+version;
   document.querySelectorAll('#rulesTopics input').forEach(e=>e.addEventListener('change',()=>{state('Có thay đổi chưa lưu. Nhấn Xem trước để kiểm tra.');$('rulesPreview').hidden=true}));
   counts.forEach(size=>$('ruleQuota'+size).addEventListener('input',()=>{updateTiers();$('rulesPreview').hidden=true}));
   updateTiers();
 }
 async function init(){
   if(loaded)return;loaded=true;
   try{
     state('Đang tải quy tắc từ D1...');
     const [categories,current]=await Promise.all([api('categories'),api('rules')]);
     available=(categories.rows||[]).map(x=>({name:x.category_en,count:Number(x.n)}));
     rules=current.rules;version=current.version;renderForm();
     state('Đã tải cấu hình hiện tại. Quy tắc mới chỉ ảnh hưởng lượt Quiz bắt đầu sau khi lưu.');
     displayPreview(current.preview);
   }catch(e){loaded=false;state('Không tải được Rules: '+e.message,true)}
 }
 function displayPreview(data){
   $('rulesPreview').hidden=false;
   const good=!!data.valid;
   $('rulesPreviewSummary').textContent='D1: '+data.total+' câu • Nhóm chọn: '+data.availableSpecial+' câu • Còn lại: '+data.availableGeneral+' câu'+(good?' • Có thể áp dụng':' • KHÔNG đủ câu');
   $('rulesPreviewRows').innerHTML=(data.tiers||[]).map(x=>'<tr><td>'+({15:'High',30:'Highest',50:'Ultimate'}[x.size])+'</td><td>'+x.size+'</td><td>'+x.special+'</td><td>'+x.general+'</td><td>'+(x.valid?'Đủ dữ liệu':'Thiếu câu')+'</td></tr>').join('');
   $('rulesCategorySummary').textContent=(data.categoryCounts||[]).map(x=>x.category_en+' ('+x.count+')').join(' • ')||'Không có chủ đề được chọn';
   $('rulesPreview').dataset.valid=good?'1':'0';
 }
 $('rulesPreviewBtn').onclick=async()=>{
   try{const draft=readForm();state('Đang kiểm tra cấu hình...');const p=await api('rules/preview',{method:'POST',body:JSON.stringify(draft)});
     displayPreview(p);if(!p.categoryValidation?.valid)state('Tên chủ đề không hợp lệ: '+p.categoryValidation.invalid.join(', '),true);
     else state(p.valid?'Xem trước thành công. Bạn có thể lưu.':'Không đủ câu cho phân bổ này.',!p.valid);
   }catch(e){state(e.message,true)}
 };
 $('rulesSaveBtn').onclick=async()=>{
   try{
     const draft=readForm();
     const preview=await api('rules/preview',{method:'POST',body:JSON.stringify(draft)});
     displayPreview(preview);
     if(!preview.valid||!preview.categoryValidation?.valid)throw Error('Quy tắc không hợp lệ hoặc không đủ câu. Xem trước để điều chỉnh.');
     if(!confirm('Lưu quy tắc lên D1 STAGING? Chỉ ảnh hưởng những lượt chơi MỚI; không thay đổi điểm hiện có.'))return;
     const d=await api('rules',{method:'PUT',body:JSON.stringify({rules:draft,expectedVersion:version})});
     rules=d.rules;version=d.version;renderForm();state('Đã lưu quy tắc phiên bản '+version+' vào STAGING. Worker áp dụng ngay cho lượt chơi mới.');
   }catch(e){state('Không thể lưu: '+e.message,true)}
 };
 $('rulesReloadBtn').onclick=async()=>{loaded=false;await init()};
 $('rulesHistoryBtn').onclick=async()=>{
   try{const h=await api('rules/history');history=h.rows||[];
     $('rulesHistory').hidden=false;
     $('rulesHistoryRows').innerHTML=history.map((x,i)=>'<tr><td>'+new Date(x.changed_at).toLocaleString('vi-VN')+'</td><td>v'+x.version+'</td><td>'+safe(x.action)+'</td><td><button type="button" class="secondary" data-rollback="'+i+'" '+(!x.before_json?'disabled':'')+'>Khôi phục bản trước</button></td></tr>').join('')||'<tr><td colspan="4">Chưa có thay đổi</td></tr>';
     document.querySelectorAll('[data-rollback]').forEach(el=>el.onclick=async()=>{
       const row=history[Number(el.dataset.rollback)];
       if(!confirm('Khôi phục cấu hình TRƯỚC thay đổi v'+row.version+'? Thao tác này sẽ tạo thêm một phiên bản mới.'))return;
       try{const d=await api('rules/rollback',{method:'POST',body:JSON.stringify({revisionId:row.id,expectedVersion:version})});
         rules=d.rules;version=d.version;renderForm();$('rulesHistory').hidden=true;
         state('Đã khôi phục thành v'+version+'. Chỉ áp dụng cho lượt Quiz mới.');
       }catch(e){state('Khôi phục thất bại: '+e.message,true)}
     });
   }catch(e){state('Không tải được lịch sử: '+e.message,true)}
 };
 return {init};
};