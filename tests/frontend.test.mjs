import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {CATEGORIES,eraForYear,yearLabel,eventMatches,eventIsActive,escapeHtml,safeSourceUrl} from '../public/domain.js';
import {HISTORY_PERIODS,periodsForCountry,periodBounds,periodsForYear,yearTickLabel} from '../public/history-navigation.js';
import {EVENT_PAGE_SIZE,eventYearGroups,timelineStops} from '../public/history-index.js';
import {countryOptions,countryName,placesInCountry} from '../public/geography.js';

const THIS_YEAR=new Date().getFullYear();

// Exercise the shipped UI state functions without starting a server or a real
// browser. Deferred promises cover asynchronous database import and UI locking.
class Element {
  constructor() {
    this.style={setProperty:(key,value)=>{this.style[key]=value;}};
    this.attributes={};this.dataset={};this.listeners=new Map();
    this.classList={toggle(){},add(){},remove(){}};
    this.hidden=false;this.disabled=false;this.clientWidth=980;this.offsetWidth=6;
    this.value='';this.textContent='';this.innerHTML='';this.open=false;
  }
  setAttribute(key,value){this.attributes[key]=String(value);}
  getAttribute(key){return this.attributes[key];}
  addEventListener(name,callback){this.listeners.set(name,callback);}
  removeEventListener(name){this.listeners.delete(name);}
  querySelector(){return new Element();}
  querySelectorAll(){return [];}
  replaceChildren(){}
  append(){}
  focus(){this.focused=true;}
  close(){if(!this.open)return;this.open=false;this.listeners.get('close')?.({target:this});}
  showModal(){this.open=true;}
}
function environment() {
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const document={getElementById:get,querySelector:get,querySelectorAll:()=>[],documentElement:new Element(),body:new Element(),addEventListener(){},createElement:()=>new Element()};
  const window={innerWidth:980,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:true})};
  let frame=0;
  const context=vm.createContext({document,window,console,URL,Math,Number,Map,Set,Promise,JSON,
    setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
    requestAnimationFrame:()=>++frame,cancelAnimationFrame(){},matchMedia:window.matchMedia,
    localStorage:{getItem:()=>null,setItem(){}},fetch:()=>{throw new Error('Unexpected fetch');},
    CATEGORIES,eraForYear,yearLabel,eventMatches,eventIsActive,h:escapeHtml,safeSourceUrl,
    HISTORY_PERIODS,periodsForCountry,periodBounds,periodsForYear,yearTickLabel,EVENT_PAGE_SIZE,eventYearGroups,timelineStops,
    countryOptions,countryName,placesInCountry});
  return {context,get,elements};
}
const appSource=(await readFile(new URL('../public/app.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace(/\binit\(\);\s*$/,'');
const preferencesSource=(await readFile(new URL('../public/preferences.js',import.meta.url),'utf8')).replace(/^export /gm,'');
const settingsSource=(await readFile(new URL('../public/settings.js',import.meta.url),'utf8')).replace(/^export /gm,'');
function app() {
  const env=environment();
  vm.runInContext(appSource+'\n globalThis.ui={state,refreshLibrary,selectEvent,renderHistory,syncControls,filtered,setYear,bind,updateMarkers,openEventForm,injectMapView(value){mapView=value;}};',env.context);
  return {...env,ui:env.context.ui};
}
const event=(id,year,title='事件')=>({id,year,title,summary:'',category:'文化',placeId:'nanjing',sourceTitle:'来源'});
const places=[
  {id:'nanjing',name:'南京',historicalName:'应天',countryCode:'CN',regionCode:'CN-JS',regionName:'江苏',lon:118,lat:32},
  {id:'suzhou',name:'苏州',countryCode:'CN',regionCode:'CN-JS',regionName:'江苏',lon:120,lat:31},
  {id:'beijing',name:'北京',countryCode:'CN',regionCode:'CN-BJ',regionName:'北京',lon:116,lat:39},
  {id:'hangzhou',name:'杭州',countryCode:'CN',regionCode:'CN-ZJ',regionName:'浙江',lon:120,lat:30},
  {id:'paris',name:'巴黎',countryCode:'FR',regionCode:'FR-IDF',regionName:'法兰西岛',lon:2,lat:48},
];
const countryFeatures={type:'FeatureCollection',features:[
  {type:'Feature',properties:{country_code:'CN','name:zh':'中国'},geometry:{type:'Point',coordinates:[103,35]}},
  {type:'Feature',properties:{country_code:'FR','name:zh':'法国'},geometry:{type:'Point',coordinates:[2.2,46.5]}},
  {type:'Feature',properties:{country_code:'JP','name:zh':'日本'},geometry:{type:'Point',coordinates:[138,37]}},
]};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

function deletionApp() {
  const env=app(),{get,context}=env,dialog=get('delete-event-dialog');
  const cancel=get('cancel-delete-event'),confirm=get('confirm-delete-event'),close=get('close-delete-event');
  for(const button of [cancel,close])button.dataset.close='delete-event-dialog';
  dialog.querySelectorAll=()=>[cancel,confirm,close];
  dialog.getBoundingClientRect=()=>({left:100,right:500,top:100,bottom:350});
  context.document.querySelectorAll=selector=>selector==='dialog'?[dialog]:selector==='[data-close]'?[cancel,close]:[];
  context.confirm=()=>{throw new Error('A native browser confirmation must not be shown');};
  env.ui.bind();
  return {...env,dialog,cancel,confirm,close,
    open:()=>get('detail').onclick({target:{id:'delete-event',closest:()=>null}}),
    submit:()=>get('delete-event-form').onsubmit({preventDefault(){}}),
    escape:()=>{let prevented=false;dialog.listeners.get('cancel')?.({currentTarget:dialog,preventDefault(){prevented=true;}});if(!prevented)dialog.close();return prevented;},
    backdrop:()=>dialog.listeners.get('click')?.({target:dialog,clientX:50,clientY:50}),
  };
}

test('map rendering recovery dismisses its error overlay without reloading the historical view',async()=>{
  const {context,get,ui}=app();let callbacks;
  context.maplibregl={};
  context.getComputedStyle=()=>({getPropertyValue:()=>''});
  context.fetch=async()=>({ok:true,json:async()=>({})});
  context.initMapView=options=>{callbacks=options;return {isFlat:()=>false,setTheme(){},setHistoryPlaces(){}};};
  vm.runInContext('preferences={snapshot:()=>({})};',context);
  Object.assign(ui.state,{events:[event('selected',1405)],places,selected:'selected',year:1405});
  get('globe-error').hidden=true;
  await vm.runInContext('initGlobe()',context);
  callbacks.onRenderError();assert.equal(get('globe-error').hidden,false);
  callbacks.onRenderRecovered();assert.equal(get('globe-error').hidden,true);
  assert.equal(ui.state.selected,'selected');assert.equal(ui.state.year,1405);
});

test('delete confirmation names the record, focuses cancel and closes without sending a request',async()=>{
  const env=deletionApp(),{ui,context,get,dialog}=env;let requests=0;
  context.fetch=async()=>{requests++;throw new Error('Cancellation must not delete');};
  Object.assign(ui.state,{events:[{...event('personal',1405,'<b>个人资料</b>'),userCreated:true}],places,
    selected:'personal',year:1405,session:{interface:'local',canEdit:true}});
  get('play').onclick();assert.equal(get('play').textContent,'Ⅱ');
  env.open();
  assert.equal(dialog.open,true);assert.equal(dialog.dataset.eventId,'personal');
  assert.equal(get('delete-event-name').textContent,'<b>个人资料</b>');
  assert.equal(get('delete-event-name').innerHTML,'');assert.equal(env.cancel.focused,true);
  assert.equal(get('play').textContent,'▶');assert.equal(requests,0);
  for(const cancel of [()=>env.cancel.onclick(),()=>env.close.onclick(),env.escape,env.backdrop]){
    env.open();cancel();assert.equal(dialog.open,false);assert.equal(dialog.dataset.eventId,undefined);
    await env.submit();assert.equal(requests,0);
  }
  assert.equal(ui.state.events.length,1);
});

test('delete confirmation keeps its original target and blocks repeated submission and dismissal while pending',async()=>{
  const env=deletionApp(),{ui,context,get,dialog}=env,gate=deferred(),requests=[];
  const personal=id=>({...event(id,1405),userCreated:true});
  Object.assign(ui.state,{events:[personal('first/record'),personal('second')],places,
    selected:'first/record',year:1405,scope:'all',session:{interface:'local',canEdit:true,token:'editor'}});
  context.fetch=async(url,options)=>{requests.push({url,options});await gate.promise;return {ok:true,json:async()=>({deleted:true})};};
  env.open();ui.state.selected='second';env.open();
  const deleting=env.submit();await env.submit();
  assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/events/first%2Frecord');
  assert.equal(requests[0].options.method,'DELETE');assert.equal(requests[0].options.headers['X-Edit-Token'],'editor');
  assert.equal(dialog.dataset.busy,'true');assert.equal(dialog.getAttribute('aria-busy'),'true');
  assert.ok([env.cancel,env.confirm,env.close].every(button=>button.disabled));
  env.cancel.onclick();env.close.onclick();env.backdrop();assert.equal(env.escape(),true);
  assert.equal(dialog.open,true);assert.equal(ui.state.events.length,2);
  gate.resolve();await deleting;
  assert.deepEqual(ui.state.events.map(record=>record.id),['second']);assert.equal(ui.state.selected,'second');
  assert.equal(ui.state.places.length,places.length);assert.equal(dialog.open,false);
  assert.equal(dialog.dataset.eventId,undefined);assert.equal(dialog.dataset.busy,'false');
  assert.ok([env.cancel,env.confirm,env.close].every(button=>!button.disabled));
  assert.equal(get('confirm-delete-event').textContent,'删除');
  assert.equal(requests.length,1,'successful deletion must not depend on a second library request');
});

test('a rejected delete keeps the record and inline error available for retry',async()=>{
  const env=deletionApp(),{ui,context,get,dialog}=env;let requests=0;
  Object.assign(ui.state,{events:[{...event('personal',1405),userCreated:true}],places,
    selected:'personal',year:1405,session:{interface:'local',canEdit:true}});
  context.fetch=async()=>{requests++;return {ok:requests>1,json:async()=>requests===1?{error:'数据库暂时忙，请重试。'}:{deleted:true}};};
  env.open();await env.submit();
  assert.equal(dialog.open,true);assert.equal(dialog.dataset.eventId,'personal');
  assert.equal(ui.state.events.length,1);assert.equal(ui.state.selected,'personal');
  assert.equal(get('delete-event-error').hidden,false);assert.match(get('delete-event-error').textContent,/数据库暂时忙/);
  assert.equal(dialog.dataset.busy,'false');assert.ok([env.cancel,env.confirm,env.close].every(button=>!button.disabled));
  await env.submit();assert.equal(requests,2);assert.equal(dialog.open,false);
  assert.equal(ui.state.events.length,0);assert.equal(get('delete-event-error').hidden,true);
});

test('delete guards reject builtin records and all non-local-editor sessions even if invoked directly',async()=>{
  const cases=[
    {session:{interface:'local',canEdit:true},userCreated:false},
    {session:{interface:'web',canEdit:false},userCreated:true},
    {session:{interface:'web',canEdit:true},userCreated:true},
    {session:{interface:'local',canEdit:false},userCreated:true},
  ];
  for(const {session,userCreated} of cases){
    const env=deletionApp(),{ui,context,dialog}=env;let requests=0;
    Object.assign(ui.state,{events:[{...event('record',1405),userCreated}],places,selected:'record',session});
    context.fetch=async()=>{requests++;throw new Error('Unauthorized deletion');};
    env.open();assert.equal(dialog.open,false);
    dialog.open=true;dialog.dataset.eventId='record';await env.submit();
    assert.equal(requests,0);assert.equal(ui.state.events.length,1);
  }
});

test('deleting the final custom city clears its point, filters, year bounds and stale map selection',async()=>{
  const env=deletionApp(),{ui,context,get}=env,markers=[];
  const site={id:'user-site',name:'测试遗址',isCustom:true,cityId:'custom-city',cityName:'测试城',countryCode:'CN',regionCode:'CN-custom',regionName:'测试地区',lon:109,lat:35};
  Object.assign(ui.state,{events:[event('builtin',1405),{...event('personal',9999),placeId:site.id,userCreated:true}],
    places:[...places,site],year:9999,max:9999,selected:'personal',scope:'year',category:'custom',
    region:'CN-custom',city:'custom-city',meta:{userEventCount:1},session:{interface:'local',canEdit:true}});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:(visible,options)=>markers.push({visible,options})});
  context.fetch=async()=>({ok:true,json:async()=>({deleted:true})});
  ui.renderHistory();assert.deepEqual(markers.at(-1).visible.map(place=>place.id),[site.id]);
  env.open();await env.submit();
  assert.equal(ui.state.places.some(place=>place.id===site.id),false);assert.equal(ui.state.region,'all');assert.equal(ui.state.city,'all');
  assert.equal(ui.state.category,'custom');assert.equal(ui.state.year,THIS_YEAR);assert.equal(ui.state.max,THIS_YEAR);
  assert.equal(ui.state.selected,null);assert.equal(ui.state.meta.userEventCount,0);
  assert.equal(markers.at(-1).visible.length,0);assert.equal(markers.at(-1).options.selectedPlaceId,undefined);
  assert.doesNotMatch(get('city-filter').innerHTML,/custom-city/);assert.match(get('detail').innerHTML,/选择事件查看详情。/);
});

test('library refresh clamps a deleted outer year and keeps a still-visible selection after import',async()=>{
  const {ui,context,get}=app();
  Object.assign(ui.state,{year:9999,selected:'deleted',scope:'all'});
  const library={events:[event('early',1368),event('current',1405)],places,meta:{}};
  context.fetch=async()=>({ok:true,json:async()=>library});
  await ui.refreshLibrary();ui.renderHistory();
  assert.equal(ui.state.year,THIS_YEAR);assert.equal(get('year-input').value,THIS_YEAR);
  assert.equal(ui.state.selected,null);assert.equal(get('next-year').disabled,true);
  assert.equal(get('jump-end').disabled,true);
  Object.assign(ui.state,{year:1405,selected:'current'});
  library.events.push(event('imported',1390));
  await ui.refreshLibrary();ui.renderHistory();
  assert.equal(ui.state.selected,'current');
  ui.state.year=-9999;await ui.refreshLibrary();assert.equal(ui.state.year,-769);
});

test('related-event navigation clears incompatible search and empty city results clear stale details',()=>{
  const {ui,get}=app();
  Object.assign(ui.state,{events:[event('a',1405,'原事件'),event('b',1406,'关联事件')],places,scope:'all',query:'原事件',selected:'a'});
  ui.selectEvent('b');
  assert.equal(ui.state.query,'');assert.equal(get('search').value,'');
  assert.equal(ui.state.selected,'b');assert.ok(ui.filtered().some(e=>e.id==='b'));
  ui.state.city='beijing';ui.renderHistory();
  assert.equal(ui.state.selected,null);assert.match(get('detail').innerHTML,/选择事件查看详情。/);
});

test('startup opens the current year and selects only an event active that year',async()=>{
  const {ui,context,get}=app();
  const library={events:[event('old',1368),{...event('future',THIS_YEAR+2),endYear:THIS_YEAR+4},event('current',THIS_YEAR)],places,meta:{}};
  context.fetch=async()=>({ok:true,json:async()=>library});
  await ui.refreshLibrary({startToday:true});ui.renderHistory();
  assert.equal(ui.state.year,THIS_YEAR);assert.equal(ui.state.selected,'current');
  assert.equal(ui.state.countryCode,'CN');assert.equal(ui.state.scope,'year');
  assert.equal(ui.state.max,THIS_YEAR+4);assert.equal(get('time-slider').value,THIS_YEAR);
  assert.match(get('event-dots').innerHTML,new RegExp(`class="time-dot active"[^>]+data-year="${THIS_YEAR}"`));
  assert.match(get('detail').innerHTML,new RegExp(String(THIS_YEAR)));
});

test('selecting an event pauses playback so the next tick cannot replace its details',()=>{
  const {ui,context,get}=app(),cancelled=[];
  context.setInterval=()=>17;context.clearInterval=id=>cancelled.push(id);
  Object.assign(ui.state,{events:[event('a',1405),event('b',1406)],places,scope:'all',year:1406});
  ui.bind();get('play').onclick();
  assert.equal(get('play').textContent,'Ⅱ');
  ui.selectEvent('a');
  assert.ok(cancelled.includes(17));assert.equal(get('play').textContent,'▶');
  assert.equal(get('play').getAttribute('aria-label'),'播放时间轴');
  assert.equal(ui.state.selected,'a');assert.equal(ui.state.year,1405);
});

test('clamped and invalid year input restores both era and number without changing boundary markers',()=>{
  const {ui,get}=app(),markers=[];
  Object.assign(ui.state,{events:[{...event('boundary',1),placeId:'paris'}],places,
    countryCode:'FR',scope:'year',year:1,min:1,max:THIS_YEAR,selected:'boundary'});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:visible=>markers.push(visible)});
  ui.bind();ui.renderHistory();
  const markerUpdates=markers.length;
  get('year-era').value='bce';get('year-era').onchange();
  assert.equal(ui.state.year,1);assert.equal(ui.state.selected,'boundary');
  assert.equal(get('year-era').value,'ce');assert.equal(get('year-input').value,1);
  assert.equal(markers.length,markerUpdates);
  Object.assign(ui.state,{countryCode:'CN',year:-769,min:-769});ui.renderHistory();
  get('year-era').value='ce';get('year-input').value='';get('year-era').onchange();
  assert.equal(ui.state.year,-769);assert.equal(get('year-era').value,'bce');
  assert.equal(get('year-input').value,770);
});

