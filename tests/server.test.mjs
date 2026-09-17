import http from 'node:http';
import net from 'node:net';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir,networkInterfaces} from 'node:os';
import path from 'node:path';
import {createChronicleServer} from '../server.mjs';
import {SCHEMA_VERSION} from '../database.mjs';
import {eraForYear,eventMatches,safeSourceUrl,escapeHtml,yearLabel} from '../public/domain.js';

test('year mapping, interval filtering and source escaping',()=>{
  assert.equal(eraForYear(1368),'明 · 洪武元年');assert.equal(eraForYear(1398),'明 · 洪武三十一年');assert.equal(eraForYear(1399),'明 · 建文元年');assert.equal(eraForYear(1405),'明 · 永乐三年');assert.equal(yearLabel(0),'公元前 1 年');
  const event={year:1374,endYear:1378,placeId:'x',title:'工程',category:'营建',summary:''},query={year:1377,scope:'year',city:'all',category:'all',query:''};assert.ok(eventMatches(event,query,[]));assert.ok(!eventMatches(event,{...query,year:1379},[]));assert.ok(!eventMatches(event,{...query,city:'y'},[]));assert.equal(safeSourceUrl('javascript:alert(1)'),null);assert.equal(escapeHtml('<img>'),'&lt;img&gt;');
});
test('bundled historical content has valid linked data',async()=>{
  const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));assert.equal(data.events.length,24);assert.equal(new Set(data.events.map(e=>e.id)).size,24);for(const event of data.events){assert.ok(data.places.some(p=>p.id===event.placeId));assert.ok(safeSourceUrl(event.sourceUrl));assert.ok(event.precision==='year');}
});
const example={title:'个人测试记录',year:1405,placeId:'nanjing',category:'文化',summary:'自动验证',sourceTitle:'测试',sourceUrl:'https://example.com/'};
async function host(databasePath,publicDir){const desktopKey=randomBytes(32).toString('hex'),app=await createChronicleServer({databasePath,publicDir,desktopKey,contentHost:'127.0.0.1'});const port=await app.listen(0),base='http://127.0.0.1:'+port,session=await fetch(base+'/api/session',{headers:{'X-Desktop-Key':desktopKey}}).then(r=>r.json());return {app,base,session,desktopKey,request:(route,method='GET',body,headers={})=>fetch(base+route,{method,headers:{'X-Desktop-Key':desktopKey,'X-Edit-Token':session.token,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:Buffer.isBuffer(body)?body:JSON.stringify(body)})})};}
async function canConnect(host,port){return new Promise(resolve=>{const socket=net.createConnection({host,port});let completed=false;const end=value=>{if(completed)return;completed=true;socket.destroy();resolve(value);};socket.once('connect',()=>end(true));socket.once('error',()=>end(false));socket.setTimeout(1000,()=>end(false));});}
async function clean(directory){const absolute=path.resolve(directory);assert.equal(path.dirname(absolute),path.resolve(tmpdir()));assert.ok(path.basename(absolute).startsWith('earthchronicle-test-'));await rm(absolute,{recursive:true,force:true});}
test('legacy data migration, one database, immutable sources and personal editing',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let running;
 try{
  const file=path.join(dir,'chronicle.sqlite'),db=new DatabaseSync(file),legacy={...example,id:'user-legacy'},now='2026-01-01T00:00:00.000Z';
  db.exec('CREATE TABLE user_events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');db.prepare('INSERT INTO user_events VALUES(?,?,?,?)').run(legacy.id,JSON.stringify(legacy),now,now);db.close();
  running=await host(file);const {request}=running;
  assert.equal(running.session.interface,'local');assert.equal(running.session.appId,'earth-chronicle');
  let library=await request('/api/library').then(r=>r.json());assert.equal(library.events.length,25);assert.ok(library.events.some(e=>e.id==='user-legacy'));
  assert.equal((await request('/api/events','POST',example,{'X-Edit-Token':'bad'})).status,403);
  assert.equal((await request('/api/events','POST',example,{Origin:'http://evil.example'})).status,403);
  assert.equal((await request('/api/events','POST',{...example,sourceUrl:'javascript:alert(1)'})).status,400);
  assert.equal((await request('/api/events','POST',{...example,endYear:1})).status,400);
  const id=library.events.find(e=>!e.userCreated).id;assert.equal((await request('/api/events/'+id,'PUT',example)).status,403);assert.equal((await request('/api/events/'+id,'DELETE')).status,403);
  assert.equal((await request('/api/import','POST',{})).status,404);assert.equal((await request('/api/export')).status,404);
  assert.equal((await request('/api/map/tiles/osm/0/0/0.png')).status,404);
  assert.equal((await request('/data/history.json')).status,403);assert.equal((await request('/%2e%2e%5cserver.mjs')).status,403);
  const edit=await request('/api/events/user-legacy','PUT',{...example,title:'修改后的记录'}).then(r=>r.json());assert.equal(edit.event.createdAt,now);assert.equal(edit.event.title,'修改后的记录');
  assert.equal((await request('/api/preferences','PUT',{preferences:{theme:'night',timelineHeight:240,timelineCollapsed:true}})).status,200);
  assert.equal((await request('/api/preferences','PUT',{preferences:{theme:'unknown'}})).status,400);
  for(const route of ['/api/geology/manifest','/api/geology/evolution','/api/geology/66','/api/geology/assets/former-asset'])assert.equal((await request(route)).status,404);
  await running.app.close();running=null;
  const emptyPublic=path.join(dir,'empty-public');await mkdir(emptyPublic);
  // The runtime must work with the history source JSON absent after the first migration.
  running=await host(file,emptyPublic);library=await running.request('/api/library').then(r=>r.json());assert.equal(library.events.find(e=>e.id==='user-legacy').title,'修改后的记录');
  assert.equal((await running.request('/api/preferences').then(r=>r.json())).preferences.theme,'night');
 }finally{await running?.app.close();await clean(dir);}
});
test('whole SQLite database export/import preserves personal changes and rejects tampered canonical content',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let source,target;
 try{
  source=await host(path.join(dir,'source.sqlite'));
  const first=(await source.request('/api/events','POST',example).then(r=>r.json())).event;
  await source.request('/api/preferences','PUT',{preferences:{theme:'paper',explorerWidth:340,timelineHeight:210,timelineCollapsed:true}});
  const exported=await source.request('/api/database/export');assert.equal(exported.status,200);const bytes=Buffer.from(await exported.arrayBuffer());assert.equal(bytes.subarray(0,16).toString('latin1'),'SQLite format 3\0');
  const file=path.join(dir,'backup.sqlite');await writeFile(file,bytes);let backupDB=new DatabaseSync(file);assert.equal(backupDB.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);assert.equal(backupDB.prepare("SELECT count(*) count FROM sqlite_schema WHERE name='science_assets'").get().count,0);backupDB.close();
  target=await host(path.join(dir,'target.sqlite'));const retained=(await target.request('/api/events','POST',{...example,title:'目标机原有记录'}).then(r=>r.json())).event;
  const importDB=b=>target.request('/api/database/import','POST',b,{'Content-Type':'application/octet-stream'});
  const result=await importDB(bytes).then(r=>r.json());assert.equal(result.imported,1);assert.equal((await target.request('/api/library').then(r=>r.json())).events.filter(e=>e.userCreated).length,2);assert.equal((await target.request('/api/preferences').then(r=>r.json())).preferences.timelineHeight,210);
  await target.request('/api/events/'+first.id,'PUT',{...example,title:'目标机较新修改'});const repeat=await importDB(bytes).then(r=>r.json());assert.equal(repeat.skipped,1);
  assert.equal((await target.request('/api/library').then(r=>r.json())).events.find(e=>e.id===first.id).title,'目标机较新修改');
  backupDB=new DatabaseSync(file);backupDB.prepare("UPDATE canonical_records SET payload='{}' WHERE kind='history-event' AND id=(SELECT id FROM canonical_records WHERE kind='history-event' LIMIT 1)").run();backupDB.close();
  assert.equal((await importDB(await readFile(file))).status,400);assert.equal((await importDB(Buffer.from('not a database'))).status,400);
  const library=await target.request('/api/library').then(r=>r.json());assert.ok(library.events.some(e=>e.id===retained.id));assert.equal(library.events.filter(e=>!e.userCreated).length,24);
  assert.equal((await target.request('/api/settings').then(r=>r.json())).contentServer.enabled,false);
 }finally{await source?.app.close();await target?.app.close();await clean(dir);}
});
test('content server is optional, web is read-only even on localhost, port collisions preserve the running listener',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let local,blocker;
 try{
  local=await host(path.join(dir,'local.sqlite'));assert.equal((await local.request('/api/settings').then(r=>r.json())).contentServer.enabled,false);
  const ordinarySession=await fetch(local.base+'/api/session').then(r=>r.json());assert.equal(ordinarySession.interface,'web');assert.equal(ordinarySession.canEdit,false);assert.equal(ordinarySession.token,null);assert.equal(ordinarySession.version,'0.6.0');
  assert.equal((await fetch(local.base+'/api/library')).status,403);assert.equal((await fetch(local.base+'/api/geology/manifest')).status,404);assert.equal((await fetch(local.base+'/api/geology/66')).status,404);
  for(const wrongKey of ['', 'bad', 'f'.repeat(64)]){const session=await fetch(local.base+'/api/session',{headers:{'X-Desktop-Key':wrongKey}}).then(r=>r.json());assert.equal(session.canEdit,false);assert.equal(session.token,null);}
  for(const file of ['/','/app.js','/style.css','/maps/liberty.json']){const response=await fetch(local.base+file);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-earth-chronicle-version'),'0.6.0');await response.arrayBuffer();}
  const health=await fetch(local.base+'/api/health').then(r=>r.json());assert.deepEqual(health,{appId:'earth-chronicle',version:'0.6.0'});
  // Old browser tabs may retain the previous edit token. It must be useless
  // without the native application's key, even from this same computer.
  const adminRoutes=[['/api/settings','GET'],['/api/preferences','GET'],['/api/preferences','PUT','{}'],['/api/database/export','GET'],['/api/database/import','POST','x'],['/api/content-server','PUT','{}'],['/api/events','POST',JSON.stringify(example)],['/api/events/user-fake','PUT',JSON.stringify(example)],['/api/events/user-fake','DELETE'],['/api/shutdown','POST','{}']];
  for(const [route,method,body]of adminRoutes)assert.equal((await fetch(local.base+route,{method,headers:{'X-Edit-Token':local.session.token,'Content-Type':'application/json'},...(body?{body}:{})})).status,403,'ordinary local browser '+route);
  blocker=http.createServer((q,r)=>r.end('reserved'));await new Promise(resolve=>blocker.listen(0,'127.0.0.1',resolve));const occupied=blocker.address().port;
  const allocator=http.createServer();await new Promise(resolve=>allocator.listen(0,'127.0.0.1',resolve));const freePort=allocator.address().port;await new Promise(resolve=>allocator.close(resolve));
  assert.equal((await local.request('/api/content-server','PUT',{enabled:true,port:freePort})).status,200);
  const web='http://127.0.0.1:'+freePort,session=await fetch(web+'/api/session').then(r=>r.json());assert.equal(session.interface,'web');assert.equal(session.canEdit,false);assert.equal(session.token,null);
  assert.deepEqual((await local.request('/api/settings').then(r=>r.json())).contentServer.addresses,[web]);
  // Tests deliberately bind the reader to loopback; no personal data is ever
  // exposed on the machine's LAN interfaces while this suite runs.
  assert.equal(await canConnect('127.0.0.1',freePort),true);
  for(const address of Object.values(networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal))assert.equal(await canConnect(address.address,freePort),false,'content listener must not bind '+address.address);
  assert.equal((await fetch(web+'/api/library')).status,200);assert.equal((await fetch(web+'/api/geology/120')).status,404);
  const redirected=await fetch(local.base+'/',{redirect:'manual'});assert.equal(redirected.status,303);assert.equal(redirected.headers.get('location'),web+'/');assert.equal((await fetch(local.base+'/api/library')).status,200);
  assert.equal((await fetch(web+'/api/session',{headers:{'X-Desktop-Key':local.desktopKey}}).then(r=>r.json())).canEdit,false);
  for(const [route,method,body]of adminRoutes){
   assert.equal((await fetch(web+route,{method,headers:{'X-Desktop-Key':local.desktopKey,'X-Edit-Token':local.session.token,'Content-Type':'application/json'},...(body?{body}:{})})).status,403,route);
  }
  assert.equal((await local.request('/api/content-server','PUT',{enabled:true,port:occupied})).status,409);assert.equal((await fetch(web+'/api/library')).status,200);
  assert.equal((await local.request('/api/settings').then(r=>r.json())).contentServer.port,freePort);
  await local.request('/api/content-server','PUT',{enabled:false,port:freePort});await assert.rejects(fetch(web+'/api/library'));assert.equal((await local.request('/api/library')).status,200);
  assert.equal((await fetch(local.base+'/api/library')).status,403);
 }finally{await local?.app.close();if(blocker?.listening)await new Promise(resolve=>blocker.close(resolve));await clean(dir);}
});
test('desktop keys must be generated 256-bit keys',async()=>{
 for(const desktopKey of ['', 'abc', 'g'.repeat(64), 123])await assert.rejects(createChronicleServer({desktopKey}),/会话密钥无效/);
});
test('content host accepts only the intentional public and loopback bindings',async()=>{
 for(const contentHost of ['', 'localhost', '192.168.1.2', '::', 0])await assert.rejects(createChronicleServer({contentHost}),/监听地址无效/);
});

