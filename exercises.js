'use strict';
function exerciseValues(ex){
  return {name:ex.name.trim(),sets:Number(ex.sets)||3,reps:Number(ex.reps)||10,kg:Number(ex.kg)||0};
}
function seedLibrary(){
  if(Array.isArray(state.exerciseLibrary))return;
  state.exerciseLibrary=[];
  for(const routine of state.routines)for(const exercise of routine.exercises){
    const values=exerciseValues(exercise);
    let template=state.exerciseLibrary.find(x=>Object.keys(values).every(k=>x[k]===values[k]));
    if(!template){template={id:uid(),...values};state.exerciseLibrary.push(template)}
    exercise.templateId=template.id;
  }
  save();
}
function exerciseFields(){
  return '<label>Nombre del ejercicio<input name="name" maxlength="100" required placeholder="Ej. Press banca"></label><div class="three">'+
    [['sets','Series',3,1,20],['reps','Repeticiones',10,1,100],['kg','Peso (kg)',0,0,'']].map(([k,label,v,min,max])=>
    '<label>'+label+'<input type="number" name="'+k+'" value="'+v+'" min="'+min+'" '+(max?'max="'+max+'"':'')+' step="'+(k==='kg'?'any':'1')+'" required></label>').join('')+'</div>';
}
function exerciseComposer(routine){
  return '<div class="composer" data-composer="'+esc(routine.id)+'"><div class="actions"><button type="button" data-mode="new">Crear ejercicio</button><button type="button" class="secondary" data-mode="saved">Añadir ejercicio ya creado</button></div><div data-editor></div></div>';
}
let editingExercise='';
function exerciseLibraryScreen(){
  const editing=state.exerciseLibrary.find(x=>x.id===editingExercise);
  return '<div class="card"><h3>'+ (editing?'Editar ejercicio':'Crear ejercicio')+'</h3><form id="library-create" class="stack">'+exerciseFields()+'<button>'+ (editing?'Guardar cambios':'Guardar ejercicio')+'</button>'+ (editing?'<button type="button" class="secondary" id="cancel-library">Cancelar</button>':'')+'</form></div><div class="card"><h3>Mis ejercicios</h3>'+
    (state.exerciseLibrary.map(ex=>'<div class="entry"><div><b>'+esc(ex.name)+'</b><small>'+ex.sets+' series × '+ex.reps+' rep. · '+fmt(ex.kg)+' kg</small></div><button class="secondary tiny" data-library-edit="'+esc(ex.id)+'">Editar</button></div>').join('')||'<small>Aún no tienes ejercicios guardados.</small>')+'</div>';
}
function chooseTemplateAction(){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='card template-dialog';
    dialog.innerHTML='<h3>Has cambiado el ejercicio</h3><p>¿Quieres actualizar el ejercicio guardado o crear uno nuevo con estos datos? Las rutinas anteriores conservan su planificación.</p><div class="stack"><button data-answer="update">Actualizar ejercicio</button><button data-answer="copy">Crear uno nuevo</button><button class="secondary" data-answer="cancel">Cancelar</button></div>';
    const scrollY=window.scrollY;
    document.body.style.setProperty('--locked-top',-scrollY+'px');
    document.body.classList.add('modal-locked');
    document.body.append(dialog);
    dialog.onclick=e=>{if(e.target.dataset.answer)dialog.close(e.target.dataset.answer)};
    dialog.onclose=()=>{
      document.body.classList.remove('modal-locked');document.body.style.removeProperty('--locked-top');
      window.scrollTo(0,scrollY);resolve(dialog.returnValue);dialog.remove();
    };dialog.showModal();
  });
}
function wireExerciseLibrary(){
  const form=$('#library-create'),editing=state.exerciseLibrary?.find(x=>x.id===editingExercise);
  if(form&&editing){
    for(const [k,v] of Object.entries(exerciseValues(editing)))form.elements[k].value=v;
    $('#cancel-library').onclick=()=>{editingExercise='';render()};
  }
  for(const btn of document.querySelectorAll('[data-library-edit]'))btn.onclick=()=>{
    editingExercise=btn.dataset.libraryEdit;render();$('#library-create').scrollIntoView({block:'center'});
  };
  bindForm('library-create',f=>{
    if(!f.name.trim())return alert('Introduce un nombre.');
    if(editing)Object.assign(editing,exerciseValues(f));else state.exerciseLibrary.push({id:uid(),...exerciseValues(f)});
    editingExercise='';save();render();
  });
  for(const box of document.querySelectorAll('[data-composer]')){
    for(const button of box.querySelectorAll('[data-mode]'))button.onclick=()=>{
      const saved=button.dataset.mode==='saved',editor=box.querySelector('[data-editor]');
      if(saved&&!state.exerciseLibrary.length){editor.innerHTML='<small>Todavía no hay ejercicios guardados. Pulsa Crear ejercicio.</small>';return}
      editor.innerHTML='<form class="stack">'+(saved?'<label>Ejercicio guardado<select name="template" required>'+optionList(state.exerciseLibrary)+'</select></label>':'')+exerciseFields()+'<button>Añadir a la rutina</button></form>';
      const form=editor.querySelector('form');
      if(saved)form.elements.template.onchange=()=>{
        const template=state.exerciseLibrary.find(x=>x.id===form.elements.template.value);
        if(template)for(const [k,v] of Object.entries(exerciseValues(template)))form.elements[k].value=v;
      };
      if(saved){form.elements.template.required=false;enablePicker(form.elements.template,'Ejercicio guardado')}
      form.onsubmit=async e=>{
        e.preventDefault();
        const values=exerciseValues(Object.fromEntries(new FormData(form)));
        if(!values.name)return alert('Introduce un nombre.');
        let template=saved&&state.exerciseLibrary.find(x=>x.id===form.elements.template.value);
        if(saved&&!template)return alert('Selecciona un ejercicio guardado.');
        if(template&&Object.keys(values).some(k=>values[k]!==template[k])){
          const choice=await chooseTemplateAction();
          if(choice==='update')Object.assign(template,values);
          else if(choice==='copy')template=null;else return;
        }
        if(!template){template={id:uid(),...values};state.exerciseLibrary.push(template)}
        state.routines.find(r=>r.id===box.dataset.composer).exercises.push({id:uid(),templateId:template.id,...values});
        openRoutine=box.dataset.composer;save();render();
      };
    };
  }
}