test('a year without records and an empty library show no stale event or map marker',async()=>{
  const {ui,context,get}=app(),markers=[];
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:(visible,options)=>markers.push({visible,options})});
  const library={events:[event('first',1368),event('last',1421),event('middle',1405)],places,meta:{}};
  context.fetch=async()=>({ok:true,json:async()=>library});
  await ui.refreshLibrary({startToday:true});ui.renderHistory();
  assert.equal(ui.state.year,THIS_YEAR);assert.equal(ui.state.selected,null);
  assert.equal(ui.filtered().length,0);assert.match(get('event-list').innerHTML,/暂无匹配记录/);
  assert.match(get('detail').innerHTML,/选择事件查看详情。/);assert.equal(markers.at(-1).visible.length,0);
  ui.selectEvent('last');assert.equal(ui.state.selected,'last');
  library.events=[];await ui.refreshLibrary({startToday:true});ui.renderHistory();
  assert.equal(ui.state.year,THIS_YEAR);assert.equal(ui.state.selected,null);
  assert.equal(get('event-dots').innerHTML,'');assert.equal(markers.at(-1).visible.length,0);
});

test('all-years empty-state action preserves geography, period, category and query',()=>{
  const {ui,get}=app();
  Object.assign(ui.state,{events:[event('ming',1405,'编纂记录'),event('qing',1700,'编纂记录')],
    places,countryFeatures,scope:'year',year:1407,countryCode:'CN',region:'CN-JS',city:'nanjing',
    period:'ming',min:1368,max:1644,category:'文化',query:'编纂'});
  ui.bind();ui.renderHistory();
  assert.equal(ui.filtered().length,0);assert.match(get('event-list').innerHTML,/id="browse-region">全部年份/);
  const preservedKeys=['year','countryCode','region','city','period','min','max','category','query'];
  const snapshot=()=>Object.fromEntries(preservedKeys.map(key=>[key,ui.state[key]]));
  const before=snapshot();
  get('event-list').onclick({target:{id:'browse-region',closest:()=>null}});
  assert.equal(ui.state.scope,'all');assert.deepEqual(snapshot(),before);
  assert.deepEqual(ui.filtered().map(e=>e.id),['ming']);
  ui.state.query='无匹配词';ui.renderHistory();
  assert.match(get('event-list').innerHTML,/暂无匹配记录/);
  assert.doesNotMatch(get('event-list').innerHTML,/id="browse-region"/);
});

