import {initPreferences,readLegacyPreferences} from './preferences.js';
import {initSettings} from './settings.js';
import {initMapNavigation} from './map-navigation.js';
import {eraForYear,yearLabel,eventMatches,escapeHtml as h,safeSourceUrl} from './domain.js';
const $=id=>document.getElementById(id);
const state={mode:'history',year:1405,scope:'nearby',city:'all',category:'all',query:'',selected:null,geoIndex:1,labels:true,events:[],places:[],session:{},geo:null,min:1368,max:1421};
let viewer,markerSource,geoSource,playTimer,toastTimer,geoRequest=0,navigation,globeReady=false,preferences,settings,editingEventId=null,pendingPreferences=null,preferencesTimer,preferencesSaving;
let geoAttachment=Promise.resolve();
const geoCache=new Map();
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(state.session.token?{'X-Edit-Token':state.session.token}:{}),...options.headers}});const data=await response.json();if(!response.ok)throw new Error(data.error||'请求未完成，请重试。');return data;}
const placeOf=event=>state.places.find(p=>p.id===event?.placeId);
const filtered=()=>state.events.filter(e=>eventMatches(e,state,state.places)).sort((a,b)=>a.year-b.year||a.title.localeCompare(b.title));
const eventRange=e=>e.endYear&&e.endYear!==e.year?`${yearLabel(e.year)}—${yearLabel(e.endYear)}`:yearLabel(e.year);
function activeEra(e){return e.era||eraForYear(e.year);}
function stopPlayback(){clearInterval(playTimer);playTimer=null;$('play').textContent='▶';$('play').setAttribute('aria-label','播放时间轴');}
function syncControls(){
  const history=state.mode==='history';
  $('add-button').hidden=!history||!state.session.canEdit;
  document.body.dataset.mode=state.mode;
  $('history-tab').classList.toggle('active',state.mode==='history');$('history-tab').setAttribute('aria-pressed',state.mode==='history');
  $('geology-tab').classList.toggle('active',state.mode==='geology');$('geology-tab').setAttribute('aria-pressed',state.mode==='geology');
  $('history-controls').hidden=state.mode!=='history';$('year-input').hidden=state.mode!=='history';$('geology-year').hidden=state.mode==='history';$('ma-unit').hidden=state.mode==='history';
  $('labels-toggle').hidden=state.mode!=='history';
  if(state.mode==='history'){
    $('chapter-kicker').textContent='CHAPTER 01';$('chapter-title').textContent='明初，一座城与一个时代';
    $('coverage').textContent=`示例篇章 · ${state.min}—${state.max}`;$('list-label').textContent='时间中的足迹';
    $('time-unit').textContent='公元 / CE';$('era-label').textContent=eraForYear(state.year);$('year-input').value=state.year;$('year-input').min=state.min;$('year-input').max=state.max;
    $('time-slider').min=state.min;$('time-slider').max=state.max;$('time-slider').value=state.year;$('time-slider').setAttribute('aria-label','浏览年份');
    $('jump-start').textContent='篇章起点';$('jump-end').textContent='篇章终点';$('previous-year').setAttribute('aria-label','前一年');$('next-year').setAttribute('aria-label','后一年');
    $('time-ticks').innerHTML=Array.from({length:6},(_,i)=>`<span>${Math.round(state.min+(state.max-state.min)*i/5)}</span>`).join('');
    $('city-filters').innerHTML=[{id:'all',name:'全部'},...state.places].map(p=>`<button class="city-filter ${state.city===p.id?'active':''}" data-city="${h(p.id)}">${h(p.name)}</button>`).join('');
    const dots=[...new Set(state.events.map(e=>e.year))];$('event-dots').innerHTML=dots.map(y=>`<button class="time-dot ${y===state.year?'active':''}" style="left:${(y-state.min)/(state.max-state.min)*100}%" data-year="${y}" title="${y} 年" aria-label="跳转到 ${y} 年"></button>`).join('');
  } else {
    const snap=state.geo?.snapshots[state.geoIndex];
    $('chapter-kicker').textContent='DEEP TIME';$('chapter-title').textContent='大陆，也在漫长地旅行';
    $('coverage').textContent='模型范围 · 0—250 Ma';$('list-label').textContent='地质年代切片';
    $('time-unit').textContent='距今 / 百万年';$('geology-year').textContent=snap?.ma??'—';$('era-label').textContent=snap?.label??'加载中';
    $('time-slider').min=0;$('time-slider').max=(state.geo?.snapshots.length||4)-1;$('time-slider').value=state.geoIndex;$('time-slider').setAttribute('aria-label','地质年代切片');
    $('jump-start').textContent='现代参考';$('jump-end').textContent='最早切片';$('previous-year').setAttribute('aria-label','较近的年代');$('next-year').setAttribute('aria-label','较早的年代');
    $('time-ticks').innerHTML=(state.geo?.snapshots||[]).map(s=>`<span>${s.ma} Ma</span>`).join('');$('event-dots').innerHTML='';
  }
  const position=history?state.year:state.geoIndex,first=history?state.min:0,last=history?state.max:(state.geo?.snapshots.length||4)-1;
  $('previous-year').disabled=position<=first;$('next-year').disabled=position>=last;
  $('jump-start').disabled=position<=first;$('jump-end').disabled=position>=last;
  for(const id of ['previous-year','next-year'])$(id).title=$(id).getAttribute('aria-label');
  syncMapControls();
}
function renderList(){
  if(state.mode==='geology'){
    $('event-count').textContent=`${state.geo?.snapshots.length||0} 个切片`;
    $('event-list').innerHTML=state.geo?state.geo.snapshots.map((s,i)=>`<button class="event-card geo-card ${i===state.geoIndex?'active':''}" data-geo="${i}"><div class="event-meta"><time>${s.ma===0?'今天':s.ma+' Ma'}</time></div><h3>${h(s.label)}</h3><span class="event-place">${h(s.shortDescription||'查看这个年代的陆块位置')}</span></button>`).join(''):'<div class="empty-state">地质数据未能载入，请刷新后重试。</div>';return;
  }
  const events=filtered();$('event-count').textContent=`${events.length} 条事件`;
  if(!events.length){$('event-list').innerHTML='<div class="empty-state"><strong>暂无符合条件的事件</strong><button id="clear-filters">查看整个篇章 →</button></div>';return;}
  $('event-list').innerHTML=events.map(e=>`<button class="event-card ${e.id===state.selected?'active':''}" data-event="${h(e.id)}"><div class="event-meta"><time>${e.year<=0?'前'+(1-e.year):e.year}</time><span>${h(e.category)}</span>${e.userCreated?'<span class="user-badge">我的记录</span>':''}</div><h3>${h(e.title)}</h3><div class="event-place"><span class="place-dot"></span>${h(placeOf(e)?.historicalName||placeOf(e)?.name)}<span>·</span>${h(activeEra(e).replace('明 · ',''))}</div></button>`).join('');
}
function renderDetail(){
  if(state.mode==='geology'){
    const s=state.geo?.snapshots[state.geoIndex];if(!s)return;
    $('detail').innerHTML=`<div class="geo-detail"><div class="detail-eyeline"><span class="eyebrow">EARTH IN MOTION</span><span class="category-tag">地质重建</span></div><div class="detail-year">${s.ma===0?'现代':s.ma+' Ma'}</div><div class="detail-era">${s.ma===0?'模型的现代参考状态':'距今约 '+(s.ma>=100?(s.ma/100)+' 亿':s.ma*100+' 万')+' 年'}</div><h2>${h(s.label)}</h2><p class="detail-summary">${h(s.summary)}</p><p id="geo-load-status" class="geo-status">正在载入…</p><div class="source-block"><span class="section-label">模型与来源</span><a class="source-link" href="${h(safeSourceUrl(state.geo.sourceUrl)||'https://gwsdoc.gplates.org/models/')}" target="_blank" rel="noopener noreferrer">${h(state.geo.modelLabel||state.geo.model)} ↗</a><p class="precision-note">${h(state.geo.description)}</p></div></div>`;return;
  }
  const e=state.events.find(e=>e.id===state.selected);
  if(!e){$('detail').innerHTML='<div class="detail-empty"><span class="eyebrow">A PLACE IN TIME</span><h2>每个地点，<br>都有一部历史。</h2><p>选择地球上的地点或左侧事件，开始阅读。</p></div>';return;}
  const p=placeOf(e),samePlace=state.events.filter(x=>x.placeId===e.placeId&&x.id!==e.id).sort((a,b)=>Math.abs(a.year-e.year)-Math.abs(b.year-e.year)).slice(0,3).sort((a,b)=>a.year-b.year);
  const sourceUrl=safeSourceUrl(e.sourceUrl);const seq=state.events.filter(x=>!x.userCreated).sort((a,b)=>a.year-b.year).findIndex(x=>x.id===e.id)+1;
  $('detail').innerHTML=`<div class="detail-eyeline"><span class="detail-sequence">${e.userCreated?'MY RECORD':String(seq).padStart(2,'0')+' / CHRONICLE'}</span><span class="category-tag">${h(e.category)}</span></div><div class="detail-year">${e.year<=0?'前 '+(1-e.year):e.year}</div><div class="detail-era">${h(activeEra(e))}${e.endYear&&e.endYear!==e.year?' · 至 '+h(yearLabel(e.endYear)):''}</div><h2>${h(e.title)}</h2><p class="detail-summary">${h(e.summary)}</p><div class="place-panel"><div class="place-panel-top"><div><h3>${h(p?.name)} <span class="optional">${h(p?.historicalName||'')}</span></h3><p class="coordinate">${Math.abs(p?.lat||0).toFixed(2)}° ${p?.lat>=0?'N':'S'} &nbsp; ${Math.abs(p?.lon||0).toFixed(2)}° ${p?.lon>=0?'E':'W'}</p></div><button id="fly-place">定位 ↗</button></div><p>${h(p?.description||'')}</p></div><div class="source-block"><span class="section-label">资料来源</span>${sourceUrl?`<a class="source-link" href="${h(sourceUrl)}" target="_blank" rel="noopener noreferrer">${h(e.sourceTitle||'查看原始资料')} ↗</a>`:`<span class="source-link">${h(e.sourceTitle||'用户笔记，尚未提供来源')}</span>`}<p class="precision-note">按年展示${e.userCreated?' · 用户记录，未经过史料核验':' · 内置史料，只读'}<br>${h(e.locationNote||'坐标为现代城市的示意定位，并非事件发生地的精确遗址坐标。')}</p></div><div class="related-section"><span class="section-label">这个地方的前后篇章</span>${samePlace.length?samePlace.map(x=>`<button class="related-item" data-related="${h(x.id)}"><time>${x.year}</time><span>${h(x.title)}</span></button>`).join(''):'<p class="precision-note">还没有其他记录。</p>'}</div>${e.userCreated&&state.session.canEdit?'<div class="settings-actions"><button class="quiet-button" id="edit-event">编辑个人记录</button><button class="delete-button" id="delete-event">删除个人记录</button></div>':''}`;
}
function updateMarkers(){
  if(!viewer||!markerSource)return;markerSource.show=state.mode==='history';if(state.mode!=='history')return;
  markerSource.entities.removeAll();const C=window.Cesium,events=filtered();
  for(const p of state.places){const matches=events.filter(e=>e.placeId===p.id);const selected=state.events.find(e=>e.id===state.selected)?.placeId===p.id;
    markerSource.entities.add({id:'place:'+p.id,position:C.Cartesian3.fromDegrees(p.lon,p.lat,1200),point:{pixelSize:selected?12:matches.length?8:5,color:C.Color.fromCssColorString(selected?'#f2d7a5':matches.length?'#cba971':'#6c858c'),outlineColor:C.Color.fromCssColorString('#172b32'),outlineWidth:2,disableDepthTestDistance:0},label:{text:p.name+(matches.length?' · '+matches.length:''),font:'13px "Microsoft YaHei",sans-serif',fillColor:C.Color.fromCssColorString(selected?'#f4dab0':'#d4e4df'),outlineColor:C.Color.fromCssColorString('#101e28'),outlineWidth:4,style:C.LabelStyle.FILL_AND_OUTLINE,verticalOrigin:C.VerticalOrigin.CENTER,horizontalOrigin:C.HorizontalOrigin.LEFT,pixelOffset:new C.Cartesian2(13,0),show:state.labels,disableDepthTestDistance:0,distanceDisplayCondition:new C.DistanceDisplayCondition(0,35000000)}});
  }viewer.scene.requestRender();
}
function reconcileSelection(){const events=filtered();if(!events.some(e=>e.id===state.selected))state.selected=events.find(e=>e.year===state.year)?.id||events[0]?.id||null;}
function renderHistory(){if(state.mode!=='history'){renderList();return;}reconcileSelection();syncControls();renderList();renderDetail();updateMarkers();}
function setYear(value,{select=true,refresh=false}={}){
  const numeric=Number(value),year=Math.max(state.min,Math.min(state.max,Number.isFinite(numeric)?Math.round(numeric):state.min));
  // An unchanged year must preserve the selected event and existing map markers.
  if(year===state.year&&!refresh){$('year-input').value=year;$('time-slider').value=year;return;}
  state.year=year;if(select){const events=filtered();state.selected=events.find(e=>e.year===state.year)?.id||events[0]?.id||null;}renderHistory();
}
function selectEvent(id,{fly=false}={}){const event=state.events.find(e=>e.id===id);if(!event)return;state.selected=id;state.year=event.year;if(state.city!=='all'&&state.city!==event.placeId)state.city='all';if(state.category!=='all'&&state.category!==event.category){state.category='all';$('category').value='all';}if(!eventMatches(event,state,state.places)){state.query='';$('search').value='';}renderHistory();if(fly)flyPlace(placeOf(event));}
function flyPlace(place){if(!viewer||!place)return;viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(place.lon,place.lat,1800000),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1.25});}
function homeView(){if(!viewer)return;viewer.camera.cancelFlight();viewer.camera.flyTo({destination:navigation?.isFlat()?Cesium.Rectangle.fromDegrees(-180,-90,180,90):Cesium.Cartesian3.fromDegrees(state.mode==='geology'?25:111,state.mode==='geology'?16:29,16000000),orientation:{heading:0,pitch:-Cesium.Math.PI_OVER_TWO,roll:0},duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1.2});}
function syncMapControls(){
  const flat=navigation?.isFlat()||false;
  $('home-view').title=flat?'返回地图全景':'返回地球全景';$('home-view').setAttribute('aria-label',$('home-view').title);
}
function applyMapTheme(){
  const css=getComputedStyle(document.documentElement),theme=document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]').content=css.getPropertyValue('--bg').trim();
  if(!viewer)return;
  viewer.scene.backgroundColor=Cesium.Color.fromCssColorString(css.getPropertyValue('--stage-bg').trim()||'#e7eff1');
  viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString(theme==='night'?'#162c3a':theme==='paper'?'#b1c5bf':'#c4dce3');
  const layer=viewer.imageryLayers.length?viewer.imageryLayers.get(0):null;if(layer){layer.brightness=theme==='night'?.85:1;layer.saturation=theme==='night'?.65:.85;}
  viewer.scene.requestRender();
}
async function initGlobe(){
  if(!window.Cesium)throw new Error('地球组件未能加载');const C=window.Cesium;C.Ion.defaultAccessToken='';
  viewer=new C.Viewer('globe',{animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,baseLayer:false,mapMode2D:C.MapMode2D.ROTATE,terrainProvider:new C.EllipsoidTerrainProvider(),skyBox:false,skyAtmosphere:new C.SkyAtmosphere(),shouldAnimate:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,contextOptions:{webgl:{alpha:false}}});
  viewer.scene.backgroundColor=C.Color.fromCssColorString('#0a1118');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#162c3a');if(viewer.scene.sun)viewer.scene.sun.show=false;if(viewer.scene.moon)viewer.scene.moon.show=false;viewer.scene.globe.enableLighting=false;viewer.scene.globe.showGroundAtmosphere=true;viewer.scene.screenSpaceCameraController.minimumZoomDistance=18000;viewer.scene.screenSpaceCameraController.maximumZoomDistance=60000000;viewer.resolutionScale=Math.min(devicePixelRatio,1.5);viewer.scene.skyAtmosphere.brightnessShift=-0.2;
  const imagery=await C.TileMapServiceImageryProvider.fromUrl('/vendor/cesium/Assets/Textures/NaturalEarthII');const layer=viewer.imageryLayers.addImageryProvider(imagery);layer.brightness=.85;layer.saturation=.65;
  markerSource=new C.CustomDataSource('历史地点');markerSource.clustering.enabled=true;markerSource.clustering.pixelRange=42;markerSource.clustering.minimumClusterSize=2;
  markerSource.clustering.clusterEvent.addEventListener((entities,cluster)=>{const id={id:'cluster:'+entities.map(e=>e.id.slice(6)).join(',')};cluster.billboard.show=false;cluster.point.show=true;cluster.point.pixelSize=12;cluster.point.color=C.Color.fromCssColorString('#dfbd84');cluster.point.outlineColor=C.Color.fromCssColorString('#182e36');cluster.point.outlineWidth=2;cluster.point.id=id;cluster.label.show=state.labels;cluster.label.text=entities.length+' 处地点';cluster.label.font='13px "Microsoft YaHei",sans-serif';cluster.label.fillColor=C.Color.fromCssColorString('#f2dbb3');cluster.label.outlineColor=C.Color.fromCssColorString('#182e36');cluster.label.outlineWidth=4;cluster.label.style=C.LabelStyle.FILL_AND_OUTLINE;cluster.label.pixelOffset=new C.Cartesian2(16,0);cluster.label.horizontalOrigin=C.HorizontalOrigin.LEFT;cluster.label.id=id;});
  viewer.dataSources.add(markerSource);viewer.camera.setView({destination:C.Cartesian3.fromDegrees(111,29,16000000)});
  viewer.screenSpaceEventHandler.setInputAction(click=>{const picked=viewer.scene.pick(click.position);const id=picked?.id?.id;if(typeof id!=='string'||state.mode!=='history')return;if(id.startsWith('cluster:')){const ids=id.slice(8).split(','),places=state.places.filter(p=>ids.includes(p.id));flyPlace({lon:places.reduce((n,p)=>n+p.lon,0)/places.length,lat:places.reduce((n,p)=>n+p.lat,0)/places.length});return;}if(!id.startsWith('place:'))return;const placeId=id.slice(6);state.city=placeId;let events=filtered();if(!events.length){state.scope='all';$('scope').value='all';events=filtered();}const e=events.sort((a,b)=>Math.abs(a.year-state.year)-Math.abs(b.year-state.year))[0];if(e)selectEvent(e.id);else renderHistory();},C.ScreenSpaceEventType.LEFT_CLICK);
  viewer.scene.renderError.addEventListener(()=>{$('globe-error').hidden=false;});navigation=initMapNavigation(viewer,syncMapControls);syncMapControls();applyMapTheme();updateMarkers();globeReady=true;if(state.mode==='geology'){loadGeology();homeView();}
}
async function loadGeology(){
  if(!state.geo||!viewer||!globeReady)return;const request=++geoRequest,s=state.geo.snapshots[state.geoIndex];if(!s)return;
  viewer.imageryLayers.get(0).show=false;if(markerSource)markerSource.show=false;if(geoSource){viewer.dataSources.remove(geoSource,false);geoSource=null;}
  try{
    let loading=geoCache.get(s.ma);if(!loading){loading=(async()=>{const data=await fetch('/api/geology/'+s.ma).then(r=>{if(!r.ok)throw new Error('数据文件不可用');return r.json();});const source=await Cesium.GeoJsonDataSource.load(data,{fill:Cesium.Color.fromCssColorString('#6f9180'),stroke:Cesium.Color.fromCssColorString('#b3c4a3'),strokeWidth:1,clampToGround:false});for(const e of source.entities.values){if(e.polygon){e.polygon.height=0;e.polygon.outline=false;}if(e.polyline)e.polyline.width=1;}return source;})();geoCache.set(s.ma,loading);loading.catch(()=>{if(geoCache.get(s.ma)===loading)geoCache.delete(s.ma);});}
    const source=await loading;
    // Cesium adds data sources asynchronously. Serialize attachment so a stale
    // slice cannot appear after a newer slice or the historical map is selected.
    const attachment=geoAttachment.catch(()=>{}).then(async()=>{
      if(request!==geoRequest||state.mode!=='geology')return;
      await viewer.dataSources.add(source);
      if(request!==geoRequest||state.mode!=='geology'){viewer.dataSources.remove(source,false);return;}
      geoSource=source;viewer.scene.requestRender();if($('geo-load-status'))$('geo-load-status').hidden=true;
    });
    geoAttachment=attachment;await attachment;
  }catch(error){if(request!==geoRequest)return;if($('geo-load-status')){$('geo-load-status').hidden=false;$('geo-load-status').textContent='图层加载失败，请重新选择年代重试。';}toast('地质图层加载失败：'+error.message);}
}
async function setMode(mode){if(mode==='geology'&&!state.geo?.snapshots.length)return;stopPlayback();state.mode=mode;if(mode==='geology'){$('event-dialog').close();}else reconcileSelection();syncControls();renderList();renderDetail();homeView();if(mode==='history'){geoRequest++;if(geoSource&&viewer){viewer.dataSources.remove(geoSource,false);geoSource=null;}if(viewer?.imageryLayers.length)viewer.imageryLayers.get(0).show=true;updateMarkers();}else{await loadGeology();}}
function setGeo(index){if(!state.geo?.snapshots.length)return;const numeric=Number(index);state.geoIndex=Math.max(0,Math.min(state.geo.snapshots.length-1,Number.isFinite(numeric)?Math.round(numeric):0));syncControls();renderList();renderDetail();loadGeology();}
function step(delta){if(state.mode==='history')setYear(state.year+delta);else{const index=Math.max(0,Math.min((state.geo?.snapshots.length||4)-1,state.geoIndex+delta));if(index!==state.geoIndex)setGeo(index);}}
async function refreshLibrary(){const library=await api('/api/library');state.events=library.events;state.places=library.places;state.meta=library.meta;state.min=Math.min(1368,...state.events.map(e=>e.year));state.max=Math.max(1421,...state.events.map(e=>e.endYear??e.year));state.year=Math.max(state.min,Math.min(state.max,state.year));if(state.city!=='all'&&!state.places.some(p=>p.id===state.city))state.city='all';reconcileSelection();$('event-place').innerHTML=state.places.map(p=>`<option value="${h(p.id)}">${h(p.name)} · ${h(p.historicalName||'')}</option>`).join('');}
function showSources(){const sources=[...new Map(state.events.filter(e=>!e.userCreated&&safeSourceUrl(e.sourceUrl)).map(e=>[e.sourceUrl,{title:e.sourceTitle,url:e.sourceUrl}])).values()];$('sources-content').innerHTML=`<p>地球史书 v${h(state.session.version || '0.3')}</p><h3>历史篇章</h3><p>本版收录 ${state.events.filter(e=>!e.userCreated).length} 条明初示例事件，提供摘要与出处。年份之外的月日未在时间轴中展开；无事件的年份表示尚未收录。</p><p>城市坐标用于阅读导航，不能当作古代遗址的精确定位。历史视图使用现代低分辨率地表参考，不代表明代地形或疆域。</p><div class="source-list">${sources.map(s=>`<a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)} ↗</a>`).join('')}</div><h3>地球演化</h3><p>本地保存 MULLER2019 模型的四个陆块轮廓切片。重建轮廓不等于精确古海岸线，也不包含古山脉高度。本版没有演算完整的地形变化。</p><a href="https://gwsdoc.gplates.org/models/" target="_blank" rel="noopener noreferrer">GPlates 模型说明 ↗</a><h3>显示与数据</h3><p>地球显示使用 CesiumJS；现代底图采用其附带的 Natural Earth II。核心资料从运行程序的主机读取，查看外部来源网页时需要联网。</p><h3>借鉴</h3><p>借鉴 Ancient Earth 的年代探索和 Running Reality 的时空读史方式，界面与程序独立实现。</p>`;$('sources-dialog').showModal();}
function bind(){
  $('history-tab').onclick=()=>setMode('history');$('geology-tab').onclick=()=>setMode('geology');
  $('scope').onchange=e=>{state.scope=e.target.value;state.selected=filtered()[0]?.id||null;renderHistory();};$('category').onchange=e=>{state.category=e.target.value;state.selected=filtered()[0]?.id||null;renderHistory();};
  $('search').oninput=e=>{state.query=e.target.value;if(state.query){state.scope='all';$('scope').value='all';}state.selected=filtered()[0]?.id||null;renderHistory();};
  $('city-filters').onclick=e=>{const button=e.target.closest('[data-city]');if(!button)return;state.city=button.dataset.city;state.selected=filtered()[0]?.id||null;renderHistory();};
  $('event-list').onclick=e=>{const event=e.target.closest('[data-event]'),geo=e.target.closest('[data-geo]');if(event)selectEvent(event.dataset.event,{fly:false});if(geo)setGeo(geo.dataset.geo);if(e.target.id==='clear-filters'){Object.assign(state,{scope:'all',city:'all',category:'all',query:''});$('scope').value='all';$('category').value='all';$('search').value='';state.selected=filtered()[0]?.id;renderHistory();}};
  $('detail').onclick=async e=>{const related=e.target.closest('[data-related]');if(related)selectEvent(related.dataset.related,{fly:true});if(e.target.id==='fly-place')flyPlace(placeOf(state.events.find(x=>x.id===state.selected)));if(e.target.id==='edit-event')openEventForm(state.events.find(x=>x.id===state.selected));if(e.target.id==='delete-event'){if(!confirm('删除这条个人记录？'))return;try{await api('/api/events/'+encodeURIComponent(state.selected),{method:'DELETE'});await refreshLibrary();renderHistory();toast('个人记录已删除');}catch(error){toast(error.message);}}};
  $('year-input').oninput=e=>{const year=Number(e.target.value);if(Number.isInteger(year)&&year>=state.min&&year<=state.max){stopPlayback();setYear(year);}};$('year-input').onchange=e=>{stopPlayback();setYear(e.target.value);};$('year-input').onkeydown=e=>{if(e.key==='Enter'){stopPlayback();setYear(e.target.value);}};$('time-slider').oninput=e=>{stopPlayback();state.mode==='history'?setYear(e.target.value):setGeo(e.target.value);};$('event-dots').onclick=e=>{const b=e.target.closest('[data-year]');if(b){stopPlayback();setYear(b.dataset.year);}};
  $('previous-year').onclick=()=>{stopPlayback();step(-1);};$('next-year').onclick=()=>{stopPlayback();step(1);};$('jump-start').onclick=()=>{stopPlayback();state.mode==='history'?setYear(state.min):setGeo(0);};$('jump-end').onclick=()=>{stopPlayback();state.mode==='history'?setYear(state.max):setGeo(state.geo.snapshots.length-1);};
  $('play').onclick=()=>{if(playTimer){stopPlayback();return;}if(state.mode==='history'&&state.year===state.max)setYear(state.min);if(state.mode==='geology'&&state.geoIndex===state.geo.snapshots.length-1)setGeo(0);$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暂停时间轴');playTimer=setInterval(()=>{if((state.mode==='history'&&state.year>=state.max)||(state.mode==='geology'&&state.geoIndex>=state.geo.snapshots.length-1)){stopPlayback();return;}step(1);},state.mode==='history'?1200:5000);};
  $('home-view').onclick=homeView;$('zoom-in').onclick=()=>{viewer?.camera.zoomIn(viewer.camera.positionCartographic.height*.35);viewer?.scene.requestRender();};$('zoom-out').onclick=()=>{viewer?.camera.zoomOut(viewer.camera.positionCartographic.height*.5);viewer?.scene.requestRender();};$('labels-toggle').onclick=()=>{state.labels=!state.labels;$('labels-toggle').classList.toggle('active',state.labels);$('labels-toggle').setAttribute('aria-pressed',state.labels);updateMarkers();};$('retry-globe').onclick=()=>location.reload();
  $('add-button').onclick=()=>openEventForm();
  $('event-form').onsubmit=async e=>{e.preventDefault();const form=e.target,data=Object.fromEntries(new FormData(form));data.year=Number(data.year);data.endYear=data.endYear?Number(data.endYear):null;const button=form.querySelector('[type=submit]');button.disabled=true;try{const result=await api(editingEventId?'/api/events/'+encodeURIComponent(editingEventId):'/api/events',{method:editingEventId?'PUT':'POST',body:JSON.stringify(data)});await refreshLibrary();state.mode='history';state.scope='all';state.city='all';state.category='all';state.query='';$('scope').value='all';$('category').value='all';$('search').value='';await setMode('history');selectEvent(result.event.id);$('event-dialog').close();toast('事件已保存');}catch(error){$('form-error').textContent=error.message;}finally{button.disabled=false;}};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('sources-button').onclick=showSources;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
}
function openEventForm(event=null){
  if(state.mode!=='history'||!state.session.canEdit)return;stopPlayback();editingEventId=event?.id||null;
  const form=$('event-form');form.reset();form.querySelector('h2').textContent=event?'编辑个人记录':'记录一个事件';
  if(event){for(const name of ['title','year','endYear','placeId','category','summary','sourceTitle','sourceUrl'])if(form.elements[name])form.elements[name].value=event[name]??'';}
  else form.elements.year.value=state.year;
  $('form-error').textContent='';$('event-dialog').showModal();
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
    const results=await Promise.allSettled([api('/api/session'),refreshLibrary(),api('/api/geology/manifest')]);
    if(results[0].status==='rejected')throw results[0].reason;state.session=results[0].value;
    if(results[1].status==='rejected')throw results[1].reason;
    if(results[2].status==='fulfilled')state.geo=results[2].value;else{$('geology-tab').disabled=true;console.warn('地质数据不可用',results[2].reason);}
    const local=state.session.interface==='local'&&state.session.canEdit===true;document.body.dataset.interface=local?'local':'web';
    document.title=local?'地球史书 · 本地窗口':'地球史书 · 网页阅读';
    let initialPreferences=null;
    if(local){const saved=await api('/api/preferences');initialPreferences=saved.preferences;if(!Object.keys(initialPreferences).length){initialPreferences=readLegacyPreferences();await api('/api/preferences',{method:'PUT',body:JSON.stringify({preferences:initialPreferences})});}}
    preferences=initPreferences({initialPreferences,persistLocally:!local,onPreferencesChange:local?schedulePreferences:()=>{},onThemeChange:applyMapTheme,onLayoutChange:()=>{if(viewer){viewer.resize();viewer.scene.requestRender();}}});
    settings=initSettings({session:state.session,api,preferences,flushPreferences,onDatabaseImport:async()=>{await refreshLibrary();renderHistory();},toast});
    $('add-button').disabled=!state.session.canEdit;
    state.selected=filtered().find(e=>e.year===state.year)?.id||filtered()[0]?.id||state.events[0]?.id;
    renderHistory();document.body.dataset.ready='true';try{await initGlobe();}catch(error){console.error(error);$('globe-error').hidden=false;}
  }catch(error){$('event-list').innerHTML='<div class="empty-state"><strong>暂时无法打开数据</strong>'+h(error.message)+'<button onclick="location.reload()">重新连接 →</button></div>';toast('请确认本地程序或内容服务器正在运行');}
}
init();
