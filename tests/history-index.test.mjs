import test from 'node:test';
import assert from 'node:assert/strict';
import { eventMatches, eventIsActive } from '../public/domain.js';
import { EVENT_PAGE_SIZE, eventYearGroups, timelineStops } from '../public/history-index.js';

const places = [
  {id:'nanjing',name:'南京',historicalName:'应天',aliases:['金陵'],countryCode:'CN',regionCode:'CN-JS',regionName:'江苏'},
  {id:'suzhou',name:'苏州',historicalName:'吴',countryCode:'CN',regionCode:'CN-JS',regionName:'江苏'},
  {id:'hangzhou',name:'杭州',historicalName:'临安',countryCode:'CN',regionCode:'CN-ZJ',regionName:'浙江'},
  {id:'paris',name:'巴黎',countryCode:'FR',regionCode:'FR-IDF',regionName:'法兰西岛'},
];
const placeMap = new Map(places.map(place=>[place.id,place]));
const event = (id,placeId,year,category='政治',title='重大事件',extra={}) => ({id,placeId,year,category,title,summary:'',...extra});
const records = [
  event('nj-policy','nanjing',2026,'政治','城市治理改革',{summary:'公共服务制度调整'}),
  event('nj-science','nanjing',2026,'科技','科学设施开放'),
  event('sz-policy','suzhou',2026,'政治','城市治理改革'),
  event('hz-policy','hangzhou',2026,'政治','城市治理改革'),
  event('paris-policy','paris',2026,'政治','城市治理改革'),
  event('nj-old','nanjing',2025,'政治','城市治理改革'),
  event('nj-future','nanjing',2027,'政治','城市治理改革'),
];
const filter = overrides => ({year:2026,scope:'year',city:'all',category:'all',query:'',countryCode:'CN',region:'all',...overrides});
const ids = (events,criteria) => events.filter(record=>eventMatches(record,criteria,placeMap)).map(record=>record.id);

test('country, province, city, category, keyword and year intersect without leaking other events', () => {
  assert.deepEqual(ids(records,filter({region:'CN-JS',city:'nanjing',category:'政治',query:' 公共服务 '})), ['nj-policy']);
  assert.deepEqual(ids(records,filter({region:'CN-JS',category:'政治'})), ['nj-policy','sz-policy']);
  assert.deepEqual(ids(records,filter({region:'CN-ZJ',city:'nanjing'})), []);
  assert.equal(ids(records,filter()).includes('paris-policy'),false);
});

test('all countries includes foreign records and still respects region, city and year filters', () => {
  assert.deepEqual(ids(records,filter({countryCode:'all'})),['nj-policy','nj-science','sz-policy','hz-policy','paris-policy']);
  assert.deepEqual(ids(records,filter({countryCode:'FR'})),['paris-policy']);
  assert.deepEqual(ids(records,filter({countryCode:'all',region:'FR-IDF'})),['paris-policy']);
  assert.deepEqual(ids(records,filter({countryCode:'all',city:'paris'})),['paris-policy']);
  assert.equal(eventMatches(records[4],filter({countryCode:'all'}),places),true);
});

test('custom type selects personal provenance while ordinary types continue to filter event categories', () => {
  const events=[
    event('built-in','nanjing',2026,'政治'),
    event('personal','nanjing',2026,'政治','个人事件',{userCreated:true}),
    event('personal-origin','nanjing',2026,'文化','个人事件',{origin:'user'}),
    event('category-spoof','nanjing',2026,'custom','内置事件',{userCreated:false,origin:'builtin'}),
    event('string-flag','nanjing',2026,'自定义','内置事件',{userCreated:'true'}),
  ];
  assert.deepEqual(ids(events,filter({category:'custom'})),['personal','personal-origin']);
  assert.deepEqual(ids(events,filter({category:'政治'})),['built-in','personal']);
  assert.deepEqual(ids(events,filter({category:'文化'})),['personal-origin']);
  assert.equal(ids(events,filter()).length,events.length);
});

test('custom event provenance intersects exact years, countries, regions, cities and periods', () => {
  const events=[
    event('current','nanjing',2026,'文化','城市遗址',{userCreated:true}),
    event('past','nanjing',2025,'文化','城市遗址',{userCreated:true}),
    event('future','nanjing',2027,'文化','城市遗址',{userCreated:true}),
    event('other-city','suzhou',2026,'文化','城市遗址',{userCreated:true}),
    event('other-region','hangzhou',2026,'文化','城市遗址',{userCreated:true}),
    event('foreign','paris',2026,'文化','城市遗址',{userCreated:true}),
    event('built-in','nanjing',2026,'文化','城市遗址'),
  ];
  const selected=filter({category:'custom',region:'CN-JS',city:'nanjing',query:'遗址',min:2026,max:2026});
  assert.deepEqual(ids(events,selected),['current']);
  assert.deepEqual(ids(events,{...selected,scope:'all',min:2025,max:2027}),['current','past','future']);
  assert.deepEqual(ids(events,filter({category:'custom',countryCode:'all'})),['current','other-city','other-region','foreign']);
  assert.deepEqual(ids(events,filter({category:'custom',countryCode:'FR'})),['foreign']);
});