test('region, city, period and year controls narrow the same event list',()=>{
  const {ui,get}=app();
  Object.assign(ui.state,{events:[event('nj-ming',1405),{...event('sz-ming',1406),placeId:'suzhou'},
    {...event('sz-qing',1700),placeId:'suzhou'},{...event('bj-ming',1405),placeId:'beijing'},
    {...event('fr-ming',1405),placeId:'paris'}],places,scope:'all',year:1405,city:'beijing',selected:'bj-ming'});
  ui.bind();
  get('region-filter').onchange({target:{value:'CN-JS'}});
  assert.equal(ui.state.city,'all');assert.equal(ui.state.scope,'all');
  assert.deepEqual(ui.filtered().map(e=>e.id),['sz-qing','sz-ming','nj-ming']);
  assert.match(get('city-filter').innerHTML,/南京/);assert.match(get('city-filter').innerHTML,/苏州/);
  assert.doesNotMatch(get('city-filter').innerHTML,/北京|巴黎/);
  get('city-filter').onchange({target:{value:'suzhou'}});
  assert.deepEqual(ui.filtered().map(e=>e.id),['sz-qing','sz-ming']);
  get('period-filter').onchange({target:{value:'ming'}});
  assert.equal(ui.state.min,1368);assert.equal(ui.state.max,1644);
  assert.deepEqual(ui.filtered().map(e=>e.id),['sz-ming']);
  assert.match(get('year-filter').innerHTML,/1406 年 · 1 条/);
  assert.doesNotMatch(get('year-filter').innerHTML,/1700/);
  get('year-filter').onchange({target:{value:'1406'}});
  assert.equal(ui.state.scope,'year');assert.equal(ui.state.year,1406);assert.equal(ui.state.selected,'sz-ming');
  assert.match(get('detail').innerHTML,/苏州/);
  const filterKeys=['countryCode','region','city','period','scope','category','query'];
  const selectedFilters=()=>Object.fromEntries(filterKeys.map(key=>[key,ui.state[key]]));
  const beforeJump=selectedFilters();
  get('jump-start').onclick();
  assert.equal(ui.state.year,1368);assert.deepEqual(selectedFilters(),beforeJump);
  assert.equal(get('jump-start').disabled,true);assert.equal(get('previous-year').disabled,true);
  assert.equal(get('jump-end').disabled,false);assert.equal(get('next-year').disabled,false);
  get('jump-end').onclick();
  assert.equal(ui.state.year,1644);assert.deepEqual(selectedFilters(),beforeJump);
  assert.equal(get('jump-start').disabled,false);assert.equal(get('previous-year').disabled,false);
  assert.equal(get('jump-end').disabled,true);assert.equal(get('next-year').disabled,true);
  assert.equal(ui.state.selected,null);assert.equal(ui.filtered().length,0);
});

