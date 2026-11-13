// Private player rankings. Reuses the admin token retained in Question Manager's memory.
window.mountPrivateRankings=function(api){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=ms=>{const sec=Math.floor(Math.max(0,Number(ms))/1000);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')};
  let page=1,rows=[],total=0;
  async function load(){
    $('adminRankingStatus').textContent='Đang tải bảng xếp hạng riêng tư...';
    const params=new URLSearchParams({size:$('adminRankSize').value,period:$('adminRankPeriod').value,page:String(page),q:$('adminRankSearch').value.trim()});
    try{
      const data=await api('rankings?'+params);
      rows=data.rows||[];total=Number(data.total)||0;
      $('adminRankingRows').innerHTML=rows.map(r=>'<tr><td>#'+r.rank+'</td><td>'+esc(r.playerName)+'</td><td>'+(r.email?'<span class="contact-private">'+esc(r.email)+'</span>':'<span class="muted">Không cung cấp</span>')+'</td><td>'+r.score+'/'+r.total+'</td><td>'+fmt(r.durationMs)+'</td><td>'+new Date(r.completedAt).toLocaleString('vi-VN',{timeZone:'Asia/Bangkok'})+'</td></tr>').join('')||'<tr><td colspan="6">Chưa có kết quả phù hợp.</td></tr>';
      $('adminRankingPage').textContent='Trang '+page+' / '+Math.max(1,Math.ceil(total/50));
      $('adminRankPrev').disabled=page<=1;$('adminRankNext').disabled=page*50>=total;
      $('adminRankingStatus').textContent='Đã tải '+rows.length+' / '+total+' người chơi. Email chỉ có trong giao diện quản trị.';
    }catch(e){$('adminRankingStatus').textContent='Lỗi tải Ranking: '+e.message}
  }
  $('adminRankRefresh').onclick=()=>{page=1;load()};
  for(const id of ['adminRankSize','adminRankPeriod'])$(id).onchange=()=>{page=1;load()};
  $('adminRankSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();page=1;load()}};
  $('adminRankPrev').onclick=()=>{page--;load()};
  $('adminRankNext').onclick=()=>{page++;load()};
  return {load};
};
