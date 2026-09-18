import {initPreferences,readLegacyPreferences} from './preferences.js';
import {initSettings} from './settings.js';
import {initMapView} from './map-view.js';
import * as maplibregl from './vendor/maplibre/maplibre-gl.mjs';
import {CATEGORIES,eraForYear,yearLabel,eventMatches,eventIsActive,escapeHtml as h,safeSourceUrl} from './domain.js';
import {periodsForCountry,periodBounds,periodsForYear,yearTickLabel} from './history-navigation.js';
import {EVENT_PAGE_SIZE,eventYearGroups,timelineStops} from './history-index.js';
import {countryOptions,countryName,placesInCountry} from './geography.js';
import {initCountryPicker} from './country-picker.js';
import {initEventEditor} from './event-editor.js';
const $=id=>document.getElementById(id);
const currentYear=()=>new Date().getFullYear();
const state={year:currentYear(),scope:'year',countryCode:'CN',region:'all',city:'all',period:'all',category:'all',query:'',page:0,selected:null,labels:true,events:[],places:[],countryFeatures:null,session:{},min:-769,max:currentYear()};
let mapView,playTimer,toastTimer,preferences,settings,countryPicker,eventEditor,pendingPreferences=null,preferencesTimer,preferencesSaving;
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(state.session.token?{'X-Edit-Token':state.session.token}:{}),...options.headers}});const data=await response.json();if(!response.ok)throw new Error(data.error||'请求未完成，请重试。');return data;}
let indexedPlaces,placesById;
function placeIndex(){if(indexedPlaces!==state.places){indexedPlaces=state.places;placesById=new Map(state.places.map(place=>[place.id,place]));}return placesById;}
const placeOf=event=>placeIndex().get(event?.placeId);
const historySort=(a,b)=>b.year-a.year||a.title.localeCompare(b.title,'zh-CN')||a.id.localeCompare(b.id);
const matchingEvents=(scope=state.scope)=>state.events.filter(e=>eventMatches(e,{...state,scope},placeIndex())).sort(historySort);
const filtered=()=>matchingEvents();
const countryPlaces=()=>placesInCountry(state.places,state.countryCode);
const regionalPlaces=()=>countryPlaces().filter(p=>state.region==='all'||p.regionCode===state.region);
const cityIdOf=place=>place?.isCustom?place.cityId||'':place?.id;
function cityOptions(places){const cities=new Map();for(const place of places){const id=cityIdOf(place);if(id&&!cities.has(id))cities.set(id,{...place,id,name:place.isCustom?place.cityName:place.name});}return [...cities.values()];}
const canEdit=()=>state.session.interface==='local'&&state.session.canEdit===true;
const regionTitle=()=>state.city!=='all'?cityOptions(state.places).find(p=>p.id===state.city)?.name:state.region==='all'?(state.countryCode==='all'?'全球':countryName(state.countryCode)):countryPlaces().find(p=>p.regionCode===state.region)?.regionName;
function updateBounds(){
  if(!periodsForCountry(state.countryCode).some(p=>p.id===state.period))state.period='all';
  [state.min,state.max]=periodBounds(state.period,currentYear(),state.countryCode);
  if(state.period==='all')for(const e of state.events){if(state.countryCode==='all'||placeOf(e)?.countryCode===state.countryCode){state.min=Math.min(state.min,e.year);state.max=Math.max(state.max,e.endYear??e.year);}}
}
function yearGroups(){return eventYearGroups(matchingEvents('all'),state.min,state.max);}
const eventRange=e=>e.endYear!=null&&e.endYear!==e.year?`${yearLabel(e.year)}—${yearLabel(e.endYear)}`:yearLabel(e.year);
function yearEra(year,countryCode=state.countryCode){if(countryCode!=='CN')return '';const era=eraForYear(year);return era.includes(' · ')?era:periodsForYear(year,currentYear(),countryCode).map(p=>p.name).join(' / ')||era;}
function activeEra(e){return e.era||yearEra(e.year,placeOf(e)?.countryCode??'');}
function stopPlayback(){clearInterval(playTimer);playTimer=null;$('play').textContent='▶';$('play').setAttribute('aria-label','播放时间轴');}
function syncYearInputs(){ $('year-era').value=state.year<=0?'bce':'ce';$('year-input').value=state.year<=0?1-state.year:state.year; }
function syncControls(){
  $('add-button').hidden=!canEdit();
    $('chapter-kicker').textContent='WORLD · HISTORY';$('chapter-title').textContent='世界历史';
    $('coverage').textContent=`已收录 ${state.events.filter(e=>state.countryCode==='all'||placeOf(e)?.countryCode===state.countryCode).length} 条事件`;$('list-label').textContent=`${regionTitle()} · ${state.scope==='all'?'全部年份':state.scope==='nearby'?'前后五年':yearLabel(state.year)}`;
    $('time-unit').textContent='年份';$('era-label').textContent=yearEra(state.year);syncYearInputs();$('year-input').min=1;$('year-input').max=9999;
    $('time-slider').min=state.min;$('time-slider').max=state.max;$('time-slider').value=state.year;$('time-slider').setAttribute('aria-label','浏览年份');$('time-slider').setAttribute('aria-valuetext',yearLabel(state.year));
    $('jump-start').textContent='起点';$('jump-end').textContent='终点';$('previous-year').setAttribute('aria-label','前一年');$('next-year').setAttribute('aria-label','后一年');
    $('time-ticks').innerHTML=Array.from({length:5},(_,i)=>`<span>${yearTickLabel(Math.round(state.min+(state.max-state.min)*i/4))}</span>`).join('');
    $('country-filter').innerHTML='<option value="all">全部</option>'+countryOptions(state.countryFeatures,state.places).map(c=>`<option value="${h(c.code)}">${h(c.name)}</option>`).join('');$('country-filter').value=state.countryCode;
    countryPicker?.sync();
    const regions=[...new Map(countryPlaces().filter(p=>p.regionCode).map(p=>[p.regionCode,state.countryCode==='all'?`${countryName(p.countryCode)} · ${p.regionName}`:p.regionName])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
    $('region-filter').innerHTML='<option value="all">全部</option>'+regions.map(([code,name])=>`<option value="${h(code)}">${h(name)}</option>`).join('');$('region-filter').value=state.region;$('region-filter').disabled=!regions.length;
    const cities=cityOptions(regionalPlaces());$('city-filter').innerHTML='<option value="all">全部</option>'+cities.map(p=>`<option value="${h(p.id)}">${h(p.name)}${state.countryCode==='all'?' · '+h(countryName(p.countryCode)):''}</option>`).join('');$('city-filter').value=state.city;$('city-filter').disabled=!cities.length;
    const periods=periodsForCountry(state.countryCode);$('period-filter').innerHTML=periods.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('');$('period-filter').value=state.period;$('period-filter').disabled=periods.length===1;
    const groups=yearGroups();
    $('year-filter').innerHTML='<option value="">年份</option>'+groups.map(g=>`<option value="${g.year}">${yearLabel(g.year)} · ${g.count} 条</option>`).join('');$('year-filter').value=groups.some(g=>g.year===state.year)?String(state.year):'';$('year-filter').disabled=!groups.length;
    const currentRecorded=groups.some(g=>g.year===state.year);
    const dots=timelineStops(groups,state.min,state.max,Math.max(20,Math.floor(($('event-dots').clientWidth||600)/14)))
      .map(g=>currentRecorded&&state.year>=g.first&&state.year<=g.last?{...g,year:state.year}:g);
    $('event-dots').innerHTML=dots.map(g=>{const label=`${g.first===g.last?yearLabel(g.year):yearTickLabel(g.first)+'—'+yearTickLabel(g.last)} · ${g.count} 条事件`;return `<button class="time-dot ${g.year===state.year?'active':''}" style="left:${(g.year-state.min)/Math.max(1,state.max-state.min)*100}%" data-year="${g.year}" title="${h(label)}" aria-label="跳转到 ${yearLabel(g.year)}，${h(label)}"></button>`;}).join('');
    $('previous-node').disabled=!groups.some(g=>g.year<state.year);$('next-node').disabled=!groups.some(g=>g.year>state.year);
    $('scope').value=state.scope;$('category').value=state.category;
  $('previous-year').disabled=$('jump-start').disabled=state.year<=state.min;
  $('next-year').disabled=$('jump-end').disabled=state.year>=state.max;
  for(const id of ['previous-year','next-year'])$(id).title=$(id).getAttribute('aria-label');
  syncMapControls();
}
function renderList(){
  const events=filtered();$('event-count').textContent=`${events.length} 条事件`;
  if(!events.length){$('event-list').innerHTML=`<div class="empty-state"><strong>暂无匹配记录</strong>${state.scope!=='all'?'<button id="browse-region">全部年份</button>':''}${state.query||state.category!=='all'?'<button id="clear-filters">重置检索</button>':''}</div>`;return;}
  const pages=Math.ceil(events.length/EVENT_PAGE_SIZE);state.page=Math.max(0,Math.min(state.page,pages-1));const offset=state.page*EVENT_PAGE_SIZE;
  $('event-list').innerHTML=events.slice(offset,offset+EVENT_PAGE_SIZE).map(e=>`<button class="event-card ${e.id===state.selected?'active':''}" data-event="${h(e.id)}"><div class="event-meta"><time>${yearTickLabel(e.year)}</time><span>${h(e.category)}</span>${e.userCreated?'<span class="user-badge">自定义</span>':''}</div><h3>${h(e.title)}</h3><div class="event-place"><span class="place-dot"></span>${h(placeOf(e)?.name)}${activeEra(e)?'<span>·</span>'+h(activeEra(e).replace('明 · ','')):''}</div></button>`).join('')+(pages>1?`<nav class="list-pagination" aria-label="事件列表分页"><button data-page="${state.page-1}" ${state.page===0?'disabled':''}>上一页</button><span>${state.page+1} / ${pages}</span><button data-page="${state.page+1}" ${state.page>=pages-1?'disabled':''}>下一页</button></nav>`:'');
}
function renderDetail(){
  const e=state.events.find(e=>e.id===state.selected);
  if(!e){$('detail').innerHTML='<div class="detail-empty"><span class="eyebrow">EVENT DETAILS</span><h2>事件详情</h2><p>选择事件查看详情。</p></div>';return;}
  const p=placeOf(e),samePlace=state.events.filter(x=>x.placeId===e.placeId&&x.id!==e.id).sort((a,b)=>Math.abs(a.year-e.year)-Math.abs(b.year-e.year)).slice(0,3).sort((a,b)=>a.year-b.year);
  const sourceUrl=safeSourceUrl(e.sourceUrl);const seq=state.events.filter(x=>!x.userCreated).sort((a,b)=>a.year-b.year).findIndex(x=>x.id===e.id)+1;
  $('detail').innerHTML=`<div class="detail-eyeline"><span class="detail-sequence">${e.userCreated?'自定义':String(seq).padStart(2,'0')+' / CHRONICLE'}</span><span class="category-tag">${h(e.category)}</span></div><div class="detail-year">${e.year<=0?'前 '+(1-e.year):e.year}</div><div class="detail-era">${h(activeEra(e))}${e.endYear!=null&&e.endYear!==e.year?' · 至 '+h(yearLabel(e.endYear)):''}</div><h2>${h(e.title)}</h2>${e.userCreated&&canEdit()?'<div class="event-actions"><button class="quiet-button" id="edit-event">编辑</button><button class="quiet-button delete-button" id="delete-event">删除</button></div>':''}<p class="detail-summary">${h(e.summary)}</p><div class="place-panel"><div class="place-panel-top"><div><h3>${h(p?.name)} <span class="optional">${h(p?.historicalName||'')}</span></h3><p class="coordinate">${Math.abs(p?.lat||0).toFixed(2)}° ${p?.lat>=0?'N':'S'} &nbsp; ${Math.abs(p?.lon||0).toFixed(2)}° ${p?.lon>=0?'E':'W'}</p></div><button id="fly-place">定位 ↗</button></div><p>${h(p?.description||'')}</p></div><div class="source-block"><span class="section-label">资料来源</span>${sourceUrl?`<a class="source-link" href="${h(sourceUrl)}" target="_blank" rel="noopener noreferrer">${h(e.sourceTitle||'原始资料')} ↗</a>`:`<span class="source-link">${h(e.sourceTitle||'未提供来源')}</span>`}<p class="precision-note">按年展示${e.userCreated?' · 用户记录，未经过史料核验':' · 内置史料，只读'}<br>${h(e.locationNote||(p?.isCustom?'用户标记位置。':'坐标为现代城市的示意定位，并非事件发生地的精确遗址坐标。'))}</p></div><div class="related-section"><span class="section-label">相关事件</span>${samePlace.length?samePlace.map(x=>`<button class="related-item" data-related="${h(x.id)}"><time>${yearTickLabel(x.year)}</time><span>${h(x.title)}</span></button>`).join(''):'<p class="precision-note">暂无相关记录。</p>'}</div>`;
}
function updateMarkers(){
  if(!mapView)return;
  const events=matchingEvents('year'),counts={};for(const e of events)counts[e.placeId]=(counts[e.placeId]||0)+1;
  mapView.setHistoryPlaces(state.places.filter(p=>counts[p.id]),{selectedPlaceId:events.find(e=>e.id===state.selected)?.placeId,counts,labels:state.labels});
}
function reconcileSelection(){const events=filtered();if(!events.some(e=>e.id===state.selected&&eventIsActive(e,state.year)))state.selected=events.find(e=>eventIsActive(e,state.year))?.id||null;}
function renderHistory(){reconcileSelection();syncControls();renderList();renderDetail();updateMarkers();}
function setYear(value,{select=true,refresh=false}={}){
  const numeric=Number(value),year=Math.max(state.min,Math.min(state.max,Number.isFinite(numeric)?Math.round(numeric):state.min));
  // An unchanged year must preserve the selected event and existing map markers.
  if(year===state.year&&!refresh){syncYearInputs();$('time-slider').value=year;return;}
  state.year=year;state.page=0;if(select)state.selected=filtered().find(e=>eventIsActive(e,state.year))?.id||null;renderHistory();
}
function selectEvent(id,{fly=false}={}){const event=state.events.find(e=>e.id===id);if(!event)return;stopPlayback();state.selected=id;state.year=event.year;const place=placeOf(event);if(state.countryCode!=='all'&&state.countryCode!==place?.countryCode){state.countryCode=place?.countryCode||'all';state.period='all';updateBounds();}if(state.region!=='all'&&state.region!==place?.regionCode)state.region='all';if(state.city!=='all'&&state.city!==cityIdOf(place))state.city='all';if(event.year<state.min||event.year>state.max){state.period='all';updateBounds();}if(state.category!=='all'&&state.category!==event.category&&!(state.category==='custom'&&event.userCreated))state.category='all';if(!eventMatches(event,state,placeIndex())){state.query='';$('search').value='';}state.page=Math.max(0,Math.floor(filtered().findIndex(e=>e.id===id)/EVENT_PAGE_SIZE));renderHistory();if(fly)flyPlace(place);}
function flyPlace(place){if(place)mapView?.flyPlace(place,{zoom:11});}
function focusCountry(){
  if(!mapView)return;
  if(state.countryCode==='all'){homeView();return;}
  const country=countryOptions(state.countryFeatures,state.places).find(c=>c.code===state.countryCode);
  if(Number.isFinite(country?.lon)&&Number.isFinite(country?.lat))mapView.flyPlace(country,{zoom:3.5});
  else {const place=countryPlaces().find(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat));if(place)mapView.flyPlace(place,{zoom:4});}
}
function focusRegion(){
  if(!mapView)return;
  if(state.region==='all'){focusCountry();return;}
  const places=regionalPlaces().filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat));
  if(!places.length)return;
  if(places.length===1){mapView.flyPlace(places[0],{zoom:6});return;}
  mapView.fitBounds([[Math.min(...places.map(p=>p.lon)),Math.min(...places.map(p=>p.lat))],[Math.max(...places.map(p=>p.lon)),Math.max(...places.map(p=>p.lat))]],{padding:60,maxZoom:7,pitch:0});
}
function homeView(){mapView?.home();}
function syncMapControls(){
  const flat=mapView?.isFlat()||false;
  $('home-view').title=flat?'返回地图全景':'返回地球全景';$('home-view').setAttribute('aria-label',$('home-view').title);
}
function applyMapTheme(){
  const css=getComputedStyle(document.documentElement),theme=document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]').content=css.getPropertyValue('--bg').trim();
  mapView?.setTheme(theme);
}
async function initGlobe(){
  const response=await fetch('/maps/liberty.json');
  if(!response.ok)throw new Error('基础地图样式未能加载');
  mapView=initMapView({maplibregl,container:'globe',baseStyle:await response.json(),preferences:preferences.snapshot(),
    onStatus:message=>{$('map-status').textContent=message;$('map-retry').hidden=!message;},onNotice:toast,
    onProjectionChange:syncMapControls,
    onPickPoint:point=>eventEditor?.pickPoint(point),
    onRenderError:()=>{$('globe-error').hidden=false;},
    onRenderRecovered:()=>{$('globe-error').hidden=true;},
    onHistoryPlace:placeId=>{
      stopPlayback();
      const place=placeIndex().get(placeId);state.countryCode=place?.countryCode||'all';updateBounds();
      state.city=cityIdOf(place)||'all';state.region=place?.regionCode||'all';state.scope='year';state.page=0;
      state.selected=matchingEvents('year').find(e=>e.placeId===placeId)?.id||null;renderHistory();
    },
  });
  syncMapControls();applyMapTheme();updateMarkers();
  window.addEventListener('pagehide',()=>mapView?.destroy(),{once:true});
}
function step(delta){setYear(state.year+delta);}
async function loadCountryCatalog(){try{const response=await fetch('/maps/country-labels.geojson');if(response.ok)state.countryFeatures=await response.json();}catch{/* Available historical places still populate the country selector. */}}
function applyLibrary(library,{startToday=false}={}){
  state.events=library.events;state.places=library.places;state.meta=library.meta;
  updateBounds();
  if(startToday){state.period='all';updateBounds();state.year=currentYear();state.selected=null;state.scope='year';}
  else state.year=Math.max(state.min,Math.min(state.max,state.year??state.max));
  if(state.region!=='all'&&!countryPlaces().some(p=>p.regionCode===state.region))state.region='all';
  if(state.city!=='all'&&!cityOptions(regionalPlaces()).some(p=>p.id===state.city))state.city='all';
  state.page=0;
  reconcileSelection();
  $('category').innerHTML='<option value="all">全部类型</option><option value="custom">自定义</option>'+CATEGORIES.map(c=>`<option>${h(c)}</option>`).join('');
}
async function refreshLibrary(options){applyLibrary(await api('/api/library'),options);}
function openDeleteDialog(){
  const event=state.events.find(item=>item.id===state.selected),dialog=$('delete-event-dialog');
  if(!canEdit()||!event?.userCreated||dialog.open||dialog.dataset.busy==='true')return;
  stopPlayback();dialog.dataset.eventId=event.id;
  $('delete-event-name').textContent=event.title;
  $('delete-event-error').textContent='';$('delete-event-error').hidden=true;
  dialog.showModal();$('cancel-delete-event').focus();
}
async function deleteEvent(event){
  event.preventDefault();
  const dialog=$('delete-event-dialog'),id=dialog.dataset.eventId;
  const record=state.events.find(item=>item.id===id);
  if(!dialog.open||dialog.dataset.busy==='true'||!canEdit()||!record?.userCreated)return;
  const controls=[...dialog.querySelectorAll('button')];
  dialog.dataset.busy='true';dialog.setAttribute('aria-busy','true');
  for(const button of controls)button.disabled=true;
  $('confirm-delete-event').textContent='删除中…';
  $('delete-event-error').textContent='';$('delete-event-error').hidden=true;
  try{
    await api('/api/events/'+encodeURIComponent(id),{method:'DELETE'});
    // The delete has completed. Update the known library immediately so a
    // separate refresh failure cannot leave a deleted record available to retry.
    const events=state.events.filter(item=>item.id!==id);
    const places=state.places.filter(place=>place.id!==record.placeId||!place.isCustom||events.some(item=>item.placeId===place.id));
    applyLibrary({events,places,meta:{...state.meta,userEventCount:events.filter(item=>item.userCreated).length}});
    renderHistory();dialog.close();toast('个人记录已删除');
    ($('event-list').querySelector('.event-card.active')||$('event-list').querySelector('.event-card')||$('add-button')).focus({preventScroll:true});
  }catch(error){
    $('delete-event-error').textContent=error.message;$('delete-event-error').hidden=false;
  }finally{
    dialog.dataset.busy='false';dialog.setAttribute('aria-busy','false');
    for(const button of controls)button.disabled=false;
    $('confirm-delete-event').textContent='删除';
  }
}
function showSources(){const sources=[...new Map(state.events.filter(e=>!e.userCreated&&safeSourceUrl(e.sourceUrl)).map(e=>[e.sourceUrl,{title:e.sourceTitle,url:e.sourceUrl}])).values()];$('sources-content').innerHTML=`<p>地球史书 v${h(state.session.version || '0.1.0')}</p><h3>历史资料</h3><p>本版收录 ${state.events.filter(e=>!e.userCreated).length} 条明初示例事件，提供摘要与出处。年份之外的月日未在时间轴中展开；无事件的年份表示尚未收录。</p><p>城市坐标用于阅读导航，不能当作古代遗址的精确定位。地图为现代道路与地形，不代表事件发生时的道路或疆域。</p><div class="source-list">${sources.map(s=>`<a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)} ↗</a>`).join('')}</div><h3>显示与数据</h3><p>地图使用 MapLibre、OpenFreeMap / OpenStreetMap 道路数据和 Mapzen 高程数据；附带 Natural Earth 全球基础地图。详细道路及地形按视野联网加载。中文译名和当地名称以数据源提供的内容为准。</p>`;$('sources-dialog').showModal();}
function bind(){
  const changed=()=>{stopPlayback();state.page=0;renderHistory();};
  $('scope').onchange=e=>{state.scope=e.target.value;changed();};$('category').onchange=e=>{state.category=e.target.value;changed();};
  let searchTimer;$('search').oninput=e=>{state.query=e.target.value;if(state.query)state.scope='all';clearTimeout(searchTimer);searchTimer=setTimeout(changed,150);};
  $('country-filter').onchange=e=>{state.countryCode=e.target.value;state.region='all';state.city='all';state.period='all';state.selected=null;updateBounds();state.year=Math.max(state.min,Math.min(state.max,state.year));changed();focusCountry();};
  $('region-filter').onchange=e=>{state.region=e.target.value;state.city='all';state.scope='all';state.selected=null;changed();focusRegion();};
  $('city-filter').onchange=e=>{state.city=e.target.value;state.scope='all';state.selected=null;changed();if(state.city!=='all')flyPlace(cityOptions(state.places).find(p=>p.id===state.city));};
  $('year-filter').onchange=e=>{if(e.target.value==='')return;stopPlayback();state.scope='year';setYear(Number(e.target.value),{refresh:true});};
  $('period-filter').onchange=e=>{stopPlayback();state.period=e.target.value;updateBounds();state.scope='all';setYear(Math.max(state.min,Math.min(state.max,state.year)),{refresh:true});};
  $('event-list').onclick=e=>{const event=e.target.closest('[data-event]');if(event)selectEvent(event.dataset.event,{fly:true});const page=e.target.closest('[data-page]');if(page&&!page.disabled){state.page=Number(page.dataset.page);renderList();$('event-list').scrollTop=0;}if(e.target.id==='browse-region'){state.scope='all';changed();}if(e.target.id==='clear-filters'){state.category='all';state.query='';$('search').value='';changed();}};
  $('detail').onclick=e=>{const related=e.target.closest('[data-related]');if(related)selectEvent(related.dataset.related,{fly:true});if(e.target.id==='fly-place')flyPlace(placeOf(state.events.find(x=>x.id===state.selected)));if(e.target.id==='edit-event')openEventForm(state.events.find(x=>x.id===state.selected));if(e.target.id==='delete-event')openDeleteDialog();};
  $('delete-event-form').onsubmit=deleteEvent;
  $('delete-event-dialog').addEventListener('cancel',e=>{if(e.currentTarget.dataset.busy==='true')e.preventDefault();});
  $('delete-event-dialog').addEventListener('close',()=>{delete $('delete-event-dialog').dataset.eventId;});
  const enteredYear=()=>{const n=Number($('year-input').value);if(!Number.isInteger(n)||n<1||n>9999){syncYearInputs();return;}stopPlayback();const year=$('year-era').value==='bce'?1-n:n;if(year<state.min||year>state.max){state.period='all';updateBounds();}setYear(year);};
  $('year-input').onchange=enteredYear;$('year-input').onkeydown=e=>{if(e.key==='Enter')enteredYear();};$('year-era').onchange=enteredYear;$('time-slider').oninput=e=>{stopPlayback();setYear(e.target.value);};$('event-dots').onclick=e=>{const b=e.target.closest('[data-year]');if(b){stopPlayback();setYear(b.dataset.year);}};
  $('previous-year').onclick=()=>{stopPlayback();step(-1);};$('next-year').onclick=()=>{stopPlayback();step(1);};$('jump-start').onclick=()=>{stopPlayback();setYear(state.min);};$('jump-end').onclick=()=>{stopPlayback();setYear(state.max);};
  $('previous-node').onclick=()=>{const target=yearGroups().find(g=>g.year<state.year);if(target){stopPlayback();setYear(target.year);}};
  $('next-node').onclick=()=>{const target=yearGroups().filter(g=>g.year>state.year).at(-1);if(target){stopPlayback();setYear(target.year);}};
  $('play').onclick=()=>{if(playTimer){stopPlayback();return;}if(state.year===state.min)setYear(state.max);$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暂停时间轴');playTimer=setInterval(()=>{if(state.year<=state.min){stopPlayback();return;}step(-1);},1200);};
  $('home-view').onclick=homeView;$('zoom-in').onclick=()=>mapView?.zoomIn();$('zoom-out').onclick=()=>mapView?.zoomOut();$('map-retry').onclick=()=>mapView?.retry();$('labels-toggle').onclick=()=>{state.labels=!state.labels;$('labels-toggle').classList.toggle('active',state.labels);$('labels-toggle').setAttribute('aria-pressed',state.labels);mapView?.setLabels(state.labels);updateMarkers();};$('retry-globe').onclick=()=>location.reload();
  $('add-button').onclick=()=>openEventForm();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{const dialog=$(b.dataset.close);if(dialog.dataset.busy!=='true')dialog.close();});document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d&&d.dataset.busy!=='true'){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('sources-button').onclick=showSources;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
}
function openEventForm(event=null){
  if(!canEdit())return;
  if(event)eventEditor?.edit(event);else eventEditor?.start();
}
function schedulePreferences(value){
  pendingPreferences=value;clearTimeout(preferencesTimer);
  preferencesTimer=setTimeout(()=>flushPreferences().catch(error=>{$('preferences-status').textContent='设置未能保存：'+error.message;}),180);
}
async function flushPreferences(){
  clearTimeout(preferencesTimer);
  if(preferencesSaving){await preferencesSaving;if(!pendingPreferences)return;}
  preferencesSaving=(async()=>{while(pendingPreferences){const value=pendingPreferences;pendingPreferences=null;try{await api('/api/preferences',{method:'PUT',body:JSON.stringify({preferences:value})});$('preferences-status').textContent='';}catch(error){pendingPreferences=pendingPreferences||value;throw error;}}})();
  try{await preferencesSaving;}finally{preferencesSaving=null;}
}
async function init(){
  bind();
  try{
    countryPicker=initCountryPicker($('country-filter'),{onOpen:stopPlayback});
    const results=await Promise.allSettled([api('/api/session'),refreshLibrary({startToday:true}),loadCountryCatalog()]);
    if(results[0].status==='rejected')throw results[0].reason;state.session=results[0].value;
    if(results[1].status==='rejected')throw results[1].reason;
    const local=state.session.interface==='local'&&state.session.canEdit===true;document.body.dataset.interface=local?'local':'web';
    document.title=local?'地球史书 · 本地窗口':'地球史书 · 网页阅读';
    let initialPreferences=null;
    if(local){const saved=await api('/api/preferences');initialPreferences=saved.preferences;if(!Object.keys(initialPreferences).length){initialPreferences=readLegacyPreferences();await api('/api/preferences',{method:'PUT',body:JSON.stringify({preferences:initialPreferences})});}}
    preferences=initPreferences({initialPreferences,persistLocally:!local,onPreferencesChange:value=>{if(local)schedulePreferences(value);},onThemeChange:applyMapTheme,onMapChange:value=>mapView?.applyPreferences(value),onLayoutChange:()=>mapView?.resize()});
    settings=initSettings({session:state.session,api,preferences,flushPreferences,onDatabaseImport:async()=>{await refreshLibrary();renderHistory();},toast});
    eventEditor=initEventEditor({context:()=>state,map:()=>mapView,api,toast,onStart:stopPlayback,onSaved:async event=>{
      await refreshLibrary();state.scope='year';state.city='all';state.region='all';state.category='custom';state.query='';$('search').value='';selectEvent(event.id,{fly:true});
    }});
    $('add-button').disabled=!canEdit();
    renderHistory();document.body.dataset.ready='true';try{await initGlobe();}catch(error){console.error(error);$('globe-error').hidden=false;}
  }catch(error){$('event-list').innerHTML='<div class="empty-state"><strong>数据加载失败</strong>'+h(error.message)+'<button onclick="location.reload()">重试</button></div>';toast('请确认本地程序或内容服务器正在运行');}
}
init();