test('country selection resets location and period filters while preserving time and text filters',()=>{
  const {ui,get}=app(),markers=[],flights=[];
  Object.assign(ui.state,{events:[event('cn',1405,'共同事件'),
    {...event('fr-current',1405,'共同事件'),placeId:'paris'},
    {...event('fr-past',1404,'共同事件'),placeId:'paris'},
    {...event('fr-excluded',1405,'共同事件'),placeId:'paris',category:'政治'}],
    places,countryFeatures,scope:'all',year:1405,region:'CN-JS',city:'nanjing',period:'ming',
    min:1368,max:1644,category:'文化',query:'共同',selected:'cn'});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:(visible,options)=>markers.push({visible,options}),flyPlace:(place,options)=>flights.push({place,options})});
  ui.bind();get('country-filter').onchange({target:{value:'FR'}});
  assert.equal(ui.state.countryCode,'FR');assert.equal(get('country-filter').value,'FR');
  assert.equal(ui.state.region,'all');assert.equal(ui.state.city,'all');assert.equal(ui.state.period,'all');
  assert.equal(ui.state.year,1405);assert.equal(ui.state.scope,'all');
  assert.equal(ui.state.query,'共同');assert.equal(ui.state.category,'文化');
  assert.deepEqual(ui.filtered().map(e=>e.id),['fr-current','fr-past']);
  assert.match(get('country-filter').innerHTML,/>中国<.*>法国<|>法国<.*>中国</);
  assert.match(get('country-filter').innerHTML,/>日本</);
  assert.match(get('region-filter').innerHTML,/FR-IDF/);assert.doesNotMatch(get('region-filter').innerHTML,/CN-JS|CN-BJ/);
  assert.match(get('city-filter').innerHTML,/巴黎/);assert.doesNotMatch(get('city-filter').innerHTML,/南京|北京|苏州/);
  assert.equal(get('period-filter').innerHTML,'<option value="all">全部</option>');
  assert.equal(get('period-filter').disabled,true);assert.equal(get('era-label').textContent,'');
  assert.doesNotMatch(get('event-list').innerHTML,/永乐|洪武|>明</);
  assert.doesNotMatch(get('detail').innerHTML,/永乐|洪武|明 ·/);
  assert.deepEqual(markers.at(-1).visible.map(p=>p.id),['paris']);
  assert.deepEqual({...markers.at(-1).options.counts},{paris:1});
  assert.equal(flights.at(-1).place.code,'FR');assert.equal(flights.at(-1).place.lon,2.2);
  assert.equal(flights.at(-1).place.lat,46.5);assert.equal(flights.at(-1).options.zoom,3.5);
  assert.equal(flights.at(-1).options.milliseconds,undefined,'country navigation uses the shared location transition pace');
});

