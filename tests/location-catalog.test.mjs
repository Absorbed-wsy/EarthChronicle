import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openChronicleDatabase} from '../database.mjs';
import {eventMatches} from '../public/domain.js';

const original={meta:{title:'旧资料'},places:[],events:[]};
const expanded={...original,places:[
  {id:'paris',name:'巴黎',countryCode:'FR',regionCode:'FR-IDF',regionName:'法兰西岛',lon:2.35,lat:48.86},
  {id:'versailles',name:'凡尔赛',countryCode:'FR',regionCode:'FR-IDF',regionName:'法兰西岛',lon:2.13,lat:48.8},
  {id:'paris-other-country',name:'巴黎',countryCode:'US',regionCode:'US-TX',regionName:'法兰西岛',lon:-95.56,lat:33.66},
  {id:'paris-other-region',name:'巴黎',countryCode:'FR',regionCode:'FR-OTHER',regionName:'测试省',lon:3,lat:47},
]};
const hash=history=>createHash('sha256').update(JSON.stringify([
  ['history-meta','main',history.meta],...history.places.map(p=>['place',p.id,p]),...history.events.map(e=>['history-event',e.id,e]),
].map(([kind,id,value])=>({kind,id,payload:JSON.stringify(value)})).sort((a,b)=>a.kind<b.kind?-1:a.kind>b.kind?1:a.id<b.id?-1:a.id>b.id?1:0))).digest('hex');
const input=(countryCode='FR',regionName='法兰西岛',cityName='巴黎')=>({title:'个人考察',year:2020,category:'文化',summary:'现场记录',sourceTitle:'个人记录',location:{name:'我标记的街角',lon:2.301234,lat:48.901234,countryCode,regionName,cityName}});

async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'earthchronicle-location-catalog-')),publicDir=path.join(root,'public');
  await mkdir(path.join(publicDir,'data'),{recursive:true});
  await writeFile(path.join(publicDir,'data/history.json'),JSON.stringify(original));
  const opened=new Set();
  t.after(async()=>{
    for(const db of opened)db.close();
    assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.match(path.basename(root),/^earthchronicle-location-catalog-/);
    await rm(root,{recursive:true,force:true});
  });
  return {root,publicDir,
    async open(name){const db=await openChronicleDatabase({databasePath:path.join(root,`${name}.sqlite`),publicDir});opened.add(db);return db;},
    close(db){db.close();opened.delete(db);},
    async publish(history=expanded){await writeFile(path.join(publicDir,'data/history.json'),JSON.stringify(history));await writeFile(path.join(publicDir,'data/catalog.json'),JSON.stringify({format:1,revision:'new',sha256:hash(history),previous:[hash(original)]}));},
    stored(name){const db=new DatabaseSync(path.join(root,`${name}.sqlite`),{readOnly:true});try{return db.prepare('SELECT id,payload,created_at,updated_at FROM user_events ORDER BY id').all();}finally{db.close();}},
  };
}

function checkParis(db,event){
  const library=db.library(),current=library.events.find(e=>e.id===event.id),point=library.places.find(p=>p.id===event.placeId);
  assert.equal(eventMatches(current,{scope:'all',countryCode:'FR',region:'FR-IDF',city:'paris'},library.places),true);
  assert.equal(point.name,event.location.name);assert.equal(point.lon,event.location.lon);assert.equal(point.lat,event.location.lat);
  assert.equal(point.id,event.placeId);assert.equal(point.isCustom,true);
  const french=library.places.filter(p=>p.countryCode==='FR');
  assert.equal(new Set(french.filter(p=>p.regionName==='法兰西岛').map(p=>p.regionCode)).size,1);
  assert.equal(new Set(french.filter(p=>p.regionName==='法兰西岛'&&(p.isCustom?p.cityName:p.name)==='巴黎').map(p=>p.isCustom?p.cityId:p.id)).size,1);
  return current;
}

test('catalogue upgrades resolve old free locations without rewriting personal rows or coordinates',async t=>{
  const f=await fixture(t);let db=await f.open('existing');const event=db.saveEvent(input());f.close(db);
  const before=f.stored('existing');await f.publish();db=await f.open('existing');
  assert.deepEqual(checkParis(db,event),event);assert.deepEqual(f.stored('existing'),before);
  f.close(db);db=await f.open('existing');checkParis(db,event);assert.deepEqual(f.stored('existing'),before);
});

