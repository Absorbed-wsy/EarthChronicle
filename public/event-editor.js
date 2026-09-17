import {CATEGORIES} from './domain.js';
import {countryOptions} from './geography.js';

export function initEventEditor({context,map,api,onSaved,onStart=()=>{},toast}) {
  const $=id=>document.getElementById(id),form=$('event-form'),dialog=$('event-dialog');
  const fields=form.elements;
  let editingId=null,point=null,picking=false,resumeForm=false,ignoreClose=false,busy=false;
  const editable=()=>context().session.interface==='local'&&context().session.canEdit===true;
  const cities=()=>context().places.filter(place=>!place.isCustom);
  function syncCities() {
    const options=cities().filter(place=>place.countryCode===fields.countryCode.value);
    $('event-city-options').replaceChildren(...options.map(place=>{
      const option=document.createElement('option');option.value=place.name;option.label=place.regionName||'';return option;
    }));
  }
  function showPoint() {
    $('event-coordinates').textContent=point?`${Math.abs(point.lat).toFixed(6)}° ${point.lat>=0?'N':'S'} · ${Math.abs(point.lon).toFixed(6)}° ${point.lon>=0?'E':'W'}`:'未选择位置';
    map()?.setDraftPoint(point);
  }
  function finish() {
    picking=false;point=null;resumeForm=false;editingId=null;
    $('map-pick-bar').hidden=true;map()?.setPicking(false);map()?.setDraftPoint(null);
  }
  function beginPicking(resume=false) {
    if(!editable()||busy||picking)return;
    if(!map()){toast('地图加载中');return;}
    onStart();resumeForm=resume;picking=true;
    if(dialog.open){ignoreClose=true;dialog.close();}
    $('map-pick-bar').hidden=false;map().setPicking(true);map().setDraftPoint(point);
    map().map.getCanvas().focus({preventScroll:true});
  }
  function cancelPicking() {
    if(!picking)return;
    picking=false;$('map-pick-bar').hidden=true;map()?.setPicking(false);
    if(resumeForm){dialog.showModal();showPoint();}
    else {finish();$('add-button').focus({preventScroll:true});}
  }
  function initialize(event=null) {
    form.reset();editingId=event?.id||null;
    form.querySelector('h2').textContent=event?'编辑事件':'记录事件';
    $('form-error').textContent='';
    const state=context(),place=event?state.places.find(p=>p.id===event.placeId):null;
    fields.countryCode.replaceChildren(...[{code:'',name:'选择国家'},...countryOptions(state.countryFeatures,state.places)].map(country=>{
      const option=document.createElement('option');option.value=country.code;option.textContent=country.name;return option;
    }));
    fields.category.replaceChildren(...CATEGORIES.map(category=>{
      const option=document.createElement('option');option.value=category;option.textContent=category;return option;
    }));
    fields.category.value=event?.category||'文化';
    fields.countryCode.value=place?.countryCode||(state.countryCode==='all'?'':state.countryCode);
    fields.regionName.value=place?.regionName||'';
    fields.cityName.value=place?(place.isCustom?place.cityName||'':place.name):'';
    fields.locationName.value=place?.name||'';
    for(const name of ['title','summary','sourceTitle','sourceUrl'])fields[name].value=event?.[name]||'';
    const year=event?.year??state.year;
    fields.year.value=year<=0?1-year:year;fields.yearEra.value=year<=0?'bce':'ce';
    fields.endYear.value=event?.endYear==null?'':event.endYear<=0?1-event.endYear:event.endYear;
    fields.endEra.value=event?.endYear!=null&&event.endYear<=0?'bce':'ce';
    point=place?{lon:place.lon,lat:place.lat}:null;
    syncCities();showPoint();
  }
  function start() {
    if(!editable()||busy||picking||dialog.open)return;
    if(!map()){toast('地图加载中');return;}
    initialize();beginPicking();
  }
  function edit(event) {
    if(!editable()||busy||picking||dialog.open||!event?.userCreated)return;
    onStart();finish();initialize(event);dialog.showModal();
  }
  function pickPoint(next) {
    if(!editable()||!picking||!Number.isFinite(next?.lon)||!Number.isFinite(next?.lat)||Math.abs(next.lon)>180||Math.abs(next.lat)>90)return;
    point={lon:next.lon,lat:next.lat};picking=false;
    map().setPicking(false);$('map-pick-bar').hidden=true;
    if(!fields.locationName.value&&next.name)fields.locationName.value=next.name;
    if(next.countryCode&&[...fields.countryCode.options].some(option=>option.value===next.countryCode)&&!resumeForm){fields.countryCode.value=next.countryCode;fields.regionName.value='';fields.cityName.value='';syncCities();}
    showPoint();dialog.showModal();fields.locationName.focus();
  }
  fields.countryCode.addEventListener('change',()=>{fields.regionName.value='';fields.cityName.value='';syncCities();});
  fields.cityName.addEventListener('change',()=>{
    const matches=cities().filter(place=>place.countryCode===fields.countryCode.value&&place.name===fields.cityName.value.trim());
    if(matches.length===1)fields.regionName.value=matches[0].regionName||'';
  });
  $('pick-event-location').onclick=()=>beginPicking(true);
  $('cancel-map-pick').onclick=cancelPicking;
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&picking){event.preventDefault();cancelPicking();}});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{if(ignoreClose){ignoreClose=false;return;}finish();});
  form.onsubmit=async event=>{
    event.preventDefault();if(!editable()||busy)return;
    if(!point){$('form-error').textContent='请先在地图上选择位置。';return;}
    const data=Object.fromEntries(new FormData(form));
    const year=value=>Number(value);
    const start=year(data.year),end=data.endYear===''?null:year(data.endYear);
    const location={name:data.locationName.trim(),lon:point.lon,lat:point.lat,countryCode:data.countryCode,regionName:data.regionName.trim(),cityName:data.cityName.trim()};
    const matchingCities=cities().filter(place=>place.countryCode===location.countryCode&&place.name===location.cityName&&(!location.regionName||place.regionName===location.regionName));
    if(matchingCities.length===1)location.cityId=matchingCities[0].id;
    const payload={title:data.title,year:data.yearEra==='bce'?1-start:start,endYear:end===null?null:data.endEra==='bce'?1-end:end,location,category:data.category,summary:data.summary,sourceTitle:data.sourceTitle.trim()||'个人记录',sourceUrl:data.sourceUrl};
    if(payload.endYear!==null&&payload.endYear<payload.year){$('form-error').textContent='结束年份不得早于起始年份。';return;}
    busy=true;dialog.dataset.busy='true';const controls=[...form.querySelectorAll('input,select,textarea,button')].map(element=>[element,element.disabled]);for(const [element] of controls)element.disabled=true;$('form-error').textContent='';
    try {
      const result=await api(editingId?'/api/events/'+encodeURIComponent(editingId):'/api/events',{method:editingId?'PUT':'POST',body:JSON.stringify(payload)});
      editingId=result.event.id;
      await onSaved(result.event);dialog.close();finish();toast('事件已保存');
    }catch(error){$('form-error').textContent=error.message;}
    finally{busy=false;dialog.dataset.busy='false';for(const [element,disabled] of controls)element.disabled=disabled;}
  };
  return {start,edit,pickPoint};
}