test('region selection delegates animated point and bounds navigation even under reduced motion',()=>{
  const {ui,get}=app(),flights=[],bounds=[];
  Object.assign(ui.state,{places,countryFeatures,events:[event('cn',1405)],year:1405});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces(){},
    flyPlace:(place,options)=>flights.push({place,options}),
    fitBounds:(extent,options)=>bounds.push({extent,options})});
  ui.bind();
  get('region-filter').onchange({target:{value:'CN-BJ'}});
  assert.equal(flights.at(-1).place.id,'beijing');
  assert.equal(flights.at(-1).options.zoom,6);
  assert.equal(flights.at(-1).options.milliseconds,undefined,'single-point regions use the shared location transition pace');
  get('region-filter').onchange({target:{value:'CN-JS'}});
  assert.equal(bounds.length,1);
  assert.deepEqual(Array.from(bounds[0].extent,point=>Array.from(point)),[[118,31],[120,32]]);
  assert.equal(bounds[0].options.maxZoom,7);
  assert.equal(bounds[0].options.duration,undefined,'multiple-point regions use the same transition pace as single-point regions');
  get('region-filter').onchange({target:{value:'all'}});
  assert.equal(flights.at(-1).place.code,'CN');
  assert.equal(flights.at(-1).options.milliseconds,undefined);
});

test('all countries combines records but keeps current-year map markers and country-specific eras',()=>{
  const {ui,get}=app(),markers=[];let homeCalls=0;
  Object.assign(ui.state,{events:[event('cn-current',1405),{...event('cn-past',1404),placeId:'beijing'},
    {...event('fr-current',1405),placeId:'paris'},
    {...event('fr-future',1406),placeId:'paris',era:'瓦卢瓦王朝'}],
    places,countryFeatures,scope:'all',year:1405});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:(visible,options)=>markers.push({visible,options}),home(){homeCalls++;}});
  ui.bind();get('country-filter').onchange({target:{value:'all'}});
  assert.equal(ui.filtered().length,4);assert.equal(ui.state.countryCode,'all');assert.equal(homeCalls,1);
  assert.match(get('region-filter').innerHTML,/中国 · 江苏/);assert.match(get('region-filter').innerHTML,/法国 · 法兰西岛/);
  assert.match(get('city-filter').innerHTML,/南京 · 中国/);assert.match(get('city-filter').innerHTML,/巴黎 · 法国/);
  assert.equal(get('period-filter').innerHTML,'<option value="all">全部</option>');
  assert.equal(get('era-label').textContent,'');
  const card=id=>get('event-list').innerHTML.match(new RegExp(`data-event="${id}"[\\s\\S]*?</button>`))?.[0];
  assert.match(card('cn-current'),/永乐三年/);assert.doesNotMatch(card('fr-current'),/永乐|洪武|明 ·/);
  assert.match(card('fr-future'),/瓦卢瓦王朝/);
  assert.deepEqual(markers.at(-1).visible.map(p=>p.id),['nanjing','paris']);
  assert.deepEqual({...markers.at(-1).options.counts},{nanjing:1,paris:1});
  ui.state.query='永乐';ui.renderHistory();
  assert.deepEqual(ui.filtered().map(e=>e.id),['cn-current','cn-past']);
  assert.deepEqual(markers.at(-1).visible.map(p=>p.id),['nanjing']);
});

test('cross-country event navigation reveals the target and uses its own era metadata',()=>{
  const {ui,get}=app();
  Object.assign(ui.state,{events:[event('cn',1405,'中国事件'),
    {...event('fr',1405,'法国事件'),placeId:'paris',category:'政治'},
    {...event('fr-era',1406,'有时期的法国事件'),placeId:'paris',era:'瓦卢瓦王朝'}],
    places,countryFeatures,scope:'all',year:1405,region:'CN-JS',city:'nanjing',period:'ming',
    min:1368,max:1644,category:'文化',query:'中国',selected:'cn'});
  ui.selectEvent('fr');
  assert.equal(ui.state.countryCode,'FR');assert.equal(ui.state.period,'all');
  assert.equal(ui.state.region,'all');assert.equal(ui.state.city,'all');
  assert.equal(ui.state.category,'all');assert.equal(ui.state.query,'');
  assert.equal(ui.state.selected,'fr');assert.ok(ui.filtered().some(e=>e.id==='fr'));
  assert.match(get('detail').innerHTML,/法国事件/);assert.doesNotMatch(get('detail').innerHTML,/永乐|洪武|明 ·/);
  ui.selectEvent('fr-era');assert.equal(ui.state.selected,'fr-era');assert.match(get('detail').innerHTML,/瓦卢瓦王朝/);
  ui.selectEvent('cn');assert.equal(ui.state.countryCode,'CN');assert.equal(ui.state.selected,'cn');
  assert.match(get('detail').innerHTML,/永乐三年/);assert.match(get('period-filter').innerHTML,/value="ming"/);
});

