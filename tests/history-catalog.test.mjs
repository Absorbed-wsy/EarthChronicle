import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openChronicleDatabase} from '../database.mjs';

const original={meta:{title:'旧版资料'},places:[{id:'test-city',name:'测试城市',lon:116,lat:40,countryCode:'CN'}],events:[{id:'old-event',year:1949,title:'旧版内置事件',placeId:'test-city'}]};
const expanded={...original,meta:{title:'新版资料'},events:[...original.events,{id:'new-event',year:1978,title:'新增内置事件',placeId:'test-city'}]};
const rows=history=>[['history-meta','main',history.meta],...history.places.map(p=>['place',p.id,p]),...history.events.map(e=>['history-event',e.id,e])].map(([kind,id,value])=>({kind,id,payload:JSON.stringify(value)})).sort((a,b)=>a.kind<b.kind?-1:a.kind>b.kind?1:a.id<b.id?-1:a.id>b.id?1:0);
const hash=values=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
async function fixture(){
  const root=await mkdtemp(path.join(tmpdir(),'earthchronicle-catalog-')),publicDir=path.join(root,'public'),databasePath=path.join(root,'chronicle.sqlite');
  await mkdir(path.join(publicDir,'data'),{recursive:true});
  await writeFile(path.join(publicDir,'data','history.json'),JSON.stringify(original));
  const db=await openChronicleDatabase({databasePath,publicDir});
  const event=db.saveEvent({title:'个人记录',year:2020,placeId:'test-city',category:'文化',summary:'保留的内容',sourceTitle:'个人来源'});
  db.savePreferences({theme:'paper',timelineHeight:150});db.saveContentConfig({enabled:true,port:9186});db.close();
  return {root,publicDir,databasePath,event};
}
async function publish(f,history=expanded){
  await writeFile(path.join(f.publicDir,'data','history.json'),JSON.stringify(history));
  await writeFile(path.join(f.publicDir,'data','catalog.json'),JSON.stringify({format:1,revision:'expanded',sha256:hash(rows(history)),previous:[hash(rows(original))]}));
}
async function clean(root){assert.equal(path.dirname(root),tmpdir().replace(/[\\/]$/,''));assert.match(path.basename(root),/^earthchronicle-catalog-/);await rm(root,{recursive:true,force:true});}
test('a verified corpus update is atomic and preserves personal records, preferences and sharing configuration',async()=>{
  const f=await fixture();let db;
  try{
    await publish(f);db=await openChronicleDatabase(f);
    assert.equal(db.counts().historyEvents,2);assert.deepEqual(db.library().events.find(e=>e.userCreated),f.event);
    assert.deepEqual(db.preferences(),{theme:'paper',timelineHeight:150});assert.deepEqual(db.contentConfig(),{enabled:true,port:9186});
    db.close();db=await openChronicleDatabase(f);assert.equal(db.counts().historyEvents,2);assert.equal(db.counts().personalEvents,1);
  }finally{db?.close();await clean(f.root);}
});
test('an original old backup merges personal changes without downgrading the current historical corpus',async()=>{
  const f=await fixture();let db;
  try{
    const old=path.join(f.root,'old.sqlite');await copyFile(f.databasePath,old);
    await publish(f);db=await openChronicleDatabase(f);db.deleteEvent(f.event.id);
    const result=await db.importDatabaseFile(old);assert.equal(result.imported,1);assert.equal(db.counts().historyEvents,2);
    assert.deepEqual(db.library().events.find(e=>e.userCreated),f.event);
    const raw=new DatabaseSync(old);raw.prepare("UPDATE canonical_records SET payload='{}' WHERE kind='history-event'").run();
    raw.prepare("UPDATE metadata SET value=? WHERE key='canonicalHash'").run(hash(raw.prepare('SELECT kind,id,payload FROM canonical_records ORDER BY kind,id').all()));raw.close();
    await assert.rejects(db.importDatabaseFile(old),/不能导入修改过/);assert.equal(db.counts().historyEvents,2);
  }finally{db?.close();await clean(f.root);}
});

test('a trusted catalogue revision expands an existing historical record without changing its identity or personal records',async()=>{
  const f=await fixture();let db;
  try{
    const oldBackup=path.join(f.root,'old.sqlite');await copyFile(f.databasePath,oldBackup);
    const revised={...expanded,events:expanded.events.map(event=>event.id==='old-event'?{...event,summary:'补充事件背景、经过及后续影响。',sources:[{title:'核验来源',url:'https://example.org/history'}]}:event)};
    await publish(f,revised);db=await openChronicleDatabase(f);
    const expected={...revised.events.find(event=>event.id==='old-event'),origin:'bundled',userCreated:false};
    assert.deepEqual(db.library().events.find(event=>event.id==='old-event'),expected);
    assert.deepEqual(db.library().events.find(event=>event.userCreated),f.event);
    assert.deepEqual(await db.importDatabaseFile(oldBackup),{imported:0,updated:0,skipped:1});
    assert.deepEqual(db.library().events.find(event=>event.id==='old-event'),expected);
    db.close();db=await openChronicleDatabase(f);
    assert.deepEqual(db.library().events.find(event=>event.id==='old-event'),expected);
    assert.deepEqual(db.preferences(),{theme:'paper',timelineHeight:150});
  }finally{db?.close();await clean(f.root);}
});
test('invalid bundled files and unrecognized old corpus hashes cannot alter an existing database',async()=>{
  const f=await fixture();
  try{
    await publish(f);await writeFile(path.join(f.publicDir,'data','history.json'),JSON.stringify(original));
    await assert.rejects(openChronicleDatabase(f),/文件校验失败/);
    await publish(f);const raw=new DatabaseSync(f.databasePath);
    raw.prepare("UPDATE canonical_records SET payload='{}' WHERE kind='history-event'").run();
    raw.prepare("UPDATE metadata SET value=? WHERE key='canonicalHash'").run(hash(raw.prepare('SELECT kind,id,payload FROM canonical_records ORDER BY kind,id').all()));raw.close();
    await assert.rejects(openChronicleDatabase(f),/版本无法核验/);
    const check=new DatabaseSync(f.databasePath,{readOnly:true});assert.equal(check.prepare('SELECT count(*) AS n FROM user_events').get().n,1);assert.equal(check.prepare("SELECT count(*) AS n FROM canonical_records WHERE id='new-event'").get().n,0);check.close();
  }finally{await clean(f.root);}
});
