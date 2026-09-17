import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,copyFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openChronicleDatabase,validatePreferences,SCHEMA_VERSION} from '../database.mjs';

const example={title:'个人记录',year:1405,placeId:'fixture-place',category:'文化',summary:'回归测试资料',sourceTitle:'测试来源',sourceUrl:'https://example.com/'};
const retainedPreferences={theme:'night',timelineHeight:210,explorerCollapsed:true};
const retiredMarker='obsolete-fixture-bytes-76b1711e';
const hashCanonical=db=>createHash('sha256').update(JSON.stringify(db.prepare('SELECT kind,id,payload FROM canonical_records ORDER BY kind,id').all())).digest('hex');
const temporary=()=>mkdtemp(path.join(tmpdir(),'earthchronicle-test-migration-'));
async function clean(directory){const absolute=path.resolve(directory);assert.equal(path.dirname(absolute),path.resolve(tmpdir()));assert.ok(path.basename(absolute).startsWith('earthchronicle-test-migration-'));await rm(absolute,{recursive:true,force:true});}
async function seedDirectory(directory){
 const publicDir=path.join(directory,'public');await mkdir(path.join(publicDir,'data'),{recursive:true});
 await writeFile(path.join(publicDir,'data','history.json'),JSON.stringify({meta:{title:'测试资料'},places:[{id:'fixture-place',name:'测试地点'}],events:[{id:'fixed-event',year:1368,title:'固定事件',placeId:'fixture-place'}]}));
 return publicDir;
}
async function legacyDatabase(directory,version,publicDir){
 const file=path.join(directory,`legacy-${version}.sqlite`),database=await openChronicleDatabase({databasePath:file,publicDir});
 const event=database.saveEvent(example);database.savePreferences(retainedPreferences);database.saveContentConfig({enabled:true,port:9186});database.close();
 const raw=new DatabaseSync(file);
 try{
  raw.prepare('INSERT INTO canonical_records(kind,id,payload) VALUES (?,?,?)').run('geology-manifest','main',JSON.stringify({fixture:retiredMarker}));
  raw.prepare('INSERT INTO canonical_records(kind,id,payload) VALUES (?,?,?)').run('geology-snapshot','66',JSON.stringify({type:'FeatureCollection',features:[]}));
  if(version===3){
   raw.exec('CREATE TABLE science_assets (id TEXT PRIMARY KEY, content_type TEXT NOT NULL, sha256 TEXT NOT NULL, data BLOB NOT NULL) STRICT');
   const bytes=Buffer.alloc(256*1024,retiredMarker);
   raw.prepare('INSERT INTO science_assets VALUES (?,?,?,?)').run('former-asset','application/octet-stream',createHash('sha256').update(bytes).digest('hex'),bytes);
   for(const key of ['evolutionManifest','evolutionHash','evolutionVersion'])raw.prepare('INSERT INTO metadata VALUES (?,?)').run(key,'retired-fixture-value');
   // Obsolete values are discarded without reviving their former validators.
   raw.prepare('INSERT INTO preferences VALUES (?,?)').run('geoScene','not valid JSON');
   raw.prepare('INSERT INTO preferences VALUES (?,?)').run('geoSpeed','5');
  }
  raw.prepare("UPDATE metadata SET value=? WHERE key='canonicalHash'").run(hashCanonical(raw));
  raw.exec(`PRAGMA user_version=${version}`);
 }finally{raw.close();}
 return {file,event};
}
function assertCleanDatabase(file){
 const db=new DatabaseSync(file,{readOnly:true});
 try{
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name),['canonical_records','metadata','preferences','settings','user_events']);
  assert.deepEqual(db.prepare('SELECT DISTINCT kind FROM canonical_records ORDER BY kind').all().map(row=>row.kind),['history-event','history-meta','place']);
  assert.deepEqual(db.prepare('SELECT key FROM metadata ORDER BY key').all().map(row=>row.key),['appId','canonicalHash']);
  assert.equal(db.prepare("SELECT count(*) AS count FROM preferences WHERE key GLOB 'geo*'").get().count,0);
  assert.equal(db.prepare("SELECT value FROM metadata WHERE key='canonicalHash'").get().value,hashCanonical(db));
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.equal(db.prepare('PRAGMA freelist_count').get().freelist_count,0);
 }finally{db.close();}
}