test('custom map places use their linked city and remain searchable by place, city and region names', () => {
  const customPlaces=[...places,
    {id:'site-1',name:'城墙遗址',isCustom:true,cityId:'nanjing',cityName:'南京',countryCode:'CN',regionCode:'CN-JS',regionName:'江苏'},
    {id:'site-2',name:'野外发现点',isCustom:true,cityId:null,cityName:'',countryCode:'CN',regionCode:'CN-JS',regionName:'江苏'},
  ];
  const events=[
    event('linked','site-1',2026,'文化','考察记录',{userCreated:true}),
    event('unlinked','site-2',2026,'文化','考察记录',{userCreated:true}),
    event('original-city','nanjing',2026,'政治'),
  ];
  for(const source of [customPlaces,new Map(customPlaces.map(place=>[place.id,place]))]){
    const match=criteria=>events.filter(record=>eventMatches(record,filter(criteria),source)).map(record=>record.id);
    assert.deepEqual(match({city:'nanjing'}),['linked','original-city']);
    assert.deepEqual(match({city:'site-1'}),[]);
    assert.deepEqual(match({city:'site-2'}),[]);
    assert.deepEqual(match({category:'custom',region:'CN-JS'}),['linked','unlinked']);
    assert.deepEqual(match({category:'custom',query:'南京'}),['linked']);
    assert.deepEqual(match({category:'custom',query:'城墙遗址'}),['linked']);
    assert.deepEqual(match({category:'custom',query:'江苏'}),['linked','unlinked']);
    assert.deepEqual(match({category:'custom',region:'CN-ZJ'}),[]);
    assert.deepEqual(match({category:'custom',year:2025}),[]);
  }
});

test('era search keeps explicit foreign eras without inferring Chinese reigns for foreign records', () => {
  const events=[
    event('chinese','nanjing',1421),
    event('foreign','paris',1421),
    event('explicit','paris',1421,'外交','交流事件',{era:'永乐时期交流'}),
    event('legacy','unclassified',1421),
  ];
  assert.deepEqual(ids(events,filter({countryCode:'all',scope:'all',query:'永乐'})),['chinese','explicit','legacy']);
  assert.deepEqual(ids(events,filter({countryCode:'FR',scope:'all',query:'永乐'})),['explicit']);
  assert.deepEqual(ids(events,filter({countryCode:'FR',scope:'all',query:'1421'})),['foreign','explicit']);
});

test('search includes province, historical names, aliases and event categories', () => {
  assert.deepEqual(ids(records,filter({query:'金陵'})),['nj-policy','nj-science']);
  assert.deepEqual(ids(records,filter({query:'应天',category:'政治'})),['nj-policy']);
  assert.deepEqual(ids(records,filter({query:'浙江'})),['hz-policy']);
  assert.deepEqual(ids(records,filter({query:'科技'})),['nj-science']);
  const latin=[event('latin','nanjing',2026,'科技','NASA 观测记录')];
  assert.deepEqual(ids(latin,filter({query:' nasa '})),['latin']);
});

test('empty searches skip text construction after geographic and time filters pass', () => {
  const record=event('unread','nanjing',2026);
  Object.defineProperty(record,'title',{get(){throw new Error('Text should not be read for an empty search');}});
  assert.equal(eventMatches(record,filter(),placeMap),true);
  assert.equal(eventMatches(record,filter({query:'   '}),placeMap),true);
  assert.equal(eventMatches(record,filter({query:null}),placeMap),true);
  assert.equal(eventMatches(record,filter({year:2025}),placeMap),false);
});

test('multi-year events appear only in their inclusive active years, including the BCE/CE boundary', () => {
  const spanning = event('span','nanjing',2000,'社会','持续事件',{endYear:2002});
  for(const year of [1999,2000,2001,2002,2003]) {
    const expected=year>=2000&&year<=2002;
    assert.equal(eventIsActive(spanning,year),expected);
    assert.equal(eventMatches(spanning,filter({year}),placeMap),expected);
  }
  const ancient=event('ancient','nanjing',-1,'文化','跨纪元事件',{endYear:1});
  assert.deepEqual([-2,-1,0,1,2].map(year=>eventIsActive(ancient,year)),[false,true,true,true,false]);
  assert.equal(eventIsActive(event('single','nanjing',2026),2025),false);
  assert.equal(eventIsActive(event('single','nanjing',2026),2026),true);
});

