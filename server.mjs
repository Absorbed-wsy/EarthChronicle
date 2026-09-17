import http from 'node:http';
import net from 'node:net';
import {createReadStream,createWriteStream} from 'node:fs';
import {realpath,stat,mkdtemp,rm} from 'node:fs/promises';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces,tmpdir} from 'node:os';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {openChronicleDatabase,RequestError,MAX_DATABASE_BYTES} from './database.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),VERSION='0.6.0';
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.bin':'application/octet-stream','.ktx2':'image/ktx2','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const loopback=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address);
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function readBody(req,limit){if(Number(req.headers['content-length']||0)>limit){req.resume();throw new RequestError(413,'文件超过允许的大小。');}const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new RequestError(413,'文件超过允许的大小。');chunks.push(chunk);}return Buffer.concat(chunks);}
async function readJson(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new RequestError(415,'请使用 JSON 格式提交。');const bytes=await readBody(req,1024*1024);try{return JSON.parse(bytes.toString('utf8'));}catch{throw new RequestError(400,'JSON 格式有误。');}}
async function listenOn(server,port,host){await new Promise((resolve,reject)=>{const fail=error=>reject(error);server.once('error',fail);server.listen(port,host,()=>{server.off('error',fail);resolve();});});return server.address().port;}
async function closeListener(server,disconnectReaders=false){if(!server?.listening)return;await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();if(disconnectReaders)server.closeAllConnections();});}
async function portResponds(port,host){return new Promise(resolve=>{const socket=net.createConnection({port,host});let finished=false;const done=value=>{if(finished)return;finished=true;socket.destroy();resolve(value);};socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(350,()=>done(false));});}
export async function createChronicleServer(options={}){
 const contentHost=options.contentHost??'0.0.0.0';
 if(!['0.0.0.0','127.0.0.1'].includes(contentHost))throw new TypeError('内容服务器监听地址无效。');
 const suppliedKey=options.desktopKey??process.env.EARTH_CHRONICLE_DESKTOP_KEY;
 if(suppliedKey!==undefined&&(typeof suppliedKey!=='string'||!/^[a-f0-9]{64}$/i.test(suppliedKey)))throw new TypeError('本地软件会话密钥无效。');
 const desktopKey=Buffer.from(suppliedKey??randomBytes(32).toString('hex'),'hex');
 // A loopback address identifies this computer, not the native application.
 // Only the native host possesses this process-lifetime key; browsers never receive it.
 const isDesktop=(req,isWeb)=>{const header=req.headers['x-desktop-key'];return !isWeb&&loopback(req.socket.remoteAddress)&&typeof header==='string'&&/^[a-f0-9]{64}$/i.test(header)&&timingSafeEqual(Buffer.from(header,'hex'),desktopKey);};
 const publicDir=path.resolve(options.publicDir||path.join(ROOT,'public'));
 const databasePath=options.databasePath||process.env.EARTH_CHRONICLE_DB||path.join(ROOT,'data','chronicle.sqlite');
 const publicRealPath=await realpath(publicDir),database=await openChronicleDatabase({databasePath,publicDir}),editToken=randomBytes(32).toString('hex');
 const localAddresses=()=>Object.values(networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal).map(a=>a.address);
 const allowedHost=hostname=>['localhost','127.0.0.1','[::1]',...localAddresses()].includes(hostname);
 let webServer=null,closing=null,contentChanging=false,contentError='',contentPort=database.contentConfig().port;
 const contentStatus=()=>({enabled:!!webServer?.listening,port:contentPort,addresses:webServer?.listening?[`http://127.0.0.1:${contentPort}`,...(contentHost==='0.0.0.0'?localAddresses().map(a=>`http://${a}:${contentPort}`):[])]:[],error:contentError});
 const authorize=(req,isWeb)=>{if(!isDesktop(req,isWeb))throw new RequestError(403,'此功能仅在本地软件中提供，网页端为只读。');if(req.headers['x-edit-token']!==editToken)throw new RequestError(403,'管理会话已失效，请刷新本地界面。');if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw new RequestError(403,'不允许跨站操作。');if(req.headers['sec-fetch-site']==='cross-site')throw new RequestError(403,'不允许跨站操作。');};
 const authorizeRead=(req,isWeb)=>{if(!isWeb&&!isDesktop(req,isWeb)&&!webServer?.listening)throw new RequestError(403,'请在本地软件中开启内容服务器，并使用其访问地址。');};
 async function changeContent(config){
  if(closing)throw new RequestError(503,'软件正在关闭，不能再开启内容服务器。');
  if(contentChanging)throw new RequestError(409,'内容服务器正在调整，请稍后重试。');
  if(!config||typeof config.enabled!=='boolean'||!Number.isInteger(config.port)||config.port<1024||config.port>65535)throw new RequestError(400,'网页访问端口必须是 1024 至 65535 的整数。');
  if(config.port===server.address()?.port)throw new RequestError(409,'该端口正由本地管理窗口使用，请选择另一个端口。');
  contentChanging=true;
  try{
   if(config.enabled&&(!webServer?.listening||config.port!==contentPort)){
    // Windows can accept a wildcard bind beside a listener on a specific address.
    // Probe this machine's addresses first so an occupied port is never presented as usable.
    const occupied=(await Promise.all(['127.0.0.1','::1',...localAddresses()].map(host=>portResponds(config.port,host)))).some(Boolean);
    if(closing)throw new RequestError(503,'软件正在关闭，不能再开启内容服务器。');
    if(occupied)throw new RequestError(409,'这个端口已被占用，原来的内容服务器保持不变。');
    const candidate=createListener(true);try{await listenOn(candidate,config.port,contentHost);}catch(error){candidate.close();throw new RequestError(409,error.code==='EADDRINUSE'?'这个端口已被占用，原来的内容服务器保持不变。':'无法开启这个端口，原来的内容服务器保持不变。');}
    if(closing){await closeListener(candidate,true);throw new RequestError(503,'软件正在关闭，不能再开启内容服务器。');}
    // Reader connections carry no edits. Disconnect unfinished downloads when
    // stopping/replacing this listener so a paused tab cannot block settings.
    const previous=webServer;webServer=candidate;contentPort=config.port;await closeListener(previous,true);
   }else if(!config.enabled){const previous=webServer;webServer=null;await closeListener(previous,true);contentPort=config.port;}
   contentError='';database.saveContentConfig({enabled:config.enabled,port:config.port});return contentStatus();
  }finally{contentChanging=false;}
 }
 function createListener(isWeb){
  const listener=http.createServer(async(req,res)=>{
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Content-Security-Policy',"frame-ancestors 'self'");res.setHeader('X-Earth-Chronicle-Version',VERSION);
   try{
    let url;try{url=new URL(req.url,`http://${req.headers.host}`);}catch{throw new RequestError(400,'请求地址无效。');}
    if(!allowedHost(url.hostname))throw new RequestError(403,'请使用本地或内容服务器提供的地址。');const route=url.pathname;
    if(route==='/api/health'&&req.method==='GET')return json(res,200,{appId:'earth-chronicle',version:VERSION});
    if(route==='/api/session'&&req.method==='GET'){const desktop=isDesktop(req,isWeb);return json(res,200,{appId:'earth-chronicle',version:VERSION,interface:desktop?'local':'web',canEdit:desktop,token:desktop?editToken:null,port:listener.address().port});}
    if(route==='/api/library'&&req.method==='GET'){authorizeRead(req,isWeb);const library=database.library();return json(res,200,{...library,meta:{...library.meta,version:VERSION,userEventCount:database.counts().personalEvents}});}
    if(route==='/api/settings'&&req.method==='GET'){authorize(req,isWeb);return json(res,200,{contentServer:contentStatus(),database:database.counts()});}
    if(route==='/api/preferences'&&req.method==='GET'){authorize(req,isWeb);return json(res,200,{preferences:database.preferences()});}
    if(route==='/api/preferences'&&req.method==='PUT'){authorize(req,isWeb);const body=await readJson(req);return json(res,200,{preferences:database.savePreferences(body?.preferences)});}
    if(route==='/api/content-server'&&req.method==='PUT'){authorize(req,isWeb);return json(res,200,{contentServer:await changeContent(await readJson(req))});}
    if(route==='/api/events'&&req.method==='POST'){authorize(req,isWeb);return json(res,201,{event:database.saveEvent(await readJson(req))});}
    if(route.startsWith('/api/events/')&&['PUT','DELETE'].includes(req.method)){authorize(req,isWeb);let id;try{id=decodeURIComponent(route.slice('/api/events/'.length));}catch{throw new RequestError(400,'事件标识无效。');}if(req.method==='PUT')return json(res,200,{event:database.saveEvent(await readJson(req),id)});database.deleteEvent(id);return json(res,200,{ok:true});}
    if(route==='/api/database/export'&&req.method==='GET'){
     authorize(req,isWeb);const output=await database.exportDatabase();
     try{res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Disposition':'attachment; filename="earthchronicle.sqlite"','Cache-Control':'no-store','Content-Length':output.size});await pipeline(createReadStream(output.file),res);}
     finally{await output.cleanup();}return;
    }
    if(route==='/api/database/import'&&req.method==='POST'){
     authorize(req,isWeb);if(!String(req.headers['content-type']||'').startsWith('application/octet-stream'))throw new RequestError(415,'请上传数据库文件。');
     if(Number(req.headers['content-length']||0)>MAX_DATABASE_BYTES){req.resume();throw new RequestError(413,'数据库不能超过 2 GB。');}
     const directory=await mkdtemp(path.join(tmpdir(),'earthchronicle-http-import-')),file=path.join(directory,'import.sqlite');
     let size=0;
     try{
      const limit=new Transform({transform(chunk,encoding,callback){size+=chunk.length;callback(size>MAX_DATABASE_BYTES?new RequestError(413,'数据库不能超过 2 GB。'):null,chunk);}});
      await pipeline(req,limit,createWriteStream(file,{flags:'wx'}));
      return json(res,200,await database.importDatabaseFile(file));
     }finally{await rm(directory,{recursive:true,force:true});}
    }
    if(route==='/api/shutdown'&&req.method==='POST'){authorize(req,isWeb);json(res,200,{ok:true});setImmediate(()=>close());return;}
    if(route.startsWith('/api/'))throw new RequestError(404,'接口不存在。');
    if(!['GET','HEAD'].includes(req.method))throw new RequestError(405,'不支持此请求方式。');
    if(!isWeb&&!isDesktop(req,isWeb)&&webServer?.listening&&['/','/index.html'].includes(route)){res.writeHead(303,{'Location':`http://127.0.0.1:${contentPort}/`,'Cache-Control':'no-store'});return res.end();}
    let decoded;try{decoded=decodeURIComponent(req.url.split('?')[0]);}catch{throw new RequestError(400,'请求地址无效。');}
    if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(part=>part.startsWith('.'))||decoded.toLowerCase()==='/data'||decoded.toLowerCase().startsWith('/data/'))throw new RequestError(403,'此路径不提供文件访问。');
    const target=path.resolve(publicDir,decoded==='/'?'index.html':`.${decoded}`),relative=path.relative(publicDir,target);if(relative.startsWith('..')||path.isAbsolute(relative))throw new RequestError(403,'不允许访问此路径。');
    let fileStat;try{const realTarget=await realpath(target),realRelative=path.relative(publicRealPath,realTarget);if(realRelative.startsWith('..')||path.isAbsolute(realRelative))throw new RequestError(403,'不允许访问此路径。');fileStat=await stat(target);if(!fileStat.isFile())throw new RequestError(404,'文件不存在。');}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))throw new RequestError(404,'文件不存在。');throw error;}
    const extension=path.extname(target).toLowerCase();res.writeHead(200,{'Content-Type':MIME[extension]||'application/octet-stream','Content-Length':fileStat.size,'Cache-Control':['.html','.js','.mjs','.json','.css'].includes(extension)?'no-store':'public, max-age=86400'});if(req.method==='HEAD')return res.end();await pipeline(createReadStream(target),res);
   }catch(error){if(res.destroyed)return;if(res.headersSent)return res.destroy();if(!(error instanceof RequestError))console.error('[EarthChronicle]',error.message);json(res,error instanceof RequestError?error.status:500,{error:error instanceof RequestError?error.message:'读取或保存时发生错误，请检查磁盘空间及文件权限。'});}
  });listener.requestTimeout=60000;listener.headersTimeout=10000;return listener;
 }
 const server=createListener(false);
 async function close(){if(closing)return closing;closing=(async()=>{await Promise.all([closeListener(server),closeListener(webServer,true)]);database.close();})();return closing;}
 async function listen(port=8765){const actualPort=await listenOn(server,port,'127.0.0.1'),saved=database.contentConfig();if(saved.enabled){try{await changeContent(saved);}catch(error){contentError=error.message;database.saveContentConfig({enabled:false,port:contentPort});}}return actualPort;}
 return{server,listen,close};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),index=args.indexOf('--port'),port=Number(index>=0?args[index+1]:process.env.PORT||8765);
 if(!Number.isInteger(port)||port<1||port>65535){console.error('本地端口必须是 1 至 65535 的整数。');process.exitCode=1;}
 else{let app;try{app=await createChronicleServer({contentHost:args.includes('--content-local-only')?'127.0.0.1':'0.0.0.0'});await app.listen(port);console.log(`地球史书 v${VERSION} 本地管理：http://127.0.0.1:${port}`);console.log('网页内容服务器请在本地窗口设置中开启。');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
  // Keep the content server alive while the native host is in the tray, but do
  // not leave an orphan server if Windows terminates the native process.
  const parentPID=Number(process.env.EARTH_CHRONICLE_PARENT_PID);
  if(Number.isSafeInteger(parentPID)&&parentPID>1){let ending=false;const monitor=setInterval(()=>{try{process.kill(parentPID,0);}catch(error){if(error.code==='ESRCH'&&!ending){ending=true;clearInterval(monitor);app.close().finally(()=>process.exit(0));}}},2000);monitor.unref();}
 }catch(error){await app?.close();console.error(error.code==='EADDRINUSE'?`本地端口 ${port} 已被占用。`:error.message);process.exitCode=1;}}
}