test('countries without records clear stale details, years and map markers',()=>{
  const {ui,get}=app(),markers=[];
  Object.assign(ui.state,{events:[event('cn',1405),{...event('fr',1405),placeId:'paris'}],
    places,countryFeatures,scope:'year',year:1405,selected:'cn'});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:visible=>markers.push(visible),flyPlace(){}});
  ui.bind();ui.renderHistory();assert.match(get('detail').innerHTML,/1405/);
  get('country-filter').onchange({target:{value:'JP'}});
  assert.equal(ui.state.countryCode,'JP');assert.equal(ui.state.year,1405);assert.equal(ui.state.selected,null);
  assert.equal(ui.filtered().length,0);assert.match(get('event-list').innerHTML,/暂无匹配记录/);
  assert.match(get('detail').innerHTML,/选择事件查看详情。/);
  assert.equal(markers.at(-1).length,0);assert.equal(get('event-dots').innerHTML,'');
  assert.equal(get('year-filter').disabled,true);assert.doesNotMatch(get('year-filter').innerHTML,/value="1405"/);
  assert.equal(get('city-filter').disabled,true);assert.equal(get('region-filter').disabled,true);
  assert.equal(get('period-filter').disabled,true);assert.equal(get('era-label').textContent,'');
});

test('custom type remains selected and only local personal details offer editing before the body',async()=>{
  const {ui,context,get}=app();
  const personal={...event('personal',1405,'个人资料'),summary:'正文内容',userCreated:true};
  const library={events:[event('builtin',1405,'内置资料'),personal],places,meta:{}};
  context.fetch=async()=>({ok:true,json:async()=>library});
  Object.assign(ui.state,{year:1405,session:{interface:'local',canEdit:true}});
  await ui.refreshLibrary();ui.bind();
  assert.match(get('category').innerHTML,/<option value="custom">自定义<\/option>/);
  get('category').onchange({target:{value:'custom'}});
  ui.selectEvent('personal');
  assert.equal(ui.state.category,'custom');assert.equal(get('category').value,'custom');
  assert.deepEqual(ui.filtered().map(record=>record.id),['personal']);
  const detail=get('detail').innerHTML,summaryIndex=detail.indexOf('class="detail-summary"');
  assert.match(detail,/id="edit-event">编辑<\/button>/);
  assert.match(detail,/id="delete-event">删除<\/button>/);
  assert.ok(detail.indexOf('id="edit-event"')<summaryIndex);
  assert.ok(detail.indexOf('id="delete-event"')<summaryIndex);
  ui.selectEvent('builtin');
  assert.doesNotMatch(get('detail').innerHTML,/id="(?:edit|delete)-event"/);
  for(const session of [{interface:'web',canEdit:false},{interface:'web',canEdit:true},{interface:'local',canEdit:false}]){
    ui.state.session=session;ui.selectEvent('personal');
    assert.equal(ui.state.selected,'personal');
    assert.doesNotMatch(get('detail').innerHTML,/id="(?:edit|delete)-event"/);
    assert.equal(get('add-button').hidden,true);
  }
});

test('linked custom places share the city option and event navigation preserves the selected city',async()=>{
  const {ui,context,get}=app(),flights=[];
  const site={id:'site-nanjing',name:'城墙遗址',isCustom:true,cityId:'nanjing',cityName:'南京',countryCode:'CN',regionCode:'CN-JS',regionName:'江苏',lon:118.71,lat:32.08};
  const library={events:[event('city-record',1405),{...event('site-record',1405),placeId:site.id,userCreated:true}],places:[site,...places],meta:{}};
  context.fetch=async()=>({ok:true,json:async()=>library});
  Object.assign(ui.state,{year:1405,city:'nanjing',region:'CN-JS',session:{interface:'local',canEdit:true}});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces(){},flyPlace:place=>flights.push(place)});
  await ui.refreshLibrary();ui.bind();ui.renderHistory();
  assert.equal(ui.state.city,'nanjing');
  assert.equal([...get('city-filter').innerHTML.matchAll(/value="nanjing"/g)].length,1);
  assert.match(get('city-filter').innerHTML,/>南京<\/option>/);
  assert.doesNotMatch(get('city-filter').innerHTML,/城墙遗址|site-nanjing/);
  assert.deepEqual(new Set(ui.filtered().map(record=>record.id)),new Set(['city-record','site-record']));
  get('event-list').onclick({target:{closest:selector=>selector==='[data-event]'?{dataset:{event:'site-record'}}:null}});
  assert.equal(ui.state.city,'nanjing');assert.equal(ui.state.selected,'site-record');
  assert.equal(flights.at(-1).id,site.id);assert.equal(flights.at(-1).lon,site.lon);
  assert.equal(flights.at(-1).lat,site.lat);
  ui.selectEvent('city-record');assert.equal(ui.state.city,'nanjing');
  ui.selectEvent('site-record');assert.equal(ui.state.city,'nanjing');
});