test('editing imported events keeps timestamps monotonic despite clock skew and same-millisecond edits',async(t)=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let source,target;
 try{
  source=await host(path.join(dir,'source.sqlite'));target=await host(path.join(dir,'target.sqlite'));
  const first=(await source.request('/api/events','POST',example).then(r=>r.json())).event;
  const bytes=Buffer.from(await (await source.request('/api/database/export')).arrayBuffer());
  const file=path.join(dir,'ahead.sqlite');await writeFile(file,bytes);
  const future='2050-01-01T00:00:00.000Z',fixture=new DatabaseSync(file);
  fixture.prepare('UPDATE user_events SET created_at=?,updated_at=? WHERE id=?').run(future,future,first.id);fixture.close();
  assert.equal((await target.request('/api/database/import','POST',await readFile(file),{'Content-Type':'application/octet-stream'})).status,200);
  t.mock.method(Date,'now',()=>Date.parse('2049-12-31T23:59:59.000Z'));
  const one=(await target.request('/api/events/'+first.id,'PUT',{...example,title:'在慢时钟电脑修改'}).then(r=>r.json())).event;
  const two=(await target.request('/api/events/'+first.id,'PUT',{...example,title:'同一毫秒再次修改'}).then(r=>r.json())).event;
  assert.ok(one.updatedAt>future,'a local edit must supersede its imported version');
  assert.ok(two.updatedAt>one.updatedAt,'successive edits need distinct sortable timestamps');
  assert.equal(two.createdAt,future);
  const edited=Buffer.from(await (await target.request('/api/database/export')).arrayBuffer());
  const imported=await source.request('/api/database/import','POST',edited,{'Content-Type':'application/octet-stream'});
  assert.equal(imported.status,200);assert.equal((await imported.json()).updated,1);
  assert.equal((await source.request('/api/library').then(r=>r.json())).events.find(e=>e.id===first.id).title,two.title);
 }finally{t.mock.restoreAll();await source?.app.close();await target?.app.close();await clean(dir);}
});

