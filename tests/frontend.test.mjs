import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {eraForYear,yearLabel,eventMatches,escapeHtml,safeSourceUrl} from '../public/domain.js';

// Exercise the shipped UI state functions without starting a server or a real
// browser. Deferred promises model Cesium's asynchronous data-source attachment.
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
  focus(){}
  close(){this.open=false;}
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
    eraForYear,yearLabel,eventMatches,h:escapeHtml,safeSourceUrl});
  return {context,get,elements};
}
const appSource=(await readFile(new URL('../public/app.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace(/\binit\(\);\s*$/,'');
const preferencesSource=(await readFile(new URL('../public/preferences.js',import.meta.url),'utf8')).replace(/^export /gm,'');
const settingsSource=(await readFile(new URL('../public/settings.js',import.meta.url),'utf8')).replace(/^export /gm,'');
function app() {
  const env=environment();
  vm.runInContext(appSource+'\n globalThis.ui={state,refreshLibrary,selectEvent,renderHistory,loadGeology,setMode,setGeo,syncControls,filtered,setYear};',env.context);
  return {...env,ui:env.context.ui};
}
const event=(id,year,title='事件')=>({id,year,title,summary:'',category:'文化',placeId:'nanjing',sourceTitle:'来源'});
const places=[{id:'nanjing',name:'南京',historicalName:'应天',lon:118,lat:32},{id:'beijing',name:'北京',lon:116,lat:39}];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('library refresh clamps a deleted outer year and keeps a still-visible selection after import',async()=>{
  const {ui,context,get}=app();
  Object.assign(ui.state,{year:9999,selected:'deleted',scope:'all'});
  const library={events:[event('early',1368),event('current',1405)],places,meta:{}};
  context.fetch=async()=>({ok:true,json:async()=>library});
  await ui.refreshLibrary();ui.renderHistory();
  assert.equal(ui.state.year,1421);assert.equal(get('year-input').value,1421);
  assert.equal(ui.state.selected,'early');assert.equal(get('next-year').disabled,true);
  assert.equal(get('jump-end').disabled,true);
  Object.assign(ui.state,{year:1405,selected:'current'});
  library.events.push(event('imported',1390));
  await ui.refreshLibrary();ui.renderHistory();
  assert.equal(ui.state.selected,'current');
  ui.state.year=1;await ui.refreshLibrary();assert.equal(ui.state.year,1368);
});

test('related-event navigation clears incompatible search and empty city results clear stale details',()=>{
  const {ui,get}=app();
  Object.assign(ui.state,{events:[event('a',1405,'原事件'),event('b',1406,'关联事件')],places,scope:'all',query:'原事件',selected:'a'});
  ui.selectEvent('b');
  assert.equal(ui.state.query,'');assert.equal(get('search').value,'');
  assert.equal(ui.state.selected,'b');assert.ok(ui.filtered().some(e=>e.id==='b'));
  ui.state.city='beijing';ui.renderHistory();
  assert.equal(ui.state.selected,null);assert.match(get('detail').innerHTML,/选择地球上的地点/);
});

test('unavailable geology is ignored and geological slice input stays within integer bounds',async()=>{
  const {ui,get}=app();
  await ui.setMode('geology');assert.equal(ui.state.mode,'history');
  ui.state.geo={snapshots:[{ma:0},{ma:66}]};
  ui.setGeo(100);assert.equal(ui.state.geoIndex,1);
  ui.setGeo('invalid');assert.equal(ui.state.geoIndex,0);
  ui.setGeo(.7);assert.equal(ui.state.geoIndex,1);
  ui.state.mode='geology';get('detail').innerHTML='already loaded';ui.renderHistory();
  assert.equal(get('detail').innerHTML,'already loaded','a completed history mutation must not reset geology load status');
});

function geologyApp() {
  const env=app(),attached=new Set(),pending=[],fetches=[];
  const imagery={show:true};
  const viewer={
    imageryLayers:{length:1,get:()=>imagery},scene:{requestRender(){}},
    camera:{cancelFlight(){},flyTo(){}},
    dataSources:{
      add(source){const wait=deferred();pending.push({source,resolve:()=>{attached.add(source);wait.resolve(source);}});return wait.promise;},
      remove(source){attached.delete(source);},
    },
  };
  const C={Color:{fromCssColorString:value=>value},GeoJsonDataSource:{load:async data=>({ma:data.ma,entities:{values:[]}})},Cartesian3:{fromDegrees:()=>({})},Math:{PI_OVER_TWO:Math.PI/2}};
  env.context.Cesium=C;env.context.window.Cesium=C;env.context.fixture=viewer;
  env.context.fetch=async url=>{fetches.push(url);return {ok:true,json:async()=>({ma:Number(url.split('/').at(-1))})};};
  vm.runInContext('viewer=fixture;globeReady=true;',env.context);
  Object.assign(env.ui.state,{mode:'geology',geoIndex:0,geo:{snapshots:[{ma:66,label:'A',summary:''},{ma:200,label:'B',summary:''}]}});
  return {...env,viewer,imagery,attached,pending,fetches};
}

test('a late Cesium attachment is removed after switching back to history',async()=>{
  const {ui,pending,attached,imagery}=geologyApp();
  const loading=ui.loadGeology();await tick();assert.equal(pending.length,1);
  await ui.setMode('history');assert.equal(imagery.show,true);
  pending[0].resolve();await loading;
  assert.equal(attached.size,0);
});

test('rapid geological changes retain only the latest layer and deduplicate a repeated slice load',async()=>{
  const {ui,pending,attached,fetches}=geologyApp();
  const first=ui.loadGeology();await tick();assert.equal(pending.length,1);
  ui.state.geoIndex=1;
  const second=ui.loadGeology(),repeat=ui.loadGeology();await tick();
  assert.equal(pending.length,1,'new attachment waits for the previous attachment');
  pending[0].resolve();await tick();
  assert.equal(pending.length,2);pending[1].resolve();
  await Promise.all([first,second,repeat]);
  assert.deepEqual([...attached].map(source=>source.ma),[200]);
  assert.equal(fetches.filter(url=>url.endsWith('/200')).length,1);
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