test('map year filtering stays exact when list scope is all or nearby', () => {
  for(const scope of ['all','nearby']) {
    const listFilters=filter({scope,city:'nanjing',category:'政治'});
    assert.deepEqual(ids(records,listFilters),['nj-policy','nj-old','nj-future']);
    const mapFilters={...listFilters,scope:'year'};
    assert.deepEqual(ids(records,mapFilters),['nj-policy']);
    assert.ok(records.filter(record=>eventMatches(record,mapFilters,placeMap)).every(record=>eventIsActive(record,2026)));
  }
});

test('period filtering keeps intersecting events and excludes disjoint periods', () => {
  const events=[
    event('before','nanjing',1367),
    event('overlap','nanjing',1360,'政治','过渡事件',{endYear:1370}),
    event('first','nanjing',1368),
    event('last','nanjing',1644),
    event('after','nanjing',1645),
  ];
  assert.deepEqual(ids(events,filter({scope:'all',min:1368,max:1644})),['overlap','first','last']);
  assert.deepEqual(ids(events,filter({year:1368,min:1368,max:1644})),['overlap','first']);
});

test('year groups count each event once, including periods crossing the left boundary', () => {
  const events=[
    event('past','nanjing',1300),
    event('cross','nanjing',1360,'政治','跨年',{endYear:1370}),
    event('first','nanjing',1368),
    event('last','nanjing',1644),
    event('future','nanjing',1645),
  ];
  assert.deepEqual(eventYearGroups(events,1368,1644),[{year:1644,count:1},{year:1368,count:2}]);
  assert.deepEqual(eventYearGroups([],1368,1644),[]);
  assert.equal(EVENT_PAGE_SIZE,40);
});

test('large libraries use one indexed place lookup per event and bounded timeline nodes', t => {
  class CountingMap extends Map {
    reads=0;
    get(id){this.reads++;return super.get(id);}
  }
  const size=50000,min=-769,max=2026;
  const indexed=new CountingMap(Array.from({length:size},(_,i)=>[`place-${i}`,{id:`place-${i}`,countryCode:'CN',regionCode:'CN-JS',name:`地点${i}`}]));
  const events=Array.from({length:size},(_,i)=>event(`event-${i}`,`place-${i}`,min+i%(max-min+1)));
  const start=performance.now();
  const matching=events.filter(record=>eventMatches(record,filter({scope:'all',min,max}),indexed));
  const groups=eventYearGroups(matching,min,max);
  const stops=timelineStops(groups,min,max,80);
  t.diagnostic(`50,000 records indexed and grouped in ${Math.round(performance.now()-start)} ms`);
  assert.equal(indexed.reads,size);
  assert.equal(matching.length,size);
  assert.equal(groups.reduce((sum,group)=>sum+group.count,0),size);
  assert.ok(stops.length<=80);
  assert.equal(stops.reduce((sum,stop)=>sum+stop.count,0),size);
  assert.equal(Math.min(...stops.map(stop=>stop.first)),min);
  assert.equal(Math.max(...stops.map(stop=>stop.last)),max);
  assert.ok(stops.every(stop=>stop.first<=stop.year&&stop.year<=stop.last));
  assert.ok(stops.every((stop,i)=>i===0||stops[i-1].year>=stop.year));
  assert.ok(stops.every((stop,i)=>i===0||stops[i-1].year-stop.year>=(max-min)/79));
});

test('sparse records in a narrow cluster combine on a wide timeline and unfold on a dynasty timeline', () => {
  const groups=Array.from({length:20},(_,i)=>({year:1368+i*2,count:i+1}));
  const snapshot=structuredClone(groups),count=groups.reduce((sum,group)=>sum+group.count,0);
  const wholeHistory=timelineStops(groups,-769,2026,43);
  const ming=timelineStops(groups,1368,1644,43);
  assert.equal(wholeHistory.length,1);
  assert.deepEqual(wholeHistory,[{year:1406,count,first:1368,last:1406}]);
  assert.ok(ming.length>wholeHistory.length);
  assert.ok(ming.length<groups.length);
  assert.equal(ming.reduce((sum,stop)=>sum+stop.count,0),count);
  assert.ok(ming.every((stop,i)=>i===0||ming[i-1].year-stop.year>=(1644-1368)/42));
  assert.deepEqual(groups,snapshot);
});

test('small and single-year timelines preserve counts without mutating their input', () => {
  const groups=[{year:2026,count:2},{year:2020,count:1}];
  const snapshot=structuredClone(groups);
  assert.deepEqual(timelineStops(groups,2020,2026,100),[
    {year:2026,count:2,first:2026,last:2026},
    {year:2020,count:1,first:2020,last:2020},
  ]);
  const merged=timelineStops(groups,2020,2026,1);
  assert.deepEqual(merged,[{year:2026,count:3,first:2020,last:2026}]);
  assert.deepEqual(groups,snapshot);
  assert.deepEqual(timelineStops([{year:2026,count:50000}],2026,2026),[{year:2026,count:50000,first:2026,last:2026}]);
  assert.deepEqual(timelineStops([],2026,2026),[]);
});