test('custom-only cities can be selected while unlinked sites stay out of cities and old markers',async()=>{
  const {ui,context,get}=app(),markers=[];
  const common={isCustom:true,countryCode:'CN',regionCode:'CN-SN',regionName:'陕西'};
  const current={...common,id:'site-current',name:'遗址甲',cityId:'custom-xian',cityName:'西安',lon:108.91,lat:34.31};
  const old={...common,id:'site-old',name:'遗址乙',cityId:'custom-xian',cityName:'西安',lon:108.83,lat:34.29};
  const unlinked={...common,id:'site-unlinked',name:'野外发现点',cityId:null,cityName:'',lon:109.24,lat:34.18};
  const library={events:[
    {...event('current',1405),placeId:current.id,userCreated:true},
    {...event('old',1404),placeId:old.id,userCreated:true},
    {...event('unlinked',1405),placeId:unlinked.id,userCreated:true},
  ],places:[...places,current,old,unlinked],meta:{}};
  context.fetch=async()=>({ok:true,json:async()=>library});
  Object.assign(ui.state,{year:1405,scope:'all',category:'custom',region:'CN-SN'});
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:(visible,options)=>markers.push({visible,options}),flyPlace(){}});
  await ui.refreshLibrary();ui.bind();ui.renderHistory();
  const cityOptions=get('city-filter').innerHTML;
  assert.equal([...cityOptions.matchAll(/value="custom-xian"/g)].length,1);
  assert.match(cityOptions,/>西安<\/option>/);
  assert.doesNotMatch(cityOptions,/遗址甲|遗址乙|野外发现点|site-unlinked/);
  assert.deepEqual(markers.at(-1).visible.map(place=>place.id),[current.id,unlinked.id]);
  assert.equal(markers.at(-1).visible[0].lon,current.lon);assert.equal(markers.at(-1).visible[0].lat,current.lat);
  get('city-filter').onchange({target:{value:'custom-xian'}});
  assert.equal(ui.state.city,'custom-xian');assert.deepEqual(ui.filtered().map(record=>record.id),['current','old']);
  assert.deepEqual(markers.at(-1).visible.map(place=>place.id),[current.id]);
  await ui.refreshLibrary();ui.renderHistory();assert.equal(ui.state.city,'custom-xian');
  ui.setYear(1404);assert.deepEqual(markers.at(-1).visible.map(place=>place.id),[old.id]);
  assert.equal(markers.at(-1).visible[0].lon,old.lon);assert.equal(markers.at(-1).visible[0].lat,old.lat);
});

for(const scope of ['all','nearby']) {
  test(`${scope} list scope keeps map markers restricted to active events of the selected year`,()=>{
    const {ui}=app(),calls=[];
    Object.assign(ui.state,{events:[event('current',1405),{...event('ongoing',1403),endYear:1407},
      {...event('past',1404),placeId:'beijing'},{...event('future',1406),placeId:'suzhou'},
      {...event('foreign',1405),placeId:'paris'}],places,scope,year:1405,selected:'past'});
    ui.injectMapView({setHistoryPlaces:(visible,options)=>calls.push({visible,options})});
    assert.equal(ui.filtered().length,4);
    ui.updateMarkers();
    assert.deepEqual(calls[0].visible.map(p=>p.id),['nanjing']);
    assert.deepEqual({...calls[0].options.counts},{nanjing:2});
    assert.equal(calls[0].options.selectedPlaceId,undefined);
    ui.state.selected='current';ui.updateMarkers();
    assert.equal(calls[1].options.selectedPlaceId,'nanjing');
    ui.state.year=1411;ui.updateMarkers();
    assert.equal(calls[2].visible.length,0);
  });
}

test('a region without results clears selected details and markers',()=>{
  const {ui,get}=app(),calls=[];
  Object.assign(ui.state,{events:[event('a',1405)],places,scope:'year',year:1405,selected:'a'});
  ui.bind();
  ui.injectMapView({isFlat:()=>false,setHistoryPlaces:visible=>calls.push(visible),flyPlace(){}});
  ui.renderHistory();assert.match(get('detail').innerHTML,/1405/);
  get('region-filter').onchange({target:{value:'CN-ZJ'}});
  assert.equal(ui.state.selected,null);assert.equal(ui.filtered().length,0);
  assert.match(get('detail').innerHTML,/选择事件查看详情。/);
  assert.equal(calls.at(-1).length,0);
});

