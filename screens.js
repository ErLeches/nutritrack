'use strict';
let showDay=false, goalPanel='', historyFilter='', timerLength=120;
let exerciseChoice='', exerciseDays=30;
const fmt = value => Number(value||0).toLocaleString('es-ES',{maximumFractionDigits:1,useGrouping:'always'});
const longDate = date => dateObj(date).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
const monthName = month => dateObj(month+'-01').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
const macroNames={p:'Proteínas',f:'Grasas',c:'Hidratos'};
const goalNames={cut:'Perder grasa',maintain:'Mantener peso',gain:'Ganar masa muscular'};
const iconPaths={
 inicio:'M3 11l9-8 9 8v10h-6v-7H9v7H3z', calendario:'M4 6h16v15H4z M8 3v6m8-6v6M4 11h16',
 comidas:'M4 3v6q0 4 3 4t3-4V3M7 3v18M20 21V3q-6 5-5 11h5',
 gym:'M2 9v6m3-9v12m3-14v16m0-8h8m0-8v16m3-14v12m3-9v6',
 progreso:'M3 20v-5h3v5zm7 0V9h3v11zm7 0V3h3v17z',
 ajustes:'M21 12a9 9 0 1 1-9-9m5 9a5 5 0 1 1-5-5m0 5 9-9m-4 0h4v4',
 p:'M4 17l3-10 4-3 3 2-1 3-3-1-1 6q4-4 7-1l3-1v6q-7 5-15 1z',
 f:'M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13z',
 c:'M12 22V8m0 2q-5-5 0-9 5 4 0 9zm0 6q-7 0-7-8 6 1 7 8zm0 4q7 0 7-9-6 2-7 9z'
};
function icon(key){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="'+iconPaths[key]+'"/></svg>'}
function fire(){return '<svg viewBox="0 0 100 112" class="fire" aria-hidden="true"><ellipse cx="53" cy="99" rx="36" ry="10" fill="#49763c"/><path d="M9 28Q9 18 19 21L29 26 52 3Q57-2 62 6C79 27 94 45 94 62A44 44 0 0 1 6 62Z" fill="#abf746"/><path d="M16 36Q16 28 22 31l9 5L56 11Q58 9 61 14C75 32 86 46 86 62a36 36 0 1 1-72 0Z" fill="#51c934"/><path d="M53 48q2-2 4 1c6 8 17 18 17 26a18 18 0 1 1-36 0c0-8 10-20 15-27z" fill="#fffdf0"/></svg>'}
function go(id){
 tab=id; selected=today();month=selected.slice(0,7);showDay=false;goalPanel='';historyFilter='';
 render();window.scrollTo(0,0);
}
function render(){
 const light=tab==='inicio'; applyPalette();
 document.documentElement.dataset.theme=light?'light':'dark';
 document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.documentElement).getPropertyValue('--forest').trim();
 const screens={inicio:home,calendario:calendar,comidas:foodScreen,gym:gymScreen,progreso:progress,ajustes:settingsScreen};
 $('#app').innerHTML='<main class="shell"><section id="screen">'+screens[tab]()+'</section></main>'+
 '<nav class="nav" aria-label="Apartados"><div class="nav-inner">'+nav.map(([id,,name])=>`<button data-tab="${id}" class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}>${icon(id)}<span>${id==='gym'?'Gym':name}</span></button>`).join('')+'</div></nav>';
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>go(b.dataset.tab));wire();
}
function mealRingColor(fraction){
 if(fraction<.33||fraction>=1.10)return '#ff7978';
 if(fraction<.66||fraction>1)return '#ffce70';
 return 'var(--lime)';
}
function ring(t,date,full=false){
 const goal=state.settings.kcal,delta=Math.round(goal-t.kcal),late=date===today()&&new Date().getHours()>=22&&t.kcal<goal*.25;
 const label=delta<0?'kcal por encima':'kcal restantes';
 const color=!full?mealRingColor(t.kcal/goal):delta<0?'#ff7978':late?'#ffc55f':'var(--lime)';
 const fraction=Math.max(0,Math.min(1,t.kcal/goal||0));
 if(full)return `<div class="daily-energy"><div><strong>${fmt(Math.abs(delta))}</strong><b>${label}</b><small>Objetivo: ${fmt(goal)} kcal</small></div><div class="dial" style="--turn:${fraction}turn;--ink:${color}"><div class="dial-core"><strong>${fmt(Math.round(t.kcal))}</strong><span>kcal consumidas</span></div></div></div>${late?`<p class="late">Hoy has registrado ${fmt(t.kcal)} kcal</p>`:''}`;
 return `<div class="dial ${fraction===0?'empty-energy':''}" style="--turn:${fraction}turn;--ink:${color}"><div class="dial-core"><strong>${fmt(Math.abs(delta))}</strong><b>${label}</b></div></div>`;
}
function macroBars(t){return Object.entries(macroNames).map(([key,label])=>`<div class="macro ${key}"><div class="row"><b>${icon(key)}${label}</b><span><b>${fmt(t[key])}</b> / ${fmt(state.settings[key])} g</span></div>${progressBar(t[key],state.settings[key])}</div>`).join('')}
function home(){
 const t=totals(today()),days=streak();
 return `<div class="daily-header"><header class="home-head"><div>${energyTitle(t)}<p class="muted date">${longDate(today())}</p></div><button class="streak-badge" data-view="calendario">${fire()}${days} ${days===1?'día':'días'} de racha</button></header>
 ${ring(t,today(),true)}</div><div class="home-macros">${macroBars(t)}</div>
 ${measureForm()}
`;
}
function showStreak(before,after){
 const dialog=document.createElement('dialog');dialog.className='celebrate';
 dialog.innerHTML=`${fire()}<h2>¡Un día más!</h2><p>De ${before} a <b>${after}</b> ${after===1?'día':'días'} de racha</p><button autofocus>Continuar</button>`;
 document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();
}
function calendar(){
 const [y,m]=month.split('-').map(Number),offset=(new Date(y,m-1,1).getDay()+6)%7,count=new Date(y,m,0).getDate();
 const key=i=>month+'-'+String(i).padStart(2,'0');const days=streak();
 const latest=Object.keys(state.entries).filter(d=>d<=today()&&hasActivity(d)).sort().pop();
 const cells=Array.from({length:count},(_,i)=>{
   const d=key(i+1),col=(offset+i)%7,active=hasActivity(d);
   const left=active&&col>0&&i>0&&hasActivity(key(i)),right=active&&col<6&&i+1<count&&hasActivity(key(i+2));
   return `<button class="day ${active?'logged':''} ${left?'joins-left':''} ${right?'joins-right':''} ${showDay&&d===selected?'picked':''} ${d===today()?'today':''}" data-date="${d}" aria-label="${longDate(d)}${active?', con registro':''}" ${d>today()?'disabled':''}><span>${i+1}</span></button>`;
 }).join('');
 return `<header class="cal-title"><button class="bare" data-view="inicio" aria-label="Volver a Inicio">×</button><b>Calendario</b></header>
 <div class="cal-hero"><div><strong>${days}</strong><h2>${days===1?'día':'días'} de racha</h2><small>Último registro · ${latest===today()?'Hoy':latest?longDate(latest):'Sin registros'}</small></div>${fire()}</div>
 <div class="card reminder">${fire()}<span>Guarda un registro cada día para mantener tu <b>racha</b>.</span></div>
 <div class="row month-head"><h2>${monthName(month)}</h2><div><button data-action="prev-month" aria-label="Mes anterior">‹</button><button data-action="next-month" aria-label="Mes siguiente">›</button></div></div>
 <div class="card calendar">${['L','M','X','J','V','S','D'].map(x=>'<b class="weekday">'+x+'</b>').join('')}${'<span></span>'.repeat(offset)}${cells}</div>
 <div class="card"><button class="link-row" id="month-history"><span>Entrenamientos en ${monthName(month)}<strong>${Object.entries(state.entries).filter(([d])=>d.startsWith(month)&&d<=today()).reduce((sum,[,r])=>sum+(r.gym?.length||0),0)}</strong></span><b>›</b></button></div>
 ${monthNutrition()}
 ${showDay?dayDetail(selected):'<p class="hint">Toca un día para consultar o guardar un registro.</p>'}`;
}
function tabs(items,chosen,attr){return '<div class="tabs">'+items.map(([key,label])=>`<button data-${attr}="${key}" class="${chosen===key?'active':''}">${label}</button>`).join('')+'</div>'}
function mealList(meals){
 const groups=new Map();for(const meal of meals){const k=meal.kind||'Otros';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(meal)}
 const order=['Desayuno','Comida','Merienda','Cena','Otros'];
 return [...groups].sort(([a],[b])=>order.indexOf(a)-order.indexOf(b)).map(([kind,items])=>`<section class="meal-group"><div class="row"><h2>${esc(kind)}</h2><b>${fmt(Math.round(items.reduce((s,m)=>s+n(m.kcal),0)))} kcal</b></div>
 ${items.map(m=>{
 const product=m.sourceId?(m.sourceType==='food'?state.foods.find(f=>f.id===m.sourceId):state.recipes.find(r=>r.id===m.sourceId)):state.foods.find(f=>f.name===m.name);
 return `<div class="food-line">${thumb(product)||'<div class="food-placeholder">'+icon('comidas')+'</div>'}<div><div class="row"><b>${esc(m.name)}</b><span>${fmt(Math.round(m.kcal))} kcal</span></div><div class="row"><small>${m.portion==='individual'?'Plato individual':fmt(m.grams)+' g'}${m.adjusted?' · Adaptada':''}</small><button class="remove" data-delete-meal="${esc(m.id)}" aria-label="Quitar ${esc(m.name)}">Quitar</button></div><div class="meal-macros">${['p','f','c'].map((k,i)=>`<span class="${k}"><i></i>${['Prot.','Grasas','Hidr.'][i]} ${fmt(m[k])} g</span>`).join('')}</div></div></div>`;
 }).join('')}</section>`).join('')||'<p class="empty">Todavía no has registrado comidas este día.</p>';
}
function foodScreen(){
 const t=totals(selected);
 const header='<h1>Comidas</h1>'+tabs([['diario','Diario'],['alimentos','Productos'],['recetas','Recetas']],subtab,'foodtab');
 if(subtab==='alimentos')return header+products();
 if(subtab==='recetas')return header+recipesScreen();
 return header+(selected!==today()?`<div class="notice">Registro del ${longDate(selected)}</div>`:'')+`
 <div class="card food-overview"><div>${ring(t,selected)}</div><div>${macroBars(t)}</div></div>
 <div class="diary-tools"><button type="button" class="secondary" data-action="recommend">Sugerir próxima comida</button><button type="button" id="toggle-meal" aria-controls="meal-editor" aria-expanded="false">＋ Añadir comida</button></div><div id="recommendation" aria-live="polite"></div><div id="meal-editor" class="card" hidden>${mealForm()}</div>${mealList(record(selected).meals)}`;
}
let draft={date:'',routine:'',sets:new Set(),minutes:45,intensity:7};
function clearSession(){draft={date:selected,routine:'',sets:new Set(),minutes:45,intensity:7}}
function sessionScreen(){
 if(draft.date!==selected)clearSession();
 const r=state.routines.find(x=>x.id===draft.routine)||state.routines[0];
 const timer='<div class="card timer"><div class="dial"><button type="button" class="dial-core timer-control" id="timer-toggle"><strong id="timer-display"></strong><span id="timer-label">Iniciar</span></button></div><div class="timer-options"><small>Descanso</small><div class="timer-actions">'+[60,120,180].map(v=>'<button type="button" aria-pressed="'+(timerLength===v)+'" class="'+(timerLength===v?'chosen':'')+'" data-duration="'+v+'" '+(timerEnd||alarmOn?'disabled':'')+'>'+v/60+' min</button>').join('')+'</div></div></div>';
 if(!r)return timer+'<div class="card"><h3>Tu primera rutina</h3><p>Añade tus ejercicios y podrás marcar las series al entrenar.</p><button data-gymtab="rutinas">Crear rutina</button></div>';
 draft.routine=r.id;
 return '<form id="add-session"><select aria-label="Rutina para entrenar" name="routine">'+state.routines.map(x=>'<option value="'+esc(x.id)+'" '+(x===r?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select>'+timer+r.exercises.map(e=>{
 const count=Number(e.sets)||3;
 return '<div class="card"><h3>'+esc(e.name)+'</h3><small>'+count+' series · '+fmt(e.reps)+' rep. · '+fmt(e.kg)+' kg</small><div class="sets">'+Array.from({length:count},(_,i)=>{const key=e.id+':'+i;return '<label class="set-row" data-exercise="'+esc(e.name)+'" data-kg="'+n(e.kg)+'" data-reps="'+n(e.reps)+'"><input type="checkbox" name="completed" data-set="'+esc(key)+'" aria-label="Serie '+(i+1)+' de '+esc(e.name)+'" '+(draft.sets.has(key)?'checked':'')+'><span>'+(i+1)+'</span></label>'}).join('')+'</div></div>';
 }).join('')+'<details class="finish"><summary>Finalizar sesión</summary><div class="card stack"><label>Duración (min)<input name="minutes" type="number" min="1" max="1440" required value="'+draft.minutes+'"></label><label>Esfuerzo (1–10)<input name="intensity" type="number" min="1" max="10" required value="'+draft.intensity+'"></label><button>Guardar sesión</button></div></details></form>';
}
const metricNames={weight:['Peso','kg'],waist:['Cintura','cm'],intensity:['Esfuerzo','/10'],kcal:['Calorías','kcal']};
function trend(points,average,label=metricNames[chartMetric][0]){
 if(!points.length)return '<p class="empty">La gráfica aparecerá al guardar tu primer registro.</p>';
 const values=points.map(p=>p[1]),lo=Math.min(...values)-.5,hi=Math.max(...values)+.5,first=dateObj(points[0][0]).getTime(),range=dateObj(points.at(-1)[0]).getTime()-first;
 const x=i=>range?32+270*(dateObj(points[i][0]).getTime()-first)/range:167;
 const y=v=>132-112*(v-lo)/(hi-lo);
 const line=vals=>vals.map((v,i)=>x(i)+','+y(v)).join(' ');
 const avg=values.map((_,i)=>{const a=values.slice(Math.max(0,i-6),i+1);return a.reduce((s,v)=>s+v,0)/a.length});
 return '<svg class="plot" viewBox="0 0 328 155" role="img" aria-label="Evolución de '+esc(label)+'">'+[lo,(hi+lo)/2,hi].map(v=>'<text x="0" y="'+y(v)+'">'+fmt(v)+'</text><path d="M32 '+y(v)+'h270"/>').join('')+'<polyline points="'+line(values)+'"/>'+(average?'<polyline class="avg" points="'+line(avg)+'"/>':'')+points.map(([d,v],i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.7"><title>'+d+' · '+fmt(v)+'</title></circle>').join('')+'<text x="32" y="151">'+dateObj(points[0][0]).toLocaleDateString('es-ES',{day:'numeric',month:'short'})+'</text><text x="302" text-anchor="end" y="151">'+dateObj(points.at(-1)[0]).toLocaleDateString('es-ES',{day:'numeric',month:'short'})+'</text></svg>'+(average?'<small>● Peso　<span class="blue">● Media de 7 registros</span></small>':'');
}
let progressDays=30;
function periodSelector(id,days){
 return '<label class="period-field">Periodo<select id="'+id+'">'+[[7,'Última semana'],[30,'Último mes'],[365,'Último año']].map(([v,label])=>'<option value="'+v+'" '+(days===v?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';
}
function progress(){
 const data=Object.entries(state.entries).filter(([d])=>d<=today()).sort(([a],[b])=>a.localeCompare(b));
 const [label,unit]=metricNames[chartMetric],points=[];
 const sets=[];
 for(const [d,r] of data){const v=chartMetric==='intensity'?gymIntensity(d):chartMetric==='kcal'?(r.meals?.length?totals(d).kcal:null):r[chartMetric];
 if(v!=null&&Number.isFinite(Number(v)))points.push([d,Number(v)]);
 for(const g of r.gym||[])for(const s of g.sets||[])if(s.completed!==false&&s.exercise)sets.push({...s,date:d});
 }
 const cutoff=dateObj(today());cutoff.setDate(cutoff.getDate()-progressDays+1);
 const visible=points.filter(([d])=>dateObj(d)>=cutoff);
 const change=visible.length>1?visible.at(-1)[1]-visible[0][1]:null;
 return '<h1>Progreso</h1>'+tabs(Object.entries(metricNames).map(([k,[l]])=>[k,l]),chartMetric,'metric')+'<div class="card"><h3>Evolución de '+label.toLowerCase()+'</h3>'+periodSelector('progress-days',progressDays)+(visible.length?'<strong class="big">'+fmt(visible.at(-1)[1])+' '+unit+'</strong><small>Último registro del periodo</small>':'')+(change===null?'':'<small class="change">'+(change>0?'+':'')+fmt(change)+' '+unit+' en el periodo</small>')+(visible.length?trend(visible,chartMetric==='weight'):'<p class="empty">Sin registros en este periodo.</p>')+'</div>'+(chartMetric==='intensity'?exerciseChart(sets):'');
}
function exerciseChart(sets){
 const exercises=[...new Set(sets.map(s=>s.exercise))].sort((a,b)=>a.localeCompare(b,'es'));
 if(!exercises.includes(exerciseChoice))exerciseChoice=exercises[0]||'';
 const cutoff=dateObj(today());cutoff.setDate(cutoff.getDate()-exerciseDays+1);
 const byDate=new Map();
 for(const s of sets){
   if(s.exercise!==exerciseChoice||dateObj(s.date)<cutoff)continue;
   byDate.set(s.date,Math.max(byDate.get(s.date)||0,n(s.kg)));
 }
 const points=[...byDate];
 return '<section class="card exercise-chart"><h3>Progreso por ejercicio</h3>'+(exercises.length?
 '<label>Ejercicio<select id="choose-exercise">'+exercises.map(e=>'<option '+(e===exerciseChoice?'selected':'')+'>'+esc(e)+'</option>').join('')+'</select></label><label class="period-field">Periodo<select id="exercise-days">'+[[7,'Última semana'],[30,'Último mes'],[365,'Último año']].map(([days,name])=>'<option value="'+days+'" '+(days===exerciseDays?'selected':'')+'>'+name+'</option>').join('')+'</select></label><small>Peso máximo levantado por día (kg) en series completadas.</small>'+(points.length?'<strong>'+fmt(points.at(-1)[1])+' kg · último registro</strong>'+trend(points,false,exerciseChoice+' en kg'):'<p class="empty">Sin series de este ejercicio en el periodo seleccionado.</p>'):'<p class="empty">Completa una serie en Gimnasio para ver tu evolución.</p>')+'</section>';
}
function settingsScreen(){
 const s=state.settings,button=(key,title,desc,symbol)=>'<button class="link-row" data-panel="'+key+'"><span class="glyph">'+symbol+'</span><span><b>'+title+'</b><small>'+desc+'</small></span><b>›</b></button>';
 if(goalPanel)return '<button class="back" data-panel="">‹ Objetivos</button><h1>'+({goal:'Objetivo activo',auto:'Configurar mis macronutrientes',manual:'Configurar mis macronutrientes',backup:'Copias de seguridad'})[goalPanel]+'</h1>'+(goalPanel==='backup'?backupScreen():goalPanel==='goal'?'<form id="edit-goal" class="card stack"><label>Objetivo<select name="goalMode">'+Object.entries(goalNames).map(([k,name])=>'<option value="'+k+'" '+(s.goalMode===k?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label>Peso objetivo (kg)<input type="number" step=".1" min="30" max="400" name="goal" required value="'+n(s.goal)+'"></label><button>Guardar objetivo</button></form>':'<div class="card">'+goalForm(goalPanel)+'</div>');
 return '<h1>Objetivos</h1><div class="card goal-card"><div class="budget"><strong>'+fmt(s.kcal)+'</strong> kcal al día</div><div class="goal-macros">'+Object.entries(macroNames).map(([k,v])=>'<div class="'+k+'">'+icon(k)+'<small>'+v+'</small><b>'+fmt(s[k])+' g</b></div>').join('')+'</div></div><div class="card">'+button('goal','Objetivo activo',(goalNames[s.goalMode]||'Mantener peso')+'<br>Peso objetivo · '+fmt(s.goal)+' kg','◎')+'</div><h2>Ajustar mi objetivo</h2><div class="card options">'+button(s.targetMethod==='manual'?'manual':'auto','Configurar mis macronutrientes','Calcularlos o introducirlos a mano','▦')+'</div>'+paletteForm()+'<div class="card">'+button('backup','Copias de seguridad','Exportar o importar mis datos','⇧')+'</div><small class="version">NutriTrack v5.6.5</small>';
}
function wireDesign(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
 document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{goalPanel=b.dataset.panel;render();window.scrollTo(0,0)});
 bindForm('edit-goal',f=>{const s=state.settings;if(s.targetMethod==='auto')return saveGoals({...s,...f});
 Object.assign(s,{goalMode:f.goalMode,goal:Number(f.goal)});goalPanel='';save();render()});
 const session=$('#add-session');if(session){
 session.elements.routine.onchange=e=>{clearSession();draft.routine=e.target.value;render()};
 session.querySelectorAll('[data-set]').forEach(el=>el.onchange=()=>{if(el.checked)draft.sets.add(el.dataset.set);else draft.sets.delete(el.dataset.set)});
 for(const k of ['minutes','intensity'])session.elements[k].oninput=e=>draft[k]=n(e.target.value);
 }
 wireExtras();
 document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{if(!timerEnd&&!alarmOn){timerLength=Number(b.dataset.duration);updateTimer()}});
 if($('#timer-toggle')){$('#timer-toggle').onclick=()=>startTimer(timerEnd||alarmOn?0:timerLength);updateTimer()}
 for(const [id,set] of [['choose-exercise',v=>exerciseChoice=v],['exercise-days',v=>exerciseDays=Number(v)],['progress-days',v=>progressDays=Number(v)]])if($('#'+id))$('#'+id).onchange=e=>{set(e.target.value);render()};
 for(const [selector,label] of [['#choose-exercise','Ejercicio'],['#add-session select[name=routine]','Rutina']]){
   const select=$(selector);if(select)enablePicker(select,label);
 }

 if($('#month-history'))$('#month-history').onclick=()=>{historyFilter=month;tab='gym';gymTab='historial';render();window.scrollTo(0,0)};
}

let openRoutine='';
const palettes={green:['Verde',140,'#acf45e'],blue:['Azul',215,'#92c6ff'],pink:['Rosa',329,'#ffb4db'],orange:['Naranja',26,'#ffc48a'],red:['Rojo',355,'#ffb1ab']};
function applyPalette(){
  const root=document.documentElement;
  const key=Object.hasOwn(palettes,state.settings.palette||'')?state.settings.palette:'green';
  root.dataset.palette=key;
  root.style.setProperty('--h',palettes[key][1]);
  root.style.setProperty('--tone',palettes[key][2]);
  const flame=palettes[state.settings.flame]||palettes[key];
  root.style.setProperty('--flame-edge',flame===palettes.green?'#abf746':flame[2]);
  root.style.setProperty('--flame-fill',flame===palettes.green?'#51c934':'hsl('+flame[1]+' 58% 52%)');
  root.style.setProperty('--flame-shadow',flame===palettes.green?'#49763c':'hsl('+flame[1]+' 33% 35%)');
}
function paletteForm(){
 const options=k=>Object.entries(palettes).map(([id,[label]])=>'<option value="'+id+'" '+(k===id?'selected':'')+'>'+label+'</option>').join('');
 return '<div class="card stack"><h3>Apariencia</h3><label>Tema<select id="palette">'+options(state.settings.palette||'green')+'</select></label><label>Color de la llama<select id="flame"><option value="">Usar el del tema</option>'+options(state.settings.flame)+'</select></label></div>';
}
function energyTitle(t){
 const goal=Number(state.settings.kcal),pct=goal>0?Math.min(100,100*t.kcal/goal):0;
 const celebrate=pct>=100&&state.energyCelebrated!==today();
 if(celebrate){state.energyCelebrated=today();save()}
 return '<h1 class="energy-title '+(celebrate?'complete':'')+'" style="--filled:'+pct+'%">NutriTrack</h1>';
}
function measureStatus(day){
 const labels=[day.weight?'Peso':'',day.waist?'Cintura':''].filter(Boolean);
 return labels.length?'✓ '+(labels.length===2?'Peso y cintura registrados':labels[0]+(day.weight?' registrado':' registrada'))+' hoy':'';
}
function measureForm(){
 const date=today(),day=record(date);
 return '<section class="daily-log"><h2>Registro diario</h2><p>Para comparar tus medidas, tómalas en condiciones parecidas. Por ejemplo, por la mañana, antes de desayunar.</p><form id="measures" class="grid" data-date-key="'+date+'">'+
 [['weight','Peso (kg)'],['waist','Cintura (cm)']].map(([key,label])=>'<label>'+label+'<input name="'+key+'" type="number" inputmode="decimal" min="0.1" step="any" value="'+(Number(day[key])||'')+'"></label>').join('')+
 '<button type="submit">Guardar registro</button></form><small role="status" id="measure-status">'+measureStatus(day)+'</small></section>';
}
function goalSnapshot(){
 return Object.fromEntries(nutritionKeys.map(k=>[k,state.settings[k]]));
}
function monthNutrition(){
 const days=Object.entries(state.entries).filter(([d,r])=>d.startsWith(month)&&d<=today()&&r.meals?.length);
 const estimates=days.some(([,r])=>!r.nutritionGoal);
 const metrics=nutritionKeys.map(k=>{
   const ratios=days.flatMap(([d,r])=>{
     const target=Number((r.nutritionGoal||state.settings)[k]);
     return target>0?[totals(d)[k]/target]:[];
   });
   const value=ratios.length?fmt(Math.round(100*ratios.reduce((s,v)=>s+v,0)/ratios.length))+' %':'—';
   return '<div><small>'+(macroNames[k]||'Calorías')+'</small><b>'+value+'</b></div>';
 }).join('');
 return '<section class="card"><h3>Resumen de alimentación</h3><p>'+days.length+' '+(days.length===1?'día con comidas registradas':'días con comidas registradas')+'</p><div class="nutrition-grid">'+metrics+'</div><small>Media diaria de lo consumido respecto al objetivo. Solo cuentan los días con comidas. El 100 % equivale al objetivo.</small>'+(estimates?'<small>Para los registros antiguos sin objetivo guardado se usa el objetivo actual como estimación.</small>':'')+'</section>';
}
function wireExtras(){
 for(const [id,field] of [['palette','palette'],['flame','flame']]){
   const el=$('#'+id);if(el)el.onchange=()=>{state.settings[field]=el.value;save();render()};
 }
 for(const routine of document.querySelectorAll('.routine')){
   routine.ontoggle=()=>{if(routine.open)openRoutine=routine.dataset.rid;else if(openRoutine===routine.dataset.rid)openRoutine=''};
   routine.querySelector('[data-fold]').onclick=()=>{openRoutine='';routine.open=false;save()};
 }
 const toggle=$('#toggle-meal');
 if(toggle)toggle.onclick=()=>{
   const editor=$('#meal-editor');editor.hidden=!editor.hidden;
   toggle.setAttribute('aria-expanded',String(!editor.hidden));
 };
 const measures=$('#measures');
 if(measures){
   const date=measures.dataset.dateKey;
   let revision=0;
   async function commit(){
     if(!measures.reportValidity()||date!==today())return;
     const stamp=++revision,day=record(date);
     const changes=Array.from(measures.querySelectorAll('input'),input=>[input.name,input.value===''?null:input.valueAsNumber]);
     const changed=changes.some(([key,value])=>day[key]!==value);
     if(!changed&&!day.weight&&!day.waist){
       $('#measure-status').textContent='Introduce el peso o la cintura.';return;
     }
     const ok=changed?await mutate(()=>{for(const [key,value] of changes)day[key]=value},date,false):await save();
     if(measures.isConnected&&stamp===revision)$('#measure-status').textContent=ok?(measureStatus(day)||'✓ Medidas borradas'):'No se pudo guardar';
   }
   measures.oninput=()=>{revision++;$('#measure-status').textContent=''};
   measures.onchange=commit;
   measures.onsubmit=e=>{e.preventDefault();commit()};
 }
}
