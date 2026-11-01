'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random();
const today=()=>{let d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dateObj=s=>new Date(s+'T12:00:00');const n=v=>Math.max(0,Number(v)||0);const round=v=>Math.round(v*10)/10;
const initial=()=>({version:1,settings:{kcal:2200,p:160,f:65,c:244,weight:77,goal:72,height:169,age:20,activity:1.45,sex:'hombre',targetMethod:'auto',goalMode:'cut',pace:'moderate'},foods:[],recipes:[],routines:[],entries:{},audit:[],updated:Date.now()});
let db,state=initial(),tab='inicio',selected=today(),month=today().slice(0,7),subtab='diario',gymTab='sesion',chartMetric='weight',timerEnd=0,timerInterval=null,alarmInterval=null,alarmOn=false,daySeen=today();
const record=d=>state.entries[d]||(state.entries[d]={weight:null,waist:null,effort:null,steps:null,notes:'',gym:[],meals:[],complete:false});
const currentWeight=()=>{const measurements=Object.entries(state.entries).filter(([d,r])=>d<=today()&&Number(r.weight)>0).sort(([a],[b])=>b.localeCompare(a));return measurements.length?Number(measurements[0][1].weight):Number(state.settings.weight)||77};
const gymIntensity=d=>{let x=(state.entries[d]?.gym||[]).map(g=>Number(g.intensity)).filter(x=>Number.isFinite(x)&&x>0);return x.length?round(x.reduce((a,b)=>a+b,0)/x.length):null};
const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('nutritrack_local',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const readDB=()=>new Promise((resolve,reject)=>{const tx=db.transaction('data','readonly');const r=tx.objectStore('data').get('main');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const writeDB=()=>new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(state,'main');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
let pending=Promise.resolve();function save(){state.updated=Date.now();pending=pending.then(writeDB).then(()=>{showSaved();return true}).catch(e=>alert('Error guardando: '+e.message));return pending}
function editAllowed(date=selected){if(date>today()){alert('No puedes registrar datos futuros.');return false}if(date<today()){if(!confirm('Este día está cerrado. ¿Confirmas una corrección excepcional? Quedará registrada en el historial?'))return false;state.audit.push({date,at:new Date().toISOString(),action:'Corrección excepcional'});}return true}
function mutate(fn,date=selected){if(!editAllowed(date))return;const day=today(),before=streak(),fresh=date===day&&!hasActivity(day);
fn();const after=streak();const celebrate=fresh&&after>before&&state.lastCelebrated!==day;
if(celebrate)state.lastCelebrated=day;
save().then(ok=>{if(ok&&celebrate)showStreak(before,after)});render()}
const nav=[['inicio','⌂','Inicio'],['calendario','▦','Calendario'],['comidas','◉','Comidas'],['gym','▥','Gimnasio'],['progreso','⌁','Progreso'],['ajustes','⚙','Objetivos']];
const box=(name,value,unit='')=>`<div class="card"><div class="label">${name}</div><div class="metric">${value}${unit?` <span class="small muted">${unit}</span>`:''}</div></div>`;
function macros(food,grams){let factor=n(grams)/100;return {kcal:round(n(food.kcal)*factor),p:round(n(food.p)*factor),f:round(n(food.f)*factor),c:round(n(food.c)*factor)}}
function totals(d){return record(d).meals.reduce((a,m)=>{for(const k of ['kcal','p','f','c'])a[k]+=n(m[k]);return a},{kcal:0,p:0,f:0,c:0})}
function progressBar(v,max){return `<div class="bar"><div style="width:${Math.min(100,max>0?v/max*100:0)}%"></div></div>`}
function hasActivity(date) {
  const day = state.entries[date];
  if (!day) return false;
  return Boolean(day.meals?.length || day.gym?.length || day.notes?.trim() ||
    ['steps', 'weight', 'waist', 'effort'].some(key => day[key] != null && day[key] !== ''));
}
function streak() {
  const cursor = dateObj(today());
  function key() {
    return [cursor.getFullYear(), String(cursor.getMonth()+1).padStart(2,'0'), String(cursor.getDate()).padStart(2,'0')].join('-');
  }
  if (!hasActivity(key())) cursor.setDate(cursor.getDate()-1);
  let days = 0;
  while (hasActivity(key())) {
    days++;
    cursor.setDate(cursor.getDate()-1);
  }
  return days;
}
function showSaved() {
  const notice = document.createElement('div');
  notice.className = 'saved-note';
  notice.setAttribute('role','status');
  notice.textContent = '✓ Guardado en este dispositivo';
  document.querySelector('.saved-note')?.remove();
  document.body.append(notice);
  setTimeout(() => notice.remove(), 2200);
}
function thumb(food) {
  return /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(food?.photo || '')
    ? '<img class="product-photo" alt="Foto del producto" src="'+food.photo+'">' : '';
}
function products() {
  return `<div class="card"><h3 id="product-title">Nuevo producto</h3><form id="add-food" class="stack">
    <label>Nombre<input name="name" required maxlength="100" placeholder="Producto, marca o supermercado"></label>
    <div class="label">Valores por cada 100 g</div><div class="grid">${[['kcal','Kcal'],['p','Proteínas (g)'],['f','Grasas (g)'],['c','Carbohidratos (g)']].map(([key,label])=>`<label>${label}<input name="${key}" type="number" min="0" step="0.01" required></label>`).join('')}</div>
    <div class="label">Foto del producto (opcional)</div><div id="photo-preview"></div>
    <div class="actions"><label class="photo-button">Hacer foto<input type="file" accept="image/*" capture="environment"></label><label class="photo-button">Elegir de la galería<input type="file" accept="image/*"></label></div>
    <button>Guardar producto</button><button type="reset" class="secondary">Limpiar formulario</button></form></div>
    <div class="card"><h3>Mis productos · ${state.foods.length}</h3><input id="product-search" type="search" placeholder="Buscar producto" aria-label="Buscar producto">
    ${state.foods.map(f=>`<div class="entry product-row" data-product="${esc(f.id)}">${thumb(f)}<div><b>${esc(f.name)}</b><div class="small muted">${f.kcal} kcal / 100 g · P ${f.p} · G ${f.f} · C ${f.c}</div><div class="actions"><button class="secondary tiny" data-edit-food="${esc(f.id)}">Editar</button><button class="danger tiny" data-delete-food="${esc(f.id)}">Eliminar</button></div></div></div>`).join('') || '<p class="muted">Añade tu primer producto.</p>'}</div>`;
}
async function compressPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 640/Math.max(img.width,img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width*scale));
    canvas.height = Math.max(1, Math.round(img.height*scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.78);
  } finally { URL.revokeObjectURL(url); }
}
function wireProducts() {
  const form = $('#add-food');
  if (!form) return;
  let editing = null, photo = '', generation = 0;
  const submit = form.querySelector('button:not([type])');
  function reset() {
    generation++;
    editing = null;
    photo = '';
    submit.disabled = false;
    $('#product-title').textContent = 'Nuevo producto';
    $('#photo-preview').replaceChildren();
  }
  form.onreset = reset;
  for (const input of form.querySelectorAll('[type=file]')) input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const token = ++generation;
    submit.disabled = true;
    try {
      const result = await compressPhoto(file);
      if (token !== generation || !form.isConnected) return;
      photo = result;
      $('#photo-preview').innerHTML = thumb({photo});
    } catch {
      if (token === generation && form.isConnected) alert('No se ha podido leer la foto. Prueba con una imagen JPG o PNG.');
    } finally { if (token === generation) submit.disabled = false; }
  };
  for (const button of document.querySelectorAll('[data-edit-food]')) button.onclick = () => {
    const food = state.foods.find(f => f.id === button.dataset.editFood);
    form.reset();
    editing = food;
    photo = food.photo || '';
    for (const key of ['name','kcal','p','f','c']) form.elements[key].value = food[key];
    $('#photo-preview').innerHTML = thumb(food);
    $('#product-title').textContent = 'Editar producto';
    form.elements.name.focus();
  };
  $('#product-search').oninput = e => {
    const query = e.target.value.trim().toLocaleLowerCase('es');
    for (const row of document.querySelectorAll('.product-row')) row.hidden = !row.querySelector('b').textContent.toLocaleLowerCase('es').includes(query);
  };
  form.onsubmit = e => {
    e.preventDefault();
    if (submit.disabled) return;
    const name = form.elements.name.value.trim();
    if (!name) return form.elements.name.focus();
    const food = editing || {id:uid()};
    Object.assign(food,{name,photo});
    for (const key of ['kcal','p','f','c']) food[key] = n(form.elements[key].value);
    if (!editing) state.foods.push(food);
    save(); render();
  };
}

function dayDetail(d){let r=record(d),t=totals(d),eff=gymIntensity(d);return `<div class="card"><div class="row"><h3>${new Intl.DateTimeFormat('es-ES',{dateStyle:'full'}).format(dateObj(d))}</h3><span class="pill">${d<today()?'Cerrado':d===today()?'Hoy':'Futuro'}</span></div><div class="small muted">${Math.round(t.kcal)} kcal · ${r.meals.length} alimentos · ${r.gym.length} sesiones${eff!==null?' · Intensidad gym '+eff+'/10':''}</div><div class="grid" style="margin-top:12px">${[['Peso (kg)','weight',r.weight],['Cintura (cm)','waist',r.waist],['Pasos (opcional)','steps',r.steps]].map(([label,k,v])=>`<label><div class="label">${label}</div><input type="number" step="any" min="0" id="day-${k}" value="${v??''}"></label>`).join('')}</div><label><div class="label">Notas</div><textarea id="day-notes">${esc(r.notes)}</textarea></label><button data-action="save-day" ${d>today()?'disabled':''}>Guardar registro</button><p class="small muted">Se guarda en el móvil inmediatamente al pulsar. Los días anteriores requieren confirmar cualquier corrección; no existe un botón de «completar día».</p><div class="actions" style="margin-top:10px"><button class="secondary" data-action="day-food">Ver comidas</button><button class="secondary" data-action="day-gym">Ver entrenamientos</button></div></div>`}
function gymScreen(){
 let r=record(selected);
 let head=`<h2 class="section">Gimnasio</h2><div class="tabs">${[['rutinas','Rutinas'],['sesion','Entrenar'],['historial','Historial']].map(([k,l])=>`<button class="${gymTab===k?'active':''}" data-gymtab="${k}">${l}</button>`).join('')}</div>`;
 if(gymTab==='rutinas'){
 let content=`<div class="card"><h3>Crear rutina</h3><form id="add-routine" class="stack"><input name="name" required placeholder="Ej. Empuje A"><button>Crear rutina</button></form></div>`;
 for(let routine of state.routines){content+=`<div class="card"><div class="row"><h3>${esc(routine.name)}</h3><button class="danger tiny" data-delete-routine="${routine.id}">Eliminar</button></div><form class="add-exercise stack" data-routine="${routine.id}"><label><div class="label">Nombre del ejercicio</div><input name="name" required placeholder="Ej. Press banca"></label><div class="three"><label><div class="label">Series</div><input name="sets" type="number" min="1" max="20" value="3" required></label><label><div class="label">Repeticiones</div><input name="reps" type="number" min="1" max="100" value="10" required></label><label><div class="label">Peso (kg)</div><input name="kg" type="number" step="0.5" min="0" value="0" required></label></div><button class="secondary">+ Añadir ejercicio</button></form>`;
 for(let e of routine.exercises)content+=`<div class="entry"><div style="flex:1"><b>${esc(e.name)}</b><div class="small muted">${e.sets||3} series × ${e.reps||10} rep. · ${e.kg||0} kg</div><button class="ghost tiny" data-edit-exercise="${routine.id}:${e.id}">Modificar planificación</button></div><button class="danger tiny" data-delete-exercise="${routine.id}:${e.id}">Quitar</button></div>`;
 content+='</div>';}return head+content;
 }
 if(gymTab==='sesion')return head+sessionScreen();
 let history=Object.entries(state.entries).filter(([d,v])=>v.gym?.length && (!historyFilter||d.startsWith(historyFilter))).sort(([a],[b])=>b.localeCompare(a));
 return head+`<div class="card"><h3>Historial de sesiones</h3><p class="small muted">Resumen por entrenamiento. Las gráficas de progreso están en el apartado Progreso.</p></div>${history.length?history.map(([d,v])=>`<section class="card history-day"><h3>${longDate(d)} · ${d.slice(0,4)}</h3>${v.gym.map(g=>`<div class="entry"><div><b>${esc(g.name)}</b><div class="small muted">${g.minutes} min · Esfuerzo ${g.intensity}/10</div></div>${d<=today()?`<button class="danger tiny" data-delete-session="${d}:${g.id}">Quitar</button>`:''}</div>`).join('')}</section>`).join(''):'<div class="card empty">Aún no hay sesiones registradas.</div>'}`;
}
function updateGoalMode(){let v=$('input[name=targetMethod]:checked')?.value;$('#auto-goal-fields')?.classList.toggle('hide',v==='manual');$('#manual-goal-fields')?.classList.toggle('hide',v!=='manual')}
function saveGoals(f){let s={...state.settings};s.targetMethod=f.targetMethod==='manual'?'manual':'auto';if(s.targetMethod==='manual'){let p=Number(f.manual_p),fat=Number(f.manual_f),c=Number(f.manual_c);if(![p,fat,c].every(v=>Number.isFinite(v)&&v>=0&&v<=1000))return alert('Introduce macros válidos');let kcal=Math.round(4*p+9*fat+4*c);if(kcal<1000||kcal>7000)return alert('Revisa los macros: el resultado calórico es poco razonable.');Object.assign(s,{p:Math.round(p),f:Math.round(fat),c:Math.round(c),kcal,lastCalculation:'Objetivo manual: kcal calculadas a partir de los macronutrientes.'});}else{let w=Number(f.weight),h=Number(f.height),age=Number(f.age),a=Number(f.activity),g=Number(f.goal);if(![w,h,age,a,g].every(Number.isFinite)||w<30||w>400||h<100||h>240||age<16||age>100||a<1.1||a>2||g<30||g>400)return alert('Revisa peso, altura, edad, actividad y objetivo.');s.weight=w;s.height=h;s.age=age;s.activity=a;s.goal=g;s.sex=f.sex==='mujer'?'mujer':'hombre';s.goalMode=['cut','maintain','gain'].includes(f.goalMode)?f.goalMode:'cut';s.pace=['slow','moderate','fast'].includes(f.pace)?f.pace:'moderate';let basal=10*w+6.25*h-5*age+(s.sex==='hombre'?5:-161),maintenance=basal*a;let adjustment=s.goalMode==='maintain'?0:s.goalMode==='cut'?-({slow:.08,moderate:.12,fast:.16}[s.pace]):({slow:.05,moderate:.08,fast:.11}[s.pace]);let kcal=Math.round(maintenance*(1+adjustment)/25)*25,p=Math.round(w*2.1),fat=Math.round(w*.85),c=Math.round((kcal-4*p-9*fat)/4);if(kcal<1400||c<0)return alert('El cálculo no da un reparto viable. Elige un déficit menor o revisa los datos.');Object.assign(s,{kcal,p,f:fat,c,lastCalculation:`TMB ${Math.round(basal)} kcal · mantenimiento estimado ${Math.round(maintenance)} kcal · ajuste ${(adjustment*100).toFixed(0)} %. Peso de referencia ${w} kg. No es una medición exacta.`});}state.settings=s;goalPanel='';save();render()}
function wire(){document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selected=b.dataset.date;showDay=true;render()});document.querySelectorAll('[data-foodtab]').forEach(b=>b.onclick=()=>{subtab=b.dataset.foodtab;render()});document.querySelectorAll('[data-gymtab]').forEach(b=>b.onclick=()=>{gymTab=b.dataset.gymtab;historyFilter='';render()});document.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{chartMetric=b.dataset.metric;render()});document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));document.querySelectorAll('[data-delete-meal]').forEach(b=>b.onclick=()=>mutate(()=>{record(selected).meals=record(selected).meals.filter(x=>x.id!==b.dataset.deleteMeal)}));document.querySelectorAll('[data-delete-session]').forEach(b=>b.onclick=()=>{let [d,id]=b.dataset.deleteSession.split(':');mutate(()=>{record(d).gym=record(d).gym.filter(x=>x.id!==id)},d)});document.querySelectorAll('[data-delete-food]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar este producto de la biblioteca? Los registros antiguos se conservarán.')){state.foods=state.foods.filter(x=>x.id!==b.dataset.deleteFood);save();render()}});document.querySelectorAll('[data-delete-recipe]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar esta receta?')){state.recipes=state.recipes.filter(x=>x.id!==b.dataset.deleteRecipe);save();render()}});document.querySelectorAll('[data-delete-routine]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar rutina? El historial se conservará.')){state.routines=state.routines.filter(x=>x.id!==b.dataset.deleteRoutine);save();render()}});document.querySelectorAll('[data-edit-exercise]').forEach(b=>b.onclick=()=>{let [rid,eid]=b.dataset.editExercise.split(':'),e=state.routines.find(r=>r.id===rid)?.exercises.find(x=>x.id===eid);if(!e)return;let name=prompt('Nombre del ejercicio',e.name);if(name===null)return;name=name.trim();if(!name)return alert('El nombre es obligatorio');let sets=prompt('Número de series',e.sets||3);if(sets===null)return;let reps=prompt('Repeticiones objetivo',e.reps||10);if(reps===null)return;let kg=prompt('Peso previsto (kg)',e.kg||0);if(kg===null)return;if(!Number.isInteger(Number(sets))||Number(sets)<1||Number(sets)>20||!Number.isInteger(Number(reps))||Number(reps)<1||Number(reps)>100||!Number.isFinite(Number(kg))||Number(kg)<0)return alert('Valores no válidos');Object.assign(e,{name,sets:Number(sets),reps:Number(reps),kg:Number(kg)});save();render()});document.querySelectorAll('[data-delete-exercise]').forEach(b=>b.onclick=()=>{let [rid,eid]=b.dataset.deleteExercise.split(':');state.routines.find(x=>x.id===rid).exercises=state.routines.find(x=>x.id===rid).exercises.filter(x=>x.id!==eid);save();render()});wireProducts();const mealChoice=$('#add-meal select[name=food]');if(mealChoice)mealChoice.onchange=()=>{const [type,id]=mealChoice.value.split(':');$('#meal-photo').innerHTML=type==='food'?thumb(state.foods.find(f=>f.id===id)):''};bindForm('add-meal',f=>{let [type,id]=f.food.split(':'),item=(type==='food'?state.foods:state.recipes).find(x=>x.id===id);if(!item)return;mutate(()=>{let x=type==='food'?macros(item,f.grams):macros(item,n(f.grams)*100/item.finalWeight);record(selected).meals.push({id:uid(),kind:f.kind,sourceType:type,sourceId:id,name:item.name,grams:n(f.grams),...x})})});bindForm('add-recipe',f=>{let els=[...document.querySelectorAll('#ingredients .grid')],parts=els.map(el=>({id:el.querySelector('select').value,grams:n(el.querySelector('input').value)}));if(parts.some(x=>!x.id||!x.grams))return alert('Revisa los ingredientes');let total={kcal:0,p:0,f:0,c:0};parts.forEach(part=>{let item=state.foods.find(x=>x.id===part.id),m=macros(item,part.grams);for(let k in total)total[k]+=m[k]});state.recipes.push({id:uid(),name:f.name.trim(),parts,finalWeight:n(f.finalWeight),...Object.fromEntries(Object.entries(total).map(([k,v])=>[k,round(v)]))});save();render()});bindForm('add-routine',f=>{state.routines.push({id:uid(),name:f.name.trim(),exercises:[]});save();render()});document.querySelectorAll('.add-exercise').forEach(form=>form.onsubmit=e=>{e.preventDefault();let name=form.elements.name.value.trim();if(!name)return;state.routines.find(r=>r.id===form.dataset.routine).exercises.push({id:uid(),name,sets:Math.max(1,Math.min(20,n(form.elements.sets.value))),reps:Math.max(1,n(form.elements.reps.value)),kg:n(form.elements.kg.value)});save();render()});bindForm('add-session',f=>{let routine=state.routines.find(x=>x.id===f.routine);if(!routine)return alert('Selecciona una rutina');let allRows=[...document.querySelectorAll('.set-row')],sets=allRows.filter(el=>el.querySelector('[name=completed]').checked).map(el=>({exercise:el.dataset.exercise,kg:n(el.dataset.kg),reps:n(el.dataset.reps),rir:null,completed:true}));if(sets.some(x=>!x.exercise))return alert('Introduce el ejercicio de cada serie');mutate(()=>{record(selected).gym.push({id:uid(),name:routine?.name||'Entrenamiento libre',minutes:n(f.minutes),intensity:n(f.intensity),plannedSets:allRows.length,sets});clearSession()})});bindForm('goals-form',saveGoals);document.querySelectorAll('[name=targetMethod]').forEach(input=>input.onchange=updateGoalMode);let imp=$('#import-file');if(imp)imp.onchange=importData;wireDesign();}
function bindForm(id,fn){let el=$('#'+id);if(el)el.onsubmit=e=>{e.preventDefault();let f=Object.fromEntries(new FormData(el));fn(f)}}
function action(a){if(a==='save-day'){if(selected>today()){alert('Selecciona hoy o un día anterior.');return}mutate(()=>{for(let k of ['weight','waist','steps']){let v=$('#day-'+k).value;record(selected)[k]=v===''?null:n(v)}record(selected).notes=$('#day-notes').value});}if(a==='prev-month'||a==='next-month'){let [y,m]=month.split('-').map(Number),d=new Date(y,m-1+(a==='next-month'?1:-1),1);if(d.getFullYear()<2020||d.getFullYear()>2035)return;month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;showDay=false;render()}if(a==='day-food'){tab='comidas';subtab='diario';render()}if(a==='day-gym'){tab='gym';gymTab='historial';render()}if(a==='more-ingredient'){let div=document.createElement('div');div.className='grid';div.innerHTML=`<select name="ingredient">${state.foods.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select><input name="quantity" type="number" min="0.1" step="0.1" placeholder="Gramos" required>`;$('#ingredients').append(div)}if(a==='recommend')recommend();if(a==='export')exportJSON();if(a==='export-csv')exportCSV();if(a==='cloud-info')alert('Sincronización remota no configurada. Esta versión es local y offline. Exporta una copia JSON para proteger tus datos.')}
let audioCtx=null;function prepareSound(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();let b=audioCtx.createBuffer(1,1,22050),source=audioCtx.createBufferSource();source.buffer=b;source.connect(audioCtx.destination);source.start(0)}catch(e){}}
function beep(){try{if(!audioCtx)return;audioCtx.resume();let t=audioCtx.currentTime;[0,.26].forEach(delay=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='square';o.frequency.value=880;g.gain.value=.13;o.connect(g);g.connect(audioCtx.destination);o.start(t+delay);o.stop(t+delay+.18)})}catch(e){}try{navigator.vibrate?.([250,100,250])}catch(e){}}
let previousAudioType = null;
function requestAlarmFocus() {
  try {
    const session = navigator.audioSession;
    if (session) {
      previousAudioType = session.type;
      session.type = 'transient-solo';
    }
  } catch {}
}
function stopAlarm(){try{if(previousAudioType!==null)navigator.audioSession.type=previousAudioType}catch{} previousAudioType=null;alarmOn=false;if(alarmInterval){clearInterval(alarmInterval);alarmInterval=null}updateTimer()}
function timerAlarm(){if(alarmOn)return;alarmOn=true;requestAlarmFocus();beep();alarmInterval=setInterval(beep,850)}
function startTimer(sec){if(sec)timerLength=sec;if(!sec){timerEnd=0;if(timerInterval){clearInterval(timerInterval);timerInterval=null}if(alarmOn){stopAlarm();return}updateTimer();return;}if(alarmOn)stopAlarm();prepareSound();timerEnd=Date.now()+sec*1000;if(timerInterval)clearInterval(timerInterval);timerInterval=setInterval(updateTimer,500);updateTimer()}
function updateTimer(){let el=$('#timer-display');let remain=timerEnd?Math.max(0,Math.ceil((timerEnd-Date.now())/1000)):alarmOn?0:timerLength;if(el)el.textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(remain%60).padStart(2,'0')}`;if(el)el.closest('.dial').style.setProperty('--turn',remain/timerLength+'turn');if(timerEnd&&remain===0){timerEnd=0;clearInterval(timerInterval);timerInterval=null;timerAlarm()}
 const label=$('#timer-label');if(label)label.textContent=alarmOn?'Parar alarma':timerEnd?'Parar':'Iniciar';
 document.querySelectorAll('[data-duration]').forEach(b=>{const chosen=Number(b.dataset.duration)===timerLength;b.disabled=Boolean(timerEnd||alarmOn);b.classList.toggle('chosen',chosen);b.setAttribute('aria-pressed',String(chosen))});
}
function recommend(){let t=totals(today()),s=state.settings,rem={kcal:Math.max(0,s.kcal-t.kcal),p:Math.max(0,s.p-t.p),f:Math.max(0,s.f-t.f),c:Math.max(0,s.c-t.c)},target=Math.min(700,rem.kcal),candidates=state.foods.map(f=>{let g=Math.min(500,Math.max(10,Math.round(target/Math.max(1,f.kcal)*100)));let m=macros(f,g);let score=Math.abs(target-m.kcal)/Math.max(100,target)+Math.abs(Math.min(rem.p,45)-m.p)/50+Math.max(0,m.f-rem.f)/20+Math.max(0,m.c-rem.c)/50;return {f,g,m,score}}).sort((a,b)=>a.score-b.score);$('#recommendation').innerHTML=state.foods.length?`<div class="notice" style="margin-top:12px"><b>Propuesta orientativa:</b> ${candidates.slice(0,2).map(x=>`${x.g} g de ${esc(x.f.name)} (${Math.round(x.m.kcal)} kcal, ${x.m.p} g proteína)`).join(' o ')}.<br>Te quedan ${Math.round(rem.kcal)} kcal y ${Math.round(rem.p)} g de proteína. Verifica que la combinación sea adecuada como comida; no se garantiza una receta equilibrada.</div>`:'<div class="notice warn" style="margin-top:12px">Primero añade alimentos a tu biblioteca para recibir sugerencias.</div>'}
function download(name,content,mime){let a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type:mime}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}function exportJSON(){download('nutritrack-copia-'+today()+'.json',JSON.stringify(state,null,2),'application/json')}
function exportCSV(){let rows=[['fecha','peso_kg','cintura_cm','esfuerzo_gym','pasos','kcal','proteinas_g','grasas_g','carbohidratos_g','sesiones','completo']];Object.entries(state.entries).sort(([a],[b])=>a.localeCompare(b)).forEach(([d,r])=>{let t=totals(d);rows.push([d,r.weight??'',r.waist??'',gymIntensity(d)??'',r.steps??'',round(t.kcal),round(t.p),round(t.f),round(t.c),r.gym.length,r.complete?'si':'no'])});download('nutritrack-registros-'+today()+'.csv','\ufeff'+rows.map(x=>x.join(';')).join('\n'),'text/csv;charset=utf-8')}
async function importData(e){let file=e.target.files[0];if(!file)return;try{let x=JSON.parse(await file.text());if(!x||x.version!==1||!Array.isArray(x.foods)||!Array.isArray(x.recipes)||!Array.isArray(x.routines)||typeof x.entries!=='object'||!x.settings)throw Error('Formato de copia no válido');if(!confirm('La importación reemplazará TODOS los datos locales actuales. ¿Continuar?'))return;state=x;if(await save()){render();alert('Copia restaurada correctamente')}}catch(err){alert('No se ha podido importar: '+err.message)}}
(async()=>{try{db=await openDB();let saved=await readDB();if(saved&&saved.version===1)state=saved;state.settings.targetMethod=state.settings.targetMethod||'auto';state.settings.goalMode=state.settings.goalMode||'cut';state.settings.pace=state.settings.pace||'moderate';render();setInterval(()=>{let now=today();if(now!==daySeen){let old=daySeen;daySeen=now;if(selected===old)selected=now;month=now.slice(0,7);render()}else if(timerEnd)updateTimer()},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(today()!==daySeen){let old=daySeen;daySeen=today();if(selected===old)selected=daySeen;month=daySeen.slice(0,7);render()}updateTimer()}});if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(console.warn)}catch(e){document.body.innerHTML='<main class="shell"><div class="notice warn">No se ha podido abrir la base de datos local. Comprueba que Safari no esté en modo privado y que haya espacio disponible. '+esc(e.message)+'</div></main>'}})();