test('shutdown during content-server startup cannot leave a listener running',async(t)=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let local,closing;
 const listeners=[],originalCreate=http.createServer,originalConnect=net.createConnection;
 t.mock.method(http,'createServer',function(...args){const listener=Reflect.apply(originalCreate,this,args);listeners.push(listener);return listener;});
 try{
  local=await host(path.join(dir,'local.sqlite'));
  const allocator=http.createServer();await new Promise(resolve=>allocator.listen(0,'127.0.0.1',resolve));const freePort=allocator.address().port;await new Promise(resolve=>allocator.close(resolve));
  // Close exactly while the asynchronous port probes are outstanding. This
  // used to let a new reader start after shutdown had captured its listeners.
  t.mock.method(net,'createConnection',function(...args){const socket=Reflect.apply(originalConnect,this,args);if(args[0]?.port===freePort&&!closing)closing=local.app.close();return socket;});
  const response=await local.request('/api/content-server','PUT',{enabled:true,port:freePort});
  assert.ok(closing,'the test reached the startup/shutdown race');
  assert.equal(response.status,503);await response.arrayBuffer();await closing;
  t.mock.restoreAll();
  assert.equal(await canConnect('127.0.0.1',freePort),false,'shutdown must close or cancel every content listener');
 }finally{
  t.mock.restoreAll();await closing;await local?.app.close();
  for(const listener of listeners)if(listener.listening)await new Promise(resolve=>listener.close(resolve));
  await clean(dir);
 }
});

