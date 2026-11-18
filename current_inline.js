
let refs=[];let
currentFilter='pending';let activeRefId=null;let isAdmin=true;let
pinRequired=false;let
savedPin=localStorage.getItem('dominoki_admin_pin')||'';let draftTimer=null;let
mediaRecorder=null;let audioChunks=[];let audioStream=null;let
isRecording=false;let recMaxTimer=null;function escapeHtml(str){return
String(str||'').replaceAll('&','&').replaceAll('<','<').replaceAll('>','>').replaceAll(String.fromCharCode(34),'"');}function
showToast(msg){const
el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}function
extractYouTubeId(raw){try{const u=new URL(raw.trim());const
host=u.hostname.replace('www.','').replace('m.','');let
id='';if(host==='youtu.be'){id=u.pathname.split('/').filter(Boolean)[0]||'';}else
if(host==='youtube.com'||host==='music.youtube.com'){if(u.searchParams.get('v')){id=u.searchParams.get('v');}else{const
parts=u.pathname.split('/').filter(Boolean);const
idx=parts.findIndex(p=>['shorts','embed','live','v'].includes(p));if(idx!==-1&&parts[idx+1])id=parts[idx+1];}}id=id.slice(0,11);return
id.length===11?id:null;}catch(e){return null;}}async function
loadRefs(silent){try{const res=await fetch('/.netlify/functions/api');const
data=await res.json();if(!res.ok)throw new Error(data.error||'Ошибка\nзагрузки');refs=data.refs||[];pinRequired=Boolean(data.pinRequired);if(activeRefId){const
current=refs.find(r=>r.id===activeRefId);if(current){updateDetailStatusUI(current);renderAttachments(current);renderQuickTabs();}else{goCatalog();}}else{renderCatalog();}if(!silent)showToast('Обновлено');}catch(err){if(!silent)showToast(err.message);}}async
function
toggleRole(){if(isAdmin){isAdmin=false;applyRoleUI();return;}if(!pinRequired){isAdmin=true;applyRoleUI();return;}let
pin=savedPin;if(!pin){pin=prompt('Введите ПИН\nадминистратора:');if(pin===null)return;}try{const res=await
fetch('/.netlify/functions/api?verifyPin=1',{headers:{'x-admin-pin':pin}});const
data=await
res.json();if(data.ok){savedPin=pin;localStorage.setItem('dominoki_admin_pin',pin);isAdmin=true;applyRoleUI();}else{localStorage.removeItem('dominoki_admin_pin');savedPin='';const
retry=prompt('ПИН неверный. Попробуйте ещё раз:');if(!retry)return;const
res2=await
fetch('/.netlify/functions/api?verifyPin=1',{headers:{'x-admin-pin':retry}});const
data2=await
res2.json();if(data2.ok){savedPin=retry;localStorage.setItem('dominoki_admin_pin',retry);isAdmin=true;applyRoleUI();}else{showToast('Неверный\nПИН-код');}}}catch(err){showToast('Ошибка проверки ПИН');}}function
applyRoleUI(){const
btn=document.getElementById('roleBtn');btn.textContent=isAdmin?'Я\n(Админ)':'Заказчик';btn.classList.toggle('admin',isAdmin);document.getElementById('addRefBtn').classList.toggle('hidden',!isAdmin);document.getElementById('deleteRefBtn').classList.toggle('hidden',!isAdmin);}function
setFilter(filter){currentFilter=filter;document.querySelectorAll('.filter-tab').forEach(t=>t.classList.toggle('active',t.dataset.filter===filter));renderCatalog();}function
getFilteredRefs(){const
q=document.getElementById('searchInput').value.trim().toLowerCase();return
refs.filter(r=>{const
matchStatus=currentFilter==='all'||r.status===currentFilter;const
matchQuery=!q||String(r.id).includes(q)||(r.title||'').toLowerCase().includes(q)||(r.folder||'').toLowerCase().includes(q);return
matchStatus&&matchQuery;});}function renderCatalog(){const
pendingCount=refs.filter(r=>r.status==='pending').length;const
doneCount=refs.filter(r=>r.status==='done').length;document.getElementById('cntPending').textContent=pendingCount;document.getElementById('cntDone').textContent=doneCount;document.getElementById('cntAll').textContent=refs.length;const
list=getFilteredRefs();const
container=document.getElementById('catalogList');if(!list.length){container.innerHTML=<div
style='text-align:center;padding:40px 16px;color:var(--muted);'>Здесь пока
пусто</div>;return;}container.innerHTML=list.map(r=>{const
isDone=r.status==='done';const
hasDraft=!isDone&&((r.comment||'').trim()||(r.attachments&&r.attachments.length));const
statusText=isDone?'Обработано':(hasDraft?'Черновик':'Ждёт разбора');const
statusClass=isDone?'status-done':'status-pending';const
metaParts=[r.folder||'Без папки'];if(r.comment)metaParts.push('💬\n'+r.comment);if(r.attachments&&r.attachments.length)metaParts.push('📎\n'+r.attachments.length);return <div class='card ${isDone?'is-done':''}'
onclick='openRef(${r.id})'><div class='thumb-wrap'><img
src='https://img.youtube.com/vi/${escapeHtml(r.ytId)}/mqdefault.jpg' alt=''
loading='lazy' /><span class='ref-id-badge'>#${r.id}</span></div><div
class='card-body'><div class='card-top'><div
class='card-title'>${escapeHtml(r.title)}</div><span class='status-pill\n${statusClass}'>${statusText}</span></div><div
class='card-meta'>${escapeHtml(metaParts.join(' •\n'))}</div></div></div>;}).join('');}async function goCatalog(){await
flushDraft();stopSpeechIfActive();activeRefId=null;document.getElementById('ytPlayer').src='';document.getElementById('detailView').classList.add('hidden');document.getElementById('catalogView').classList.remove('hidden');renderCatalog();}async
function openRef(id){if(activeRefId&&activeRefId!id)await
flushDraft();stopSpeechIfActive();activeRefId=id;const
ref=refs.find(r=>r.id===id);if(!ref)return;document.getElementById('catalogView').classList.add('hidden');document.getElementById('detailView').classList.remove('hidden');renderQuickTabs();document.getElementById('detailIdBadge').textContent='#'+ref.id;document.getElementById('detailTitle').textContent=ref.title;document.getElementById('ytPlayer').src='https://www.youtube.com/embed/'+ref.ytId+'?playsinline=1&rel=0';const
noteBox=document.getElementById('adminNoteBox');if(ref.adminNote){noteBox.textContent='От\nавтора:\n'+ref.adminNote;noteBox.classList.remove('hidden');}else{noteBox.classList.add('hidden');}document.getElementById('commentInput').value=ref.comment||'';document.getElementById('saveStateLabel').textContent='';updateDetailStatusUI(ref);renderAttachments(ref);window.scrollTo({top:0,behavior:'instant'});}function
renderQuickTabs(){const
list=getFilteredRefs();document.getElementById('quickTabs').innerHTML=list.map(r=><div
class='q-tab ${r.id===activeRefId?'active':''}' onclick='openRef(${r.id})'><span
class='q-dot ${r.status}'></span><span>#${r.id}</span></div>).join('');}function
updateDetailStatusUI(ref){const
pill=document.getElementById('detailStatusPill');const
btn=document.getElementById('completeBtn');if(ref.status==='done'){pill.textContent='Обработано';pill.className='status-pill\nstatus-done';btn.textContent='↺ Вернуть в доработку';btn.className='btn\nbtn-ghost';}else{pill.textContent='Ждёт разбора';pill.className='status-pill\nstatus-pending';btn.textContent='✓ Готово / Отправить\nкомментарий';btn.className='btn btn-success';}}async function
saveRefPatch(id,patch){const
label=document.getElementById('saveStateLabel');label.textContent='Сохраняется...';const
res=await
fetch('/.netlify/functions/api',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...patch})});const
data=await res.json();if(!res.ok){label.textContent='Ошибка сохранения';throw
new Error(data.error||'Ошибка сохранения');}const
idx=refs.findIndex(r=>r.id===id);if(idx!-1)refs[idx]=data.ref;label.textContent='Сохранено\n✓';return data.ref;}function scheduleSaveDraft(){const
ref=refs.find(r=>r.id===activeRefId);if(!ref)return;ref.comment=document.getElementById('commentInput').value;document.getElementById('saveStateLabel').textContent='Печатает...';clearTimeout(draftTimer);const
targetId=ref.id;const
text=ref.comment;draftTimer=setTimeout(()=>saveRefPatch(targetId,{comment:text}).catch(e=>showToast(e.message)),700);}async
function
flushDraft(){if(!draftTimer||!activeRefId)return;clearTimeout(draftTimer);draftTimer=null;const
ref=refs.find(r=>r.id===activeRefId);if(!ref)return;ref.comment=document.getElementById('commentInput').value;await
saveRefPatch(ref.id,{comment:ref.comment}).catch(()=>{});}async function
toggleComplete(){const
ref=refs.find(r=>r.id===activeRefId);if(!ref)return;clearTimeout(draftTimer);draftTimer=null;const
nextStatus=ref.status==='done'?'pending':'done';const
commentText=document.getElementById('commentInput').value;ref.comment=commentText;try{const
updated=await
saveRefPatch(ref.id,{comment:commentText,status:nextStatus});updateDetailStatusUI(updated);renderQuickTabs();if(updated.status==='done'){showToast('Референс\n#'+updated.id+' отмечен как готовый!');const
nextPending=refs.find(r=>r.status==='pending');if(nextPending)setTimeout(()=>openRef(nextPending.id),550);}}catch(err){showToast(err.message);}}function
compressImage(file,maxW,quality){return new Promise((resolve,reject)=>{const
img=new Image();const
objUrl=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(objUrl);let
w=img.width;let h=img.height;if(w>maxW){h=Math.round(h(maxW/w));w=maxW;}const
c=document.createElement('canvas');c.width=w;c.height=h;const
cctx=c.getContext('2d');cctx.fillStyle='#FFFFFF';cctx.fillRect(0,0,w,h);cctx.drawImage(img,0,0,w,h);c.toBlob(b=>b?resolve(b):reject(new
Error('Ошибка\nсжатия')),'image/jpeg',quality);};img.onerror=()=>{URL.revokeObjectURL(objUrl);reject(new
Error('Не удалось открыть фото'));};img.src=objUrl;});}async function
uploadMediaBlob(blob,name){const fd=new
FormData();fd.append('file',blob,name);const res=await
fetch('/.netlify/functions/api?media=1',{method:'POST',body:fd});const
data=await res.json();if(!res.ok)throw new Error(data.error||'Ошибка загрузки\nфото');return data.id;}async function handleFiles(event){const
ref=refs.find(r=>r.id===activeRefId);if(!ref)return;const
files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;showToast('Загрузка\nфото...');for(const file of files){try{const compressed=await
compressImage(file,1280,0.8);const mediaId=await
uploadMediaBlob(compressed,'photo.jpg');const
nextAtt=[...(ref.attachments||[]),{id:mediaId,type:'photo'}];const updated=await
saveRefPatch(ref.id,{attachments:nextAtt});renderAttachments(updated);}catch(err){showToast(err.message);}}}function
renderAttachments(ref){const
grid=document.getElementById('attachmentsGrid');const
atts=ref.attachments||[];grid.innerHTML=atts.map((att,idx)=><div
class='att-item'><img src='/.netlify/functions/api?media=${escapeHtml(att.id)}'
onclick='openLightbox(this.src)' alt='' /><span
class='att-badge'>${att.type==='sketch'?'Набросок':'Фото'}</span><button
class='att-del'
onclick='removeAttachment(${idx})'>×</button></div>).join('');}async function
removeAttachment(idx){const
ref=refs.find(r=>r.id===activeRefId);if(!ref)return;const
nextAtt=(ref.attachments||[]).filter((,i)=>i!==idx);try{const updated=await
saveRefPatch(ref.id,{attachments:nextAtt});renderAttachments(updated);}catch(err){showToast(err.message);}}function
openLightbox(src){document.getElementById('lightboxImg').src=src;document.getElementById('lightbox').classList.add('open');}function
closeLightbox(){document.getElementById('lightbox').classList.remove('open');}function
stopSpeechIfActive(){clearTimeout(recMaxTimer);if(mediaRecorder&&isRecording){try{mediaRecorder.stop();}catch(e){}}}async
function toggleSpeech(){const micBtn=document.getElementById('micBtn');const
micLabel=document.getElementById('micLabel');if(isRecording&&mediaRecorder){clearTimeout(recMaxTimer);mediaRecorder.stop();return;}if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){showToast('Микрофон\nнедоступен. Откройте сайт по HTTPS в Safari или\nChrome.');return;}try{audioStream=await
navigator.mediaDevices.getUserMedia({audio:true});const
preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];const
supportedType=preferred.find(t=>MediaRecorder.isTypeSupported(t))||'';audioChunks=[];mediaRecorder=supportedType?new
MediaRecorder(audioStream,{mimeType:supportedType}):new
MediaRecorder(audioStream);mediaRecorder.ondataavailable=(e)=>{if(e.data&&e.data.size>0)audioChunks.push(e.data);};mediaRecorder.onstop=async()=>{isRecording=false;clearTimeout(recMaxTimer);micBtn.classList.remove('recording');if(audioStream){audioStream.getTracks().forEach(t=>t.stop());audioStream=null;}const
rawMime=(mediaRecorder.mimeType||supportedType||'audio/webm').split(';')[0];const
ext=(rawMime.includes('mp4')||rawMime.includes('m4a'))?'m4a':(rawMime.includes('ogg')?'ogg':'webm');const
audioBlob=new
Blob(audioChunks,{type:rawMime});if(audioBlob.size<800){micLabel.textContent='Голос';return;}micLabel.textContent='Расшифровка...';micBtn.disabled=true;try{const
fd=new FormData();fd.append('file',audioBlob,'voice.'+ext);const res=await
fetch('/.netlify/functions/transcribe',{method:'POST',body:fd});const data=await
res.json();if(!res.ok)throw new Error(data.error||'Ошибка\nраспознавания');if(data.text){const
textarea=document.getElementById('commentInput');const
nl=String.fromCharCode(10);const sep=textarea.value&&!textarea.value.endsWith('\n')&&!textarea.value.endsWith(nl)?' ':'';textarea.value+=sep+data.text;const
ref=refs.find(r=>r.id===activeRefId);if(ref){ref.comment=textarea.value;await
saveRefPatch(ref.id,{comment:ref.comment});}}else{showToast('Речь не распознана,\nпопробуйте ещё раз');}}catch(err){showToast('Ошибка:\n'+err.message);}finally{micBtn.disabled=false;micLabel.textContent='Голос';}};mediaRecorder.start();isRecording=true;micBtn.classList.add('recording');micLabel.textContent='Говорите...\n(Стоп)';recMaxTimer=setTimeout(()=>{if(isRecording&&mediaRecorder)mediaRecorder.stop();},150000);}catch(err){showToast('Разрешите\nдоступ к микрофону в браузере');}}function
openAddModal(){document.getElementById('addModal').classList.add('open');}function
closeAddModal(){document.getElementById('addModal').classList.remove('open');}async
function addReference(){const
url=document.getElementById('newUrl').value.trim();const
ytId=extractYouTubeId(url);if(!ytId){showToast('Укажите корректную ссылку на\nYouTube или Shorts');return;}const
btn=document.getElementById('submitAddBtn');btn.disabled=true;try{const
res=await
fetch('/.netlify/functions/api',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':savedPin},body:JSON.stringify({ytId,title:document.getElementById('newTitle').value.trim(),folder:document.getElementById('newFolder').value.trim(),adminNote:document.getElementById('newAdminNote').value.trim()})});const
data=await res.json();if(!res.ok)throw new Error(data.error||'Ошибка\nдобавления');refs.unshift(data.ref);document.getElementById('newUrl').value='';document.getElementById('newTitle').value='';document.getElementById('newAdminNote').value='';closeAddModal();setFilter('pending');showToast('Добавлен\nреференс\n#'+data.ref.id);}catch(err){showToast(err.message);}finally{btn.disabled=false;}}async
function deleteCurrentRef(){if(!confirm('Удалить этот референс\nбезвозвратно?'))return;try{const res=await
fetch('/.netlify/functions/api?id='+activeRefId,{method:'DELETE',headers:{'x-admin-pin':savedPin}});const
data=await res.json();if(!res.ok)throw new Error(data.error||'Ошибка\nудаления');refs=refs.filter(r=>r.id!==activeRefId);activeRefId=null;document.getElementById('ytPlayer').src='';document.getElementById('detailView').classList.add('hidden');document.getElementById('catalogView').classList.remove('hidden');renderCatalog();showToast('Удалено');}catch(err){showToast(err.message);}}const
canvas=document.getElementById('sketchCanvas');const
ctx=canvas.getContext('2d');let strokes=[];let currentStroke=null;let
drawColor='#EF4444';let bgImage=null;function
openDrawModal(){document.getElementById('drawModal').classList.add('open');strokes=[];bgImage=null;requestAnimationFrame(resizeCanvas);}function
closeDrawModal(){document.getElementById('drawModal').classList.remove('open');}function
resizeCanvas(){const rect=canvas.parentElement.getBoundingClientRect();const
dpr=window.devicePixelRatio||1;canvas.width=rect.widthdpr;canvas.height=rect.heightdpr;ctx.setTransform(dpr,0,0,dpr,0,0);redrawCanvas();}function
setColor(el){drawColor=el.dataset.color;document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('active'));el.classList.add('active');}function
loadSketchBg(event){const
file=event.target.files&&event.target.files[0];if(!file)return;const reader=new
FileReader();reader.onload=e=>{const img=new
Image();img.onload=()=>{bgImage=img;redrawCanvas();};img.src=e.target.result;};reader.readAsDataURL(file);event.target.value='';}function
redrawCanvas(){const
rect=canvas.getBoundingClientRect();ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,rect.width,rect.height);if(bgImage){const
scale=Math.min(rect.width/bgImage.width,rect.height/bgImage.height);const
w=bgImage.widthscale;const
h=bgImage.heightscale;ctx.drawImage(bgImage,(rect.width-w)/2,(rect.height-h)/2,w,h);}ctx.lineCap='round';ctx.lineJoin='round';strokes.forEach(s=>{if(!s.points.length)return;ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.beginPath();ctx.moveTo(s.points[0].x,s.points[0].y);for(let
i=1;i<s.points.length;i++)ctx.lineTo(s.points[i].x,s.points[i].y);ctx.stroke();});}function
getPos(e){const
rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top};}canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);const
p=getPos(e);currentStroke={color:drawColor,size:4,points:[p,{x:p.x+0.1,y:p.y+0.1}]};strokes.push(currentStroke);redrawCanvas();});canvas.addEventListener('pointermove',e=>{if(!currentStroke)return;currentStroke.points.push(getPos(e));redrawCanvas();});canvas.addEventListener('pointerup',()=>{currentStroke=null;});canvas.addEventListener('pointercancel',()=>{currentStroke=null;});function
undoStroke(){strokes.pop();redrawCanvas();}function
clearCanvas(){strokes=[];bgImage=null;redrawCanvas();}function
saveSketch(){const ref=refs.find(r=>r.id===activeRefId);if(!ref)return;const
btn=document.getElementById('saveSketchBtn');btn.disabled=true;canvas.toBlob(async(blob)=>{try{if(!blob)throw
new Error('Ошибка рисунка');const mediaId=await
uploadMediaBlob(blob,'sketch.png');const
nextAtt=[...(ref.attachments||[]),{id:mediaId,type:'sketch'}];const
updated=await
saveRefPatch(ref.id,{attachments:nextAtt});renderAttachments(updated);closeDrawModal();showToast('Набросок\nприкреплён');}catch(err){showToast(err.message);}finally{btn.disabled=false;}},'image/png');}document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!activeRefId)loadRefs(true);  