test('old backups resolve canonical city filters on fresh import and equal-timestamp repeated import',async t=>{
  const f=await fixture(t);let old=await f.open('old');const event=old.saveEvent(input());f.close(old);
  const backup=path.join(f.root,'backup.sqlite');await copyFile(path.join(f.root,'old.sqlite'),backup);
  const before=f.stored('old');await f.publish();old=await f.open('old');
  assert.deepEqual(await old.importDatabaseFile(backup),{imported:0,updated:0,skipped:1});checkParis(old,event);assert.deepEqual(f.stored('old'),before);
  const fresh=await f.open('fresh');assert.deepEqual(await fresh.importDatabaseFile(backup),{imported:1,updated:0,skipped:0});
  const imported=checkParis(fresh,event);assert.equal(imported.createdAt,event.createdAt);assert.equal(imported.updatedAt,event.updatedAt);
  const importedRows=f.stored('fresh');assert.deepEqual(await fresh.importDatabaseFile(backup),{imported:0,updated:0,skipped:1});assert.deepEqual(f.stored('fresh'),importedRows);
});

test('same city names remain separated by country and region, and ambiguous cities stay personal',async t=>{
  const f=await fixture(t);let db=await f.open('places');
  const us=db.saveEvent(input('US')),otherRegion=db.saveEvent(input('FR','测试省')),unknownRegion=db.saveEvent(input('FR','未知省')),ambiguous=db.saveEvent(input('FR','歧义省'));
  f.close(db);await f.publish({...expanded,places:[...expanded.places,
    {id:'ambiguous-a',name:'巴黎',countryCode:'FR',regionCode:'FR-AMB',regionName:'歧义省',parentCity:'甲地级市',lon:1,lat:45},
    {id:'ambiguous-b',name:'巴黎',countryCode:'FR',regionCode:'FR-AMB',regionName:'歧义省',parentCity:'乙地级市',lon:2,lat:45},
  ]});db=await f.open('places');
  const library=db.library(),get=e=>library.places.find(p=>p.id===e.placeId);
  assert.equal(get(us).cityId,'paris-other-country');assert.equal(get(otherRegion).cityId,'paris-other-region');
  assert.equal(get(unknownRegion).cityId,unknownRegion.location.cityId);assert.equal(get(unknownRegion).regionCode,unknownRegion.location.regionCode);
  assert.equal(get(ambiguous).cityId,ambiguous.location.cityId);assert.equal(get(ambiguous).regionCode,'FR-AMB');
  assert.equal(get(ambiguous).parentCity,undefined);
  for(const event of [us,otherRegion,unknownRegion,ambiguous]){
    assert.equal(eventMatches(event,{scope:'all',countryCode:'FR',region:'FR-IDF',city:'paris'},library.places),false);
    const projected=get(event);assert.equal(projected.name,event.location.name);assert.equal(projected.lon,event.location.lon);assert.equal(projected.lat,event.location.lat);
  }
});

test('linked and upgraded personal county points gain prefecture search without inheriting site aliases or rewriting stored records',async t=>{
  const f=await fixture(t);let db=await f.open('county');
  const countyInput={...input('CN','陕西省','扶风县'),location:{...input('CN','陕西省','扶风县').location,name:'我的田野笔记点',lon:107.91234,lat:34.38123}};
  const oldEvent=db.saveEvent(countyInput);f.close(db);
  const beforeUpgrade=f.stored('county'),backup=path.join(f.root,'old-county.sqlite');await copyFile(path.join(f.root,'county.sqlite'),backup);
  await f.publish({...expanded,places:[...expanded.places,{id:'fufeng',name:'扶风县',lon:107.9,lat:34.376,countryCode:'CN',regionCode:'CN-61',regionName:'陕西省',adminLevel:'county',parentCity:'宝鸡市',aliases:['法门寺']}]});
  const check=(database,event)=>{
    const library=database.library(),point=library.places.find(p=>p.id===event.placeId),current=library.events.find(e=>e.id===event.id);
    assert.equal(point.parentCity,'宝鸡市');assert.equal(point.cityId,'fufeng');
    assert.equal(point.name,event.location.name);assert.equal(point.lon,event.location.lon);assert.equal(point.lat,event.location.lat);
    assert.equal(point.aliases,undefined);assert.equal(current.location.parentCity,undefined);
    assert.equal(current.createdAt,event.createdAt);assert.equal(current.updatedAt,event.updatedAt);
    assert.equal(eventMatches(current,{scope:'all',countryCode:'CN',region:'CN-61',city:'fufeng',query:'宝鸡市'},library.places),true);
    assert.equal(eventMatches(current,{scope:'all',query:'法门寺'},library.places),false);
  };
  db=await f.open('county');check(db,oldEvent);assert.deepEqual(f.stored('county'),beforeUpgrade);
  const linked=db.saveEvent({...countyInput,location:{...countyInput.location,cityId:'fufeng'}}),beforeRead=f.stored('county');
  check(db,linked);check(db,oldEvent);assert.deepEqual(f.stored('county'),beforeRead);
  const imported=await f.open('county-import');assert.deepEqual(await imported.importDatabaseFile(backup),{imported:1,updated:0,skipped:0});
  const beforeImportedRead=f.stored('county-import');check(imported,oldEvent);assert.deepEqual(f.stored('county-import'),beforeImportedRead);
});