for(const version of [2,3])test(`schema ${version} migration removes retired data and preserves personal records, settings and history`,async()=>{
 const directory=await temporary();let database,exported;
 try{
  const publicDir=await seedDirectory(directory),{file,event}=await legacyDatabase(directory,version,publicDir),oldSize=(await stat(file)).size;
  const emptyPublic=path.join(directory,'empty');await mkdir(emptyPublic);
  database=await openChronicleDatabase({databasePath:file,publicDir:emptyPublic});
  assert.deepEqual(database.counts(),{schemaVersion:SCHEMA_VERSION,historyEvents:1,places:1,personalEvents:1});
  assert.deepEqual(database.preferences(),retainedPreferences);
  assert.deepEqual(database.contentConfig(),{enabled:true,port:9186});
  assert.deepEqual(database.library().events.find(record=>record.id===event.id),event);
  assert.equal(database.library().events.find(record=>record.id==='fixed-event').userCreated,false);
  exported=await database.exportDatabase();assertCleanDatabase(exported.file);
  assert.equal((await readFile(exported.file)).includes(Buffer.from(retiredMarker)),false);
  database.close();database=null;assertCleanDatabase(file);
  assert.equal((await readFile(file)).includes(Buffer.from(retiredMarker)),false);
  if(version===3)assert.ok((await stat(file)).size<oldSize/2,'VACUUM must release retired BLOB pages');
  database=await openChronicleDatabase({databasePath:file,publicDir:emptyPublic});assert.equal(database.library().events.length,2);
 }finally{database?.close();await exported?.cleanup();await clean(directory);}
});

for(const version of [2,3])test(`schema ${version} backup imports personal changes without restoring removed resources or server settings`,async()=>{
 const directory=await temporary();let target;
 try{
  const publicDir=await seedDirectory(directory),{file,event}=await legacyDatabase(directory,version,publicDir);
  const targetFile=path.join(directory,'target.sqlite');target=await openChronicleDatabase({databasePath:targetFile,publicDir});
  const local=target.saveEvent({...example,title:'目标机原有记录'});target.saveContentConfig({enabled:false,port:9187});
  assert.deepEqual(await target.importDatabaseFile(file),{imported:1,updated:0,skipped:0});
  assert.equal(target.library().events.length,3);assert.ok(target.library().events.some(record=>record.id===local.id));assert.ok(target.library().events.some(record=>record.id===event.id));
  assert.deepEqual(target.preferences(),retainedPreferences);assert.deepEqual(target.contentConfig(),{enabled:false,port:9187});
  assert.deepEqual(await target.importDatabaseFile(file),{imported:0,updated:0,skipped:1});
  target.close();target=null;assertCleanDatabase(targetFile);
  const old=new DatabaseSync(file,{readOnly:true});assert.equal(old.prepare('PRAGMA user_version').get().user_version,version);old.close();
 }finally{target?.close();await clean(directory);}
});

test('a bad old canonical checksum aborts migration before deleting any retired or personal records',async()=>{
 const directory=await temporary();
 try{
  const publicDir=await seedDirectory(directory),{file,event}=await legacyDatabase(directory,3,publicDir);
  let raw=new DatabaseSync(file);raw.prepare("UPDATE canonical_records SET payload='{}' WHERE kind='geology-snapshot'").run();raw.close();
  await assert.rejects(openChronicleDatabase({databasePath:file,publicDir}),/只读资料校验失败/);
  raw=new DatabaseSync(file,{readOnly:true});
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version,3);assert.equal(raw.prepare('SELECT count(*) AS count FROM science_assets').get().count,1);assert.equal(raw.prepare('SELECT id FROM user_events').get().id,event.id);raw.close();
 }finally{await clean(directory);}
});

test('legacy import validates both the whole backup checksum and the retained history before merging anything',async()=>{
 const directory=await temporary();let target;
 try{
  const publicDir=await seedDirectory(directory),{file}=await legacyDatabase(directory,3,publicDir);
  target=await openChronicleDatabase({databasePath:path.join(directory,'target.sqlite'),publicDir});target.savePreferences({theme:'paper'});
  for(const type of ['bad-checksum','changed-history']){
   const changed=path.join(directory,type+'.sqlite');await copyFile(file,changed);const raw=new DatabaseSync(changed);
   if(type==='bad-checksum')raw.prepare("UPDATE canonical_records SET payload='{}' WHERE kind='geology-manifest'").run();
   else{raw.prepare("UPDATE canonical_records SET payload='{}' WHERE kind='history-event'").run();raw.prepare("UPDATE metadata SET value=? WHERE key='canonicalHash'").run(hashCanonical(raw));}
   raw.close();await assert.rejects(target.importDatabaseFile(changed),/只读资料/);
   assert.equal(target.counts().personalEvents,0);assert.deepEqual(target.preferences(),{theme:'paper'});
  }
 }finally{target?.close();await clean(directory);}
});

test('retired preferences cannot be reintroduced through the current settings API',()=>{
 for(const key of ['geoScene','geoModel','geoSpeed','geoArrows','geoBoundaries','geoFeatures'])assert.throws(()=>validatePreferences({[key]:true}),/显示设置.*无效/);
 assert.deepEqual(validatePreferences({theme:'light',detailCollapsed:true}),{theme:'light',detailCollapsed:true});
});