test('invalid preferences return a client error without changing saved values',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let local;
 try{
  local=await host(path.join(dir,'local.sqlite'));
  await local.request('/api/preferences','PUT',{preferences:{theme:'paper'}});
  for(const body of [null,{},[],{preferences:null},{preferences:{theme:'invalid'}}])assert.equal((await local.request('/api/preferences','PUT',body)).status,400);
  assert.equal((await local.request('/api/preferences').then(r=>r.json())).preferences.theme,'paper');
 }finally{await local?.app.close();await clean(dir);}
});

test('oversized chunked JSON returns a useful limit error and leaves the server usable',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let local;
 try{
  local=await host(path.join(dir,'local.sqlite'));
  const response=await new Promise((resolve,reject)=>{
   const request=http.request(local.base+'/api/events',{method:'POST',headers:{'X-Desktop-Key':local.desktopKey,'X-Edit-Token':local.session.token,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>{request.destroy();resolve({status:response.statusCode,body:JSON.parse(Buffer.concat(chunks))});});
   });
   request.on('error',reject);request.setTimeout(5000,()=>request.destroy(new Error('request timed out')));
   for(let index=0;index<17;index++)request.write(Buffer.alloc(64*1024,'x'));
   request.end();
  });
  assert.equal(response.status,413);assert.match(response.body.error,/大小/);
  assert.equal((await local.request('/api/library').then(response=>response.json())).events.filter(event=>event.userCreated).length,0);
  assert.equal((await local.request('/api/events','POST',example)).status,201);
 }finally{await local?.app.close();await clean(dir);}
});

