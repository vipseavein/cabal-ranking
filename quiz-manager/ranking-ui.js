// Private Player Ranking & Emails, including auditable record maintenance.
// Uses the admin-token-protected API supplied by the parent Question Manager.
window.mountPrivateRankings=function(api){
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=ms=>{const sec=Math.floor(Math.max(0,Number(ms))/1000);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')};
 let page=1,rows=[],total=0,preview=null;
 function status(s,err=false){$('adminRankingStatus').textContent=s;$('adminRankingStatus').style.borderColor=err?'#c34b62':'#286180'}
 async function load(){
  status('Đang tải bảng xếp hạng riêng tư...');
  const params=new URLSearchParams({size:$('adminRankSize').value,period:$('adminRankPeriod').value,page:String(page),q:$('adminRankSearch').value.trim()});
  try{
   const d=await api('rankings?'+params);
   rows=d.rows||[];total=Number(d.total)||0;
   $('adminRankingRows').innerHTML=rows.map((r,i)=>'<tr><td>#'+r.rank+'</td><td>'+esc(r.playerName)+'</td><td>'+(r.email?'<span class="contact-private">'+esc(r.email)+'</span>':'<span class="muted">Không cung cấp</span>')+'</td><td>'+r.score+'/'+r.total+'</td><td>'+fmt(r.durationMs)+'</td><td>'+new Date(r.completedAt).toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})+'</td><td><button type="button" class="danger-btn" data-remove-index="'+i+'">Xóa dòng</button></td></tr>').join('')||'<tr><td colspan="7">Chưa có kết quả phù hợp.</td></tr>';
   document.querySelectorAll('[data-remove-index]').forEach(btn=>btn.onclick=()=>prepareSingle(rows[Number(btn.dataset.removeIndex)]));
   $('adminRankingPage').textContent='Trang '+page+' / '+Math.max(1,Math.ceil(total/50));
   $('adminRankPrev').disabled=page<=1;$('adminRankNext').disabled=page*50>=total;
   status('Đã tải '+rows.length+' / '+total+' người chơi. Email chỉ có trong giao diện quản trị.');
  }catch(e){status('Lỗi tải Ranking: '+e.message,true)}
 }
 async function prepare(mode,payload){
  preview=null;$('adminDeletePreview').hidden=true;
  try{
   status('Đang xác định danh sách record bị ảnh hưởng...');
   const p=await api('rankings/delete-preview',{method:'POST',body:JSON.stringify({mode,size:Number($('adminRankSize').value),...payload})});
   preview=p;
   $('adminDeletePreview').hidden=false;
   $('adminDeleteSummary').textContent='Dự kiến xóa '+p.total+' record của '+({15:'High',30:'Highest',50:'Ultimate'}[p.size])+(p.key?' • '+p.key:'')+'. Dữ liệu được lưu vào lịch sử xóa. Chưa có thay đổi nào.';
   $('adminDeleteExamples').innerHTML=(p.examples||[]).map(r=>'<tr><td>'+esc(r.playerName)+'</td><td>'+r.score+'/'+r.total+'</td><td>'+fmt(r.durationMs)+'</td><td>'+new Date(r.completedAt).toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})+'</td></tr>').join('')||'<tr><td colspan="4">Không có record để xóa.</td></tr>';
   $('adminDeleteConfirmText').value='';
   $('adminDeleteConfirmLabel').textContent='Nhập DELETE '+p.total+' để xác nhận';
   $('adminDeleteExecute').disabled=p.total===0;
   status(p.total+' record khớp bộ lọc. Bạn cần xác nhận lần nữa để xóa.');
  }catch(e){status('Không thể xem trước: '+e.message,true)}
 }
 function prepareSingle(row){
  if(!row?.sessionId)return status('Record này không có ID để xóa.',true);
  prepare('single',{sessionId:row.sessionId});
 }
 $('adminDeletePreviewBtn').onclick=()=>{
  const mode=$('adminDeleteMode').value;
  const val=$('adminDeletePeriodKey').value.trim();
  if(mode==='day'&&!/^\d{4}-\d{2}-\d{2}$/.test(val))return status('Ngày phải là YYYY-MM-DD (GMT+7).',true);
  if(mode==='month'&&!/^\d{4}-\d{2}$/.test(val))return status('Tháng phải là YYYY-MM.',true);
  prepare(mode,{key:val});
 };
 $('adminDeleteExecute').onclick=async()=>{
  if(!preview)return;
  const confirmation=$('adminDeleteConfirmText').value.trim();
  if(confirmation!=='DELETE '+preview.total)return status('Chưa nhập đúng DELETE '+preview.total,true);
  if(!confirm('Xóa '+preview.total+' record ở cấp '+({15:'High',30:'Highest',50:'Ultimate'}[preview.size])+'? Các record sẽ được lưu bản sao trong lịch sử xóa.'))return;
  $('adminDeleteExecute').disabled=true;
  try{
   const result=await api('rankings/delete-confirm',{method:'POST',body:JSON.stringify({previewId:preview.previewId,confirmation})});
   status('Đã xóa '+result.removed+' record trên STAGING. Archive batch: '+result.archiveBatch);
   $('adminDeletePreview').hidden=true;preview=null;page=1;await load();
  }catch(e){status('Xóa thất bại: '+e.message,true);$('adminDeleteExecute').disabled=false}
 };
 $('adminDeleteCancel').onclick=()=>{preview=null;$('adminDeletePreview').hidden=true;status('Đã đóng bản xem trước; chưa xóa record nào.')};
 $('adminDeleteHistoryBtn').onclick=async()=>{
  try{
   const d=await api('rankings/delete-history');
   $('adminDeleteHistory').hidden=false;
   $('adminDeleteHistoryRows').innerHTML=(d.rows||[]).map(x=>'<tr><td>'+new Date(x.deleted_at).toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})+'</td><td>'+esc(x.reason)+'</td><td>'+x.count+'</td><td><code>'+esc(x.batch_id)+'</code></td></tr>').join('')||'<tr><td colspan="4">Chưa xóa record nào.</td></tr>';
  }catch(e){status('Không xem được lịch sử: '+e.message,true)}
 };
 $('adminDeleteMode').onchange=()=>{
   const mode=$('adminDeleteMode').value;
   $('adminDeletePeriodKey').placeholder=mode==='day'?'YYYY-MM-DD': 'YYYY-MM';
   $('adminDeletePeriodKey').value='';
   $('adminDeletePreview').hidden=true;preview=null;
 };
 $('adminRankRefresh').onclick=()=>{page=1;load()};
 for(const id of ['adminRankSize','adminRankPeriod'])$(id).onchange=()=>{page=1;$('adminDeletePreview').hidden=true;preview=null;load()};
 $('adminRankSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();page=1;load()}};
 $('adminRankPrev').onclick=()=>{page--;load()};
 $('adminRankNext').onclick=()=>{page++;load()};
 return {load};
};