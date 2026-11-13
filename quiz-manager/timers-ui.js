window.mountTierTimers=function(api){
 const $=id=>document.getElementById(id);
 let loaded=false,versions={};
 const n=[15,30,50];
 const name={15:'High',30:'Highest',50:'Ultimate'};
 function show(msg,err=false){$('tierTimerStatus').textContent=msg;$('tierTimerStatus').style.borderColor=err?'#dd6570':'#3d7f9b'}
 async function load(){
  try{
   const result=await api('timers');
   for(const row of result.tiers){
     versions[row.tier_size]=row.version;
     $('tierTimer'+row.tier_size).value=row.seconds;
     $('tierTimerVersion'+row.tier_size).textContent='v'+row.version;
   }
   loaded=true;show('Đang áp dụng: '+result.tiers.map(x=>name[x.tier_size]+' '+x.seconds+' giây').join(' • ')+'. Thay đổi chỉ áp dụng cho lượt Quiz mới.');
  }catch(e){show('Không thể tải cấu hình: '+e.message,true)}
 }
 $('tierTimerSave').onclick=async()=>{
  try{
   if(!loaded)throw Error('Reload configuration first');
   const rows=n.map(size=>({size,seconds:Number($('tierTimer'+size).value),expectedVersion:versions[size]}));
   if(rows.some(x=>!Number.isInteger(x.seconds)||x.seconds<5||x.seconds>120))throw Error('Thời gian từ 5 tới 120 giây mỗi câu.');
   if(!confirm('Áp dụng thời gian mới cho 3 cấp độ trên D1 STAGING? Các lượt đang làm giữ thời hạn cũ.'))return;
   const response=await api('timers',{method:'PUT',body:JSON.stringify({tiers:rows})});
   response.tiers.forEach(row=>{versions[row.tier_size]=row.version;$('tierTimerVersion'+row.tier_size).textContent='v'+row.version});
   show('Đã lưu thành công. '+response.tiers.map(x=>name[x.tier_size]+': '+x.seconds+' giây').join(' • '));
  }catch(e){show('Lưu thất bại: '+e.message,true)}
 };
 $('tierTimerReload').onclick=load;
 $('tierTimerHistoryBtn').onclick=async()=>{
  try{
   const result=await api('timers/history');$('tierTimerHistory').hidden=false;
   $('tierTimerHistoryRows').innerHTML=(result.rows||[]).map(r=>{
     const old=JSON.parse(r.before_json||'[]'),current=JSON.parse(r.after_json||'[]');
     return '<tr><td>'+new Date(r.created_at).toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})+'</td><td>'+old.map(x=>name[x.tier_size]+' '+x.seconds+'s').join(' / ')+'</td><td>'+current.map(x=>name[x.tier_size]+' '+x.seconds+'s').join(' / ')+'</td></tr>';
   }).join('')||'<tr><td colspan="3">Chưa có lịch sử.</td></tr>';
  }catch(e){show('Không tải được lịch sử: '+e.message,true)}
 };
 return {load};
};