test('turning off the content server closes paused downloads without blocking local settings',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let local,download,deadline;
 try{
  const publicDir=path.join(dir,'public');await mkdir(path.join(publicDir,'data'),{recursive:true});
  await writeFile(path.join(publicDir,'data','history.json'),await readFile(new URL('../public/data/history.json',import.meta.url)));
  await writeFile(path.join(publicDir,'download.bin'),Buffer.alloc(16*1024*1024));
  local=await host(path.join(dir,'local.sqlite'),publicDir);
  const allocator=http.createServer();await new Promise(resolve=>allocator.listen(0,'127.0.0.1',resolve));const port=allocator.address().port;await new Promise(resolve=>allocator.close(resolve));
  assert.equal((await local.request('/api/content-server','PUT',{enabled:true,port})).status,200);
  await new Promise((resolve,reject)=>{download=http.get(`http://127.0.0.1:${port}/download.bin`,response=>{response.pause();resolve();});download.on('error',reject);});
  const response=await Promise.race([
   local.request('/api/content-server','PUT',{enabled:false,port}),
   new Promise((resolve,reject)=>{deadline=setTimeout(()=>reject(new Error('paused reader blocked the content-server setting')),1500);}),
  ]);
  clearTimeout(deadline);assert.equal(response.status,200);assert.equal((await response.json()).contentServer.enabled,false);
  assert.equal(await canConnect('127.0.0.1',port),false);
  assert.equal((await local.request('/api/library')).status,200);
 }finally{clearTimeout(deadline);download?.destroy();await local?.app.close();await clean(dir);}
});

test('invalid database imports are atomic and valid imports never enable network sharing',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'earthchronicle-test-'));let source,target;
 try{
  source=await host(path.join(dir,'source.sqlite'));target=await host(path.join(dir,'target.sqlite'));
  await source.request('/api/events','POST',example);
  await source.request('/api/preferences','PUT',{preferences:{theme:'night'}});
  await target.request('/api/preferences','PUT',{preferences:{theme:'paper'}});
  const file=path.join(dir,'backup.sqlite');await writeFile(file,Buffer.from(await (await source.request('/api/database/export')).arrayBuffer()));
  let fixture=new DatabaseSync(file);const now='2026-01-01T00:00:00.000Z';
  fixture.prepare('INSERT INTO user_events VALUES(?,?,?,?)').run('user-invalid',JSON.stringify({...example,id:'user-invalid',placeId:'unknown-place'}),now,now);
  fixture.prepare("UPDATE settings SET value=? WHERE key='contentServer'").run(JSON.stringify({enabled:true,port:8080}));fixture.close();
  const importFile=()=>readFile(file).then(bytes=>target.request('/api/database/import','POST',bytes,{'Content-Type':'application/octet-stream'}));
  assert.equal((await importFile()).status,400);
  assert.equal((await target.request('/api/library').then(r=>r.json())).events.filter(event=>event.userCreated).length,0);
  assert.equal((await target.request('/api/preferences').then(r=>r.json())).preferences.theme,'paper');
  fixture=new DatabaseSync(file);fixture.prepare('DELETE FROM user_events WHERE id=?').run('user-invalid');fixture.close();
  assert.equal((await importFile()).status,200);
  assert.equal((await target.request('/api/library').then(r=>r.json())).events.filter(event=>event.userCreated).length,1);
  assert.equal((await target.request('/api/settings').then(r=>r.json())).contentServer.enabled,false);
  assert.equal((await target.request('/api/preferences').then(r=>r.json())).preferences.theme,'night');
 }finally{await source?.app.close();await target?.app.close();await clean(dir);}
});
