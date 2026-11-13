// Full D1 question-bank backup. Runs in authenticated Manager session only.
// Stream pages from the Worker; never exposes the admin token in files.
window.mountQuestionExport=function(api){
 const $=id=>document.getElementById(id);
 let inProgress=false;
 const fields=['id','category_vi','category_en','subtopic_vi','subtopic_en','difficulty_vi','difficulty_en','question_vi','question_en','option_a','option_b','option_c','option_d','correct'];
 const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
 function status(s,isError=false){const el=$('bankExportStatus');el.textContent=s;el.style.color=isError?'#ffacba':'#a8e2ff';}
 function save(blob,name){const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),30000)}
 async function loadReader(){
  if(typeof XLSX!=='undefined')return XLSX;
  await new Promise((resolve,reject)=>{
   const sc=document.createElement('script');sc.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
   sc.onload=resolve;sc.onerror=()=>reject(Error('Không tải được bộ xuất Excel. Hãy dùng CSV hoặc JSON.'));document.head.appendChild(sc);
  });
  return XLSX;
 }
 async function begin(format){
  if(inProgress)return;
  inProgress=true;
  for(const b of document.querySelectorAll('[data-bank-export]'))b.disabled=true;
  let all=[],cursor='',total=null,pages=0;
  const date=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const prefix='CABAL_Quiz_D1_STAGING_Backup_'+date;
  try{
   do{
    const page=await api('questions/export-page?after='+encodeURIComponent(cursor)+'&limit=250');
    if(!Array.isArray(page.rows))throw Error('Invalid D1 response');
    if(total===null)total=Number(page.total);
    if(page.rows.length===0)break;
    // Strict cursor / duplicate validation prevents silent incomplete backups.
    let prev=cursor;
    for(const row of page.rows){
      if(!row.id||row.id<=prev)throw Error('D1 returned duplicate or unordered question ID '+row.id);
      prev=row.id;
    }
    all.push(...page.rows);cursor=page.nextCursor;pages++;
    status('Đang xuất ngân hàng D1: '+all.length.toLocaleString('vi-VN')+' / '+total.toLocaleString('vi-VN')+' câu • '+pages+' trang');
    // Yield to keep the progress indicator responsive.
    await new Promise(resolve=>setTimeout(resolve,0));
    if(!page.hasMore)break;
    if(pages>500)throw Error('Export exceeded 500 pages');
   }while(true);
   if(all.length!==total)throw Error('Backup chưa hoàn chỉnh: chỉ nhận '+all.length+' / '+total+' câu. Thử lại khi không có ai đang import.');
   const meta={backupType:'CABAL Quiz D1 staging question bank',exportedAt:new Date().toISOString(),count:all.length,fields};
   if(format==='json'){
     save(new Blob([JSON.stringify({...meta,rows:all},null,2)],{type:'application/json;charset=utf-8'}),prefix+'.json');
   }else if(format==='csv'){
     const csv=[fields.join(','),...all.map(row=>fields.map(k=>quote(row[k])).join(','))].join('\r\n');
     save(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),prefix+'.csv');
   }else if(format==='xlsx'){
     const x=await loadReader();
     const sheet=x.utils.json_to_sheet(all,{header:fields});
     const book=x.utils.book_new();x.utils.book_append_sheet(book,sheet,'Quiz Questions');
     const info=x.utils.aoa_to_sheet([['CABAL Quiz D1 Staging - Full Backup'],['Export date',meta.exportedAt],['Total question rows',meta.count],['Source','Authenticated Question Manager'],['Note','Answers are shared by EN and VI in current D1 schema; keep this backup confidential.']]);
     x.utils.book_append_sheet(book,info,'Backup Info');
     const bytes=x.write(book,{bookType:'xlsx',type:'array'});
     save(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),prefix+'.xlsx');
   }else throw Error('Unsupported backup format');
   status('✓ Đã xuất đủ '+all.length.toLocaleString('vi-VN')+' câu ('+format.toUpperCase()+'). Bạn có thể lưu bản này ngoại tuyến.');
  }catch(e){status('Không thể hoàn tất backup: '+e.message,true)}
  finally{inProgress=false;for(const b of document.querySelectorAll('[data-bank-export]'))b.disabled=false;all=[]}
 }
 document.querySelectorAll('[data-bank-export]').forEach(b=>b.addEventListener('click',()=>begin(b.dataset.bankExport)));
 return {begin};
};