test('large event lists render at most forty cards per page and pagination reaches the remaining records',()=>{
  const {ui,get}=app();
  Object.assign(ui.state,{events:Array.from({length:95},(_,i)=>event(`event-${i}`,1405,`事件${String(i).padStart(3,'0')}`)),places,scope:'all',year:1405});
  ui.bind();ui.renderHistory();
  const count=()=>[...get('event-list').innerHTML.matchAll(/data-event="/g)].length;
  const page=value=>get('event-list').onclick({target:{closest:selector=>selector==='[data-page]'?{dataset:{page:String(value)},disabled:false}:null}});
  assert.equal(count(),40);assert.match(get('event-list').innerHTML,/1 \/ 3/);
  page(1);assert.equal(count(),40);assert.match(get('event-list').innerHTML,/2 \/ 3/);
  assert.doesNotMatch(get('event-list').innerHTML,/data-event="event-0"/);
  page(2);assert.equal(count(),15);assert.match(get('event-list').innerHTML,/3 \/ 3/);
  assert.match(get('event-list').innerHTML,/data-event="event-94"/);
  ui.selectEvent('event-41');assert.equal(ui.state.page,1);assert.equal(count(),40);
  assert.match(get('event-list').innerHTML,/class="event-card active" data-event="event-41"/);
});

test('layout migrates previous defaults while preserving user-selected sizes and resize limits',()=>{
  for (const [saved,widths] of [
    [{},[240,260]],
    [{layoutVersion:4,explorerWidth:300,detailWidth:324},[240,260]],
    [{layoutVersion:4,explorerWidth:340,detailWidth:400},[340,400]],
    [{layoutVersion:5,explorerWidth:300,detailWidth:324},[300,324]],
  ]) {
    const {context,get}=environment();context.saved=saved;
    context.window.innerWidth=1600;get('.workspace').clientWidth=1600;
    vm.runInContext(preferencesSource+'\n globalThis.prefs=initPreferences({persistLocally:false,initialPreferences:saved});',context);
    assert.equal(context.prefs.snapshot().explorerWidth,widths[0]);
    assert.equal(context.prefs.snapshot().detailWidth,widths[1]);
    assert.equal(get('.workspace').style['--explorer-width'],`${widths[0]}px`);
    assert.equal(get('.workspace').style['--detail-width'],`${widths[1]}px`);
    context.prefs.destroy();
  }
  for (const saved of [{},{timelineHeight:156},{layoutVersion:1,timelineHeight:156},
    {timelineHeight:124},{layoutVersion:2,timelineHeight:124},
    {timelineHeight:96},{layoutVersion:3,timelineHeight:96}]) {
    const {context,get}=environment();context.saved=saved;
    vm.runInContext(preferencesSource+'\n globalThis.prefs=initPreferences({persistLocally:false,initialPreferences:saved});',context);
    assert.equal(context.prefs.snapshot().timelineHeight,88);
    assert.equal(context.prefs.snapshot().layoutVersion,5);
    assert.equal(get('.workspace').style['--timeline-height'],'88px');
    assert.equal(get('timeline-resizer').getAttribute('aria-valuemin'),'88');
    for (const height of [96,124,156]) {
      context.prefs.setTimelineHeight(height);
      const restored=environment();restored.context.saved=context.prefs.snapshot();
      vm.runInContext(preferencesSource+'\n globalThis.prefs=initPreferences({persistLocally:false,initialPreferences:saved});',restored.context);
      assert.equal(restored.context.prefs.snapshot().timelineHeight,height);
      assert.equal(restored.get('.workspace').style['--timeline-height'],`${height}px`);
      restored.context.prefs.destroy();
    }
    context.prefs.applyPreferences({layoutVersion:2,timelineHeight:156});
    assert.equal(context.prefs.snapshot().timelineHeight,156);
    context.prefs.applyPreferences({layoutVersion:3,timelineHeight:124});
    assert.equal(context.prefs.snapshot().timelineHeight,124);
    context.prefs.applyPreferences({timelineHeight:220});
    assert.equal(context.prefs.snapshot().timelineHeight,220);
    context.prefs.applyPreferences({timelineHeight:80});
    assert.equal(context.prefs.snapshot().timelineHeight,88);
    context.prefs.setTimelineHeight(400);
    assert.equal(context.prefs.snapshot().timelineHeight,300);
    context.prefs.destroy();
  }
});

test('database-import preference lock blocks new writes while preserving layout and applying restored settings',()=>{
  const {context,get}=environment(),writes=[];
  context.onChange=value=>writes.push(value);
  vm.runInContext(preferencesSource+'\n globalThis.prefs=initPreferences({persistLocally:false,initialPreferences:{explorerWidth:440,detailWidth:480},onPreferencesChange:onChange});',context);
  const prefs=context.prefs,workspace=get('.workspace');
  const leftWidth=workspace.style['--explorer-width'],rightWidth=workspace.style['--detail-width'];
  prefs.setLocked(true);
  assert.equal(get('theme-select').disabled,true);
  assert.equal(get('display-explorer').disabled,true);
  assert.equal(workspace.style['--explorer-width'],leftWidth);
  assert.equal(workspace.style['--detail-width'],rightWidth);
  prefs.setTheme('night');prefs.setPanelCollapsed('explorer',true);prefs.setTimelineHeight(300);
  assert.equal(writes.length,0);assert.equal(prefs.snapshot().theme,'light');
  prefs.applyPreferences({theme:'paper',explorerCollapsed:true,timelineHeight:220});
  assert.equal(prefs.snapshot().theme,'paper');assert.equal(get('explorer').hidden,true);
  assert.equal(writes.length,0);
  prefs.setLocked(false);prefs.setTheme('night');
  assert.equal(get('theme-select').disabled,false);assert.equal(writes.length,1);
  prefs.destroy();
});

for(const session of [{interface:'web',canEdit:false},{interface:'web',canEdit:true},{interface:'local',canEdit:false}]) {
  test(`server and database settings reject non-local-editor access (${session.interface}, edit=${session.canEdit})`,async()=>{
    const {context,get}=environment();let requests=0;
    context.fixture={session,api:async()=>{requests++;},preferences:{setLocked(){throw new Error('Must not lock reader preferences');}},
      flushPreferences:async()=>{throw new Error('Must not flush reader preferences');},onDatabaseImport:async()=>{},toast(){}};
    context.fetch=async()=>{requests++;throw new Error('Must not request a local-only endpoint');};
    vm.runInContext(settingsSource+'\n globalThis.settings=initSettings(fixture);',context);
    assert.equal(get('server-settings-tab').hidden,true);
    assert.equal(get('database-settings-tab').hidden,true);
    await context.settings.open('database');
    await get('server-form').onsubmit({preventDefault(){},target:new Element()});
    await get('export-database').onclick();
    const input=get('import-database');input.files=[{size:20}];
    await input.onchange({target:input});
    assert.equal(requests,0);
  });
}

for (const successful of [true,false]) {
  test(`database import ${successful?'success':'failure'} releases its preference lock and file controls`,async()=>{
    const {context,get}=environment(),locks=[],applied=[],flushed=deferred();
    context.fixture={
      session:{interface:'local',canEdit:true,token:'test'},
      api:async url=>url==='/api/preferences'?{preferences:{theme:'paper'}}:{contentServer:{enabled:false,port:8080,addresses:[]},database:{}},
      preferences:{setLocked:value=>locks.push(value),applyPreferences:value=>applied.push(value)},
      flushPreferences:()=>flushed.promise,onDatabaseImport:async()=>{},toast(){},
    };
    context.fetch=async()=>({ok:successful,json:async()=>successful?{imported:1,updated:0,skipped:0}:{error:'invalid database'}});
    vm.runInContext(settingsSource+'\n initSettings(fixture);',context);
    const input=get('import-database');input.files=[{size:20}];input.value='test.sqlite';
    const importing=input.onchange({target:input});
    assert.deepEqual(locks,[true]);assert.equal(input.disabled,true);
    assert.equal(get('export-database').disabled,true);
    flushed.resolve();await importing;
    assert.deepEqual(locks,[true,false]);assert.equal(input.disabled,false);
    assert.equal(get('export-database').disabled,false);assert.equal(input.value,'');
    assert.equal(applied.length,successful?1:0);
    assert.match(get('database-status').textContent,successful?/导入完成/:/导入失败/);
  });
}
