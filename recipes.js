'use strict';
const nutritionKeys=['kcal','p','f','c'];
const sharedRecipe=r=>r.type!=='individual';
const blankNutrition=()=>({kcal:0,p:0,f:0,c:0});
function ingredientTotals(parts) {
  const total=blankNutrition();
  for(const part of parts) for(const key of nutritionKeys)
    total[key]+=Number(part.unit[key])*part.grams/100;
  return Object.fromEntries(nutritionKeys.map(key=>[key,round(total[key])]));
}
function matchingItems(items,query){
  const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  return items.filter(x=>fold(x.name).includes(fold(query)));
}
function optionList(items){
  return '<option value="">Selecciona…</option>'+items.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
}
function searchable(label){
  return '<details class="picker"><summary aria-label="'+label+'"><span>Selecciona…</span></summary><div class="picker-menu"><input type="search" aria-label="Buscar '+label+'" placeholder="Buscar…"><div class="picker-results"></div></div></details>';
}
function bindPicker(box,items,onChange,initial=''){
  const picker=box.querySelector('.picker'),filter=picker.querySelector('input'),results=picker.querySelector('.picker-results');
  function select(id){
    const selected=items.find(item=>item.id===id);
    picker.dataset.id=selected?.id||'';
    picker.querySelector('summary span').textContent=selected?.name||'Selecciona…';
    onChange?.(selected);
  }
  function refresh(){
    results.innerHTML=matchingItems(items,filter.value).map(item=>'<button type="button" data-id="'+esc(item.id)+'">'+esc(item.name)+'</button>').join('')||'<small>Sin coincidencias</small>';
  }
  results.onclick=e=>{
    const btn=e.target.closest('[data-id]');if(!btn)return;
    select(btn.dataset.id);picker.open=false;picker.querySelector('summary').focus();
  };
  picker.ontoggle=()=>{if(picker.open){filter.value='';refresh();filter.focus()}};
  picker.onkeydown=e=>{if(e.key==='Escape'){picker.open=false;picker.querySelector('summary').focus()}};
  filter.oninput=refresh; select(initial);
}
function enablePicker(select,label){
  const host=document.createElement('div');host.innerHTML=searchable(label);
  // Keep the original select as the form value and reuse its change handler.
  const parent=select.parentElement;
  (parent.tagName==='LABEL'?parent:select).after(host);
  if(parent.tagName==='LABEL')parent.hidden=true;
  select.hidden=true;
  const items=[...select.options].filter(x=>x.value).map(x=>({id:x.value,name:x.textContent}));
  bindPicker(host,items,item=>{
    const next=item?.id||'';
    if(select.value===next)return;
    select.value=next;select.dispatchEvent(new Event('change'));
  },select.value);
}
let editRecipeId='';
function photoControls(){
  return '<div class="actions"><label class="photo-button">Cámara<input type="file" capture="environment" accept="image/*"></label><label class="photo-button">Galería<input type="file" accept="image/*"></label></div>';
}
function recipesScreen(){
  const editing=state.recipes.find(r=>r.id===editRecipeId);
  const list=state.recipes.map(r=>'<article class="saved-recipe">'+
    '<div class="recipe-info">'+thumb(r)+'<div><b>'+esc(r.name)+'</b><small>'+ (sharedRecipe(r)?fmt(r.finalWeight)+' g preparados':'Plato individual')+' · '+fmt(r.kcal)+' kcal</small></div></div>'+
    '<div class="actions"><button class="secondary tiny" data-edit-recipe="'+esc(r.id)+'">Editar receta</button><button class="danger tiny" data-delete-recipe="'+esc(r.id)+'">Eliminar</button></div></article>').join('');
  return '<div class="card"><h3>'+(editing?'Editar receta':'Crear receta')+'</h3><form id="create-recipe" class="stack"><label>Nombre<input name="name" required maxlength="100"></label><label>¿Para quién cocinas?<select name="type" required><option value="">Elige el tipo de plato</option><option value="individual">Plato individual</option><option value="shared">Plato para varias personas</option></select></label><small>Individual: se registra el plato entero. Para varias personas: pesa toda la comida ya cocinada, sin el recipiente. Al servirte, apunta solo los gramos de tu plato.</small><div id="recipe-rows"></div><button id="another-row" type="button" class="secondary">Añadir ingrediente</button><label hidden id="yield-label">Peso total cocinado (g)<input name="yield" type="number" min="0.1" step="any" required></label><section class="recipe-photo"><b>Foto opcional</b>'+photoControls()+'<div id="recipe-preview"></div><button hidden class="danger tiny" type="button" id="remove-recipe-photo">Quitar foto</button></section><button type="submit">Guardar receta</button>'+(editing?'<button type="button" class="secondary" id="cancel-recipe">Cancelar edición</button>':'')+'</form></div><div class="card"><h3>Mis recetas</h3>'+list+'</div>';
}
function mealForm(){
  return '<form id="log-meal" class="stack"><label>Comida<select name="kind">'+['Desayuno','Comida','Merienda','Cena','Otros'].map(k=>'<option>'+k+'</option>').join('')+'</select></label><label>Qué vas a registrar<select name="source"><option value="food">Productos</option><option value="recipe">Recetas</option></select></label><div id="meal-picker" class="stack"></div><div id="portion"></div><button>Añadir al día</button></form>';
}
function addIngredient(part){
  const box=document.createElement('div');box.className='ingredient compact-row';
  box.innerHTML='<div><small>Producto</small>'+searchable('Ingrediente')+'</div><label><small>Gramos</small><input data-grams aria-label="Gramos del ingrediente" type="number" min=".1" step="any" required></label><button class="secondary tiny" type="button" data-remove aria-label="Quitar ingrediente">×</button>';
  $('#recipe-rows').append(box);
  const items=[...state.foods];
  if(part&&!items.some(x=>x.id===part.id))items.push({id:part.id,name:part.name});
  bindPicker(box,items,food=>{
    box.selectedFood=food?.id===part?.id&&part?part.unit:food;
  },part?.id);
  if(part)box.querySelector('[data-grams]').value=part.grams;
  box.querySelector('[data-remove]').onclick=()=>box.remove();
}
function wireCreateRecipe(form){
  const editing=state.recipes.find(r=>r.id===editRecipeId);
  const original=editing?recipeParts(editing):[];
  if(editing){
    form.elements.name.value=editing.name;form.elements.type.value=sharedRecipe(editing)?'shared':'individual';
    form.elements.yield.value=editing.finalWeight||'';original.forEach(addIngredient);
    $('#cancel-recipe').onclick=()=>{editRecipeId='';render()};
  }else addIngredient();
  $('#another-row').onclick=()=>addIngredient();
  const yieldInput=form.elements.yield;
  form.elements.type.onchange=()=>{
    const shared=form.elements.type.value==='shared';
    $('#yield-label').hidden=!shared; yieldInput.disabled=!shared; yieldInput.required=shared;
  };
  form.elements.type.onchange();
  let photo=editing?.photo||'',imageToken=0;
  const submit=form.querySelector('[type=submit]'), remove=$('#remove-recipe-photo');
  function preview(){remove.hidden=!photo;$('#recipe-preview').innerHTML=thumb({photo})}
  preview();remove.onclick=()=>{imageToken++;photo='';submit.disabled=false;preview();form.querySelectorAll('[type=file]').forEach(el=>el.value='')};
  for(const input of form.querySelectorAll('[type=file]')) input.onchange=async()=>{
    const file=input.files[0];if(!file)return;
    const token=++imageToken;submit.disabled=true;
    try{const data=await compressPhoto(file);if(token===imageToken&&form.isConnected){photo=data;preview()}}
    catch{alert('No se ha podido leer la foto.')}finally{if(token===imageToken)submit.disabled=false}
  };
  form.onsubmit=e=>{
    e.preventDefault();if(submit.disabled)return;
    const parts=[...form.querySelectorAll('.ingredient')].map(box=>{
      const picker=box.querySelector('.picker'),food=box.selectedFood;
      return {id:picker.dataset.id,name:picker.querySelector('summary span').textContent,unit:food?Object.fromEntries(nutritionKeys.map(k=>[k,n(food[k])])):null,grams:Number(box.querySelector('[data-grams]').value)};
    });
    if(!parts.length||parts.some(p=>!p.id)||!form.elements.name.value.trim())return alert('Selecciona un producto en cada fila y escribe el nombre de la receta.');
    const unchanged=editing&&parts.length===original.length&&parts.every((p,i)=>p.id===original[i].id&&p.grams===original[i].grams);
    if(!unchanged&&parts.some(p=>!p.unit))return alert('Hay un ingrediente antiguo sin información nutricional. Selecciona su producto antes de guardar.');
    const totals=unchanged?Object.fromEntries(nutritionKeys.map(k=>[k,editing[k]])):ingredientTotals(parts);
    const record={name:form.elements.name.value.trim(),type:form.elements.type.value,photo,parts,finalWeight:yieldInput.disabled?null:Number(yieldInput.value),...totals};
    if(editing)Object.assign(editing,record);else state.recipes.push({id:uid(),...record});
    editRecipeId='';save();render();
  };
}
function recipeParts(recipe){
  return (recipe.parts||[]).map(p=>{
    const food=state.foods.find(x=>x.id===p.id);
    return {...p,name:p.name||food?.name||'Producto antiguo',unit:p.unit||food};
  });
}
function wireMeal(form){
  const box=$('#portion'),picker=$('#meal-picker');
  let item,parts=[],overrides=new Map();
  const isRecipe=()=>form.elements.source.value==='recipe';
  function selectSource(){
    const items=isRecipe()?state.recipes:state.foods;
    picker.innerHTML=searchable(isRecipe()?'Receta':'Producto');
    bindPicker(picker,items,chosen=>{
      item=chosen;
      showPortion();
    });
  }
  function showPortion(){
    box.innerHTML=''; overrides.clear(); if(!item)return;
    const recipe=isRecipe(),shared=recipe&&sharedRecipe(item);
    parts=recipe?recipeParts(item):[];
    box.innerHTML=thumb(item)+ (recipe&&!shared?'<p>Plato individual · se registra entero.</p>':
      '<label>'+(shared?'Peso servido en tu plato, ya cocinado':'Cantidad consumida')+' (g)<input name="grams" type="number" min=".1" step="any" required '+(shared?'max="'+Number(item.finalWeight)+'"':'')+'></label>')+
      (recipe&&parts.length&&parts.every(p=>p.unit)?'<details id="adjust"><summary>Ajustar ingredientes de mi plato</summary><small>Las cantidades son gramos en la forma indicada en la etiqueta, antes de cocinar si el producto está en crudo. Pon 0 si no te serviste un ingrediente. Si hay más de otro, ajusta también su cantidad.</small><div id="portion-parts"></div></details>':recipe?'<small>Para ajustar esta receta antigua necesitas disponer de sus ingredientes.</small>':'');
    const host=$('#portion-parts');
    if(!host)return;
    const draw=()=>{
      const served=shared?Number(form.elements.grams.value):null;
      if(shared&&!(served>0&&served<=item.finalWeight)){
        host.innerHTML='<small>Introduce primero el peso servido. Verás los gramos de cada ingrediente correspondientes a esa ración.</small>';return;
      }
      const fraction=shared?served/item.finalWeight:1;
      host.innerHTML=parts.map((p,i)=>'<label>'+esc(p.name)+' (g)<input type="number" step="any" min="0" data-part="'+i+'" value="'+(overrides.get(i)??round(p.grams*fraction))+'"></label>').join('');
    };
    host.oninput=e=>{if(e.target.hasAttribute('data-part'))overrides.set(Number(e.target.dataset.part),e.target.value)};
    draw();if(shared)form.elements.grams.oninput=draw;
  }
  form.elements.source.onchange=selectSource;selectSource();
  form.onsubmit=e=>{
    e.preventDefault();if(!item)return alert("Selecciona un producto o una receta.");
    const recipe=isRecipe(),individual=recipe&&!sharedRecipe(item);
    const grams=individual?null:Number(form.elements.grams.value);
    const factor=individual?1:recipe?grams/item.finalWeight:grams/100;
    let values=Object.fromEntries(nutritionKeys.map(k=>[k,round(item[k]*factor)]));
    let adjustedParts;
    if(overrides.size){
      adjustedParts=parts.map((p,i)=>({...p,grams:Number(box.querySelector('[data-part="'+i+'"]').value)}));
      if(!adjustedParts.some(p=>p.grams>0))return alert('Indica al menos un ingrediente servido.');
      values=ingredientTotals(adjustedParts);
    }
    mutate(()=>{
      const day=record(selected);
      if(selected===today()) day.nutritionGoal=goalSnapshot();
      day.meals.push({id:uid(),kind:form.elements.kind.value,sourceType:form.elements.source.value,sourceId:item.id,name:item.name,grams,
        portion:individual?'individual':recipe?'shared':'product',adjusted:!!adjustedParts,
        ...(adjustedParts?{servedParts:adjustedParts.map(({id,name,grams})=>({id,name,grams}))}:{}),...values});
    });
  };
}
function wireRecipes(){
  if($('#create-recipe'))wireCreateRecipe($('#create-recipe'));
  if($('#log-meal'))wireMeal($('#log-meal'));
  for(const btn of document.querySelectorAll('[data-edit-recipe]'))btn.onclick=()=>{
    editRecipeId=btn.dataset.editRecipe;render();$('#create-recipe').scrollIntoView({block:'start'});
  };
}
