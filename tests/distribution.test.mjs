import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {buildMapStyle} from '../public/map-style.js';

const root=new URL('../',import.meta.url),publicRoot=new URL('public/',root);
const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
test('release version agrees across the package, native executable and manifest',async()=>{
  const {version}=await readJson(new URL('package.json',root));
  assert.match(version,/^\d+\.\d+\.\d+$/);
  const [native,manifest,server]=await Promise.all(['desktop/EarthChronicle.cs','desktop/app.manifest','server.mjs'].map(file=>readFile(new URL(file,root),'utf8')));
  for(const field of ['AssemblyVersion','AssemblyFileVersion'])assert.equal(native.match(new RegExp(`${field}\\("([^"]+)"\\)`))?.[1],`${version}.0`);
  assert.equal(native.match(/version="([^"]+)"/)?.[1],version,'native state version');
  assert.equal(manifest.match(/assemblyIdentity version="([^"]+)"/)?.[1],`${version}.0`);
  assert.equal(server.match(/VERSION='([^']+)'/)?.[1],version,'HTTP API version');
});
const baseStyle=await readJson(new URL('maps/liberty.json',publicRoot));
const offline=buildMapStyle({online:false,baseStyle});
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
function publicFile(reference,base=new URL('index.html',publicRoot)) {
  const url=reference.startsWith('/')?new URL(`.${reference}`,publicRoot):new URL(reference,base);
  assert.ok(url.href.startsWith(publicRoot.href),`asset must be within public/: ${reference}`);
  return url;
}

function position(coordinates) {
  assert.ok(Array.isArray(coordinates)&&coordinates.length>=2);
  assert.ok(coordinates.every(Number.isFinite));
  assert.ok(Math.abs(coordinates[0])<=180&&Math.abs(coordinates[1])<=90,'invalid map coordinate');
}
function line(coordinates,ring=false) {
  assert.ok(Array.isArray(coordinates)&&coordinates.length>=(ring?4:2));
  coordinates.forEach(position);
  if(ring){assert.deepEqual(coordinates[0],coordinates.at(-1),'polygon ring must close');assert.ok(new Set(coordinates.map(point=>JSON.stringify(point))).size>=3,'degenerate polygon ring');}
}
function geometry(value) {
  assert.ok(value&&typeof value==='object');
  const coordinates=value.coordinates;
  switch(value.type){
    case 'Point':position(coordinates);break;
    case 'MultiPoint':assert.ok(coordinates.length);coordinates.forEach(position);break;
    case 'LineString':line(coordinates);break;
    case 'MultiLineString':assert.ok(coordinates.length);coordinates.forEach(item=>line(item));break;
    case 'Polygon':assert.ok(coordinates.length);coordinates.forEach(item=>line(item,true));break;
    case 'MultiPolygon':assert.ok(coordinates.length);coordinates.forEach(item=>geometry({type:'Polygon',coordinates:item}));break;
    case 'GeometryCollection':assert.ok(value.geometries.length);value.geometries.forEach(geometry);break;
    default:assert.fail(`unsupported GeoJSON geometry: ${value.type}`);
  }
}
function crc32(bytes) {
  let result=0xffffffff;
  for(const byte of bytes){result^=byte;for(let bit=0;bit<8;bit++)result=(result>>>1)^((result&1)?0xedb88320:0);}
  return (result^0xffffffff)>>>0;
}
function png(bytes,label) {
  assert.ok(bytes.subarray(0,8).equals(pngSignature),`${label}: invalid PNG signature`);
  let offset=8,header,ended=false;const compressed=[];
  while(offset<bytes.length){
    assert.ok(offset+12<=bytes.length,`${label}: truncated PNG chunk`);
    const length=bytes.readUInt32BE(offset),end=offset+12+length;
    assert.ok(end<=bytes.length,`${label}: truncated PNG data`);
    const kind=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,end-4);
    assert.equal(crc32(bytes.subarray(offset+4,end-4)),bytes.readUInt32BE(end-4),`${label}: ${kind} checksum`);
    if(!header){assert.equal(kind,'IHDR');assert.equal(length,13);header=data;}
    else assert.notEqual(kind,'IHDR',`${label}: duplicate PNG header`);
    if(kind==='IDAT')compressed.push(data);
    if(kind==='IEND'){assert.equal(length,0);assert.equal(end,bytes.length);ended=true;}
    offset=end;
  }
  assert.ok(header&&ended&&compressed.length,`${label}: incomplete PNG`);
  const width=header.readUInt32BE(0),height=header.readUInt32BE(4),depth=header[8],color=header[9],channels={0:1,2:3,3:1,4:2,6:4}[color];
  assert.ok(width>0&&height>0&&width<=16384&&height<=16384,`${label}: invalid PNG dimensions`);
  assert.ok(({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]})[color]?.includes(depth));
  assert.equal(header[10],0);assert.equal(header[11],0);assert.ok([0,1].includes(header[12]));
  const passes=header[12]?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
  const rows=[];
  for(const [x,y,dx,dy] of passes){const columns=Math.max(0,Math.ceil((width-x)/dx)),count=Math.max(0,Math.ceil((height-y)/dy));if(columns&&count)for(let row=0;row<count;row++)rows.push(Math.ceil(columns*channels*depth/8)+1);}
  const expected=rows.reduce((sum,size)=>sum+size,0);assert.ok(expected<=64*1024*1024);
  const pixels=inflateSync(Buffer.concat(compressed),{maxOutputLength:expected+1});assert.equal(pixels.length,expected,`${label}: incomplete image pixels`);
  let rowOffset=0;for(const size of rows){assert.ok(pixels[rowOffset]<=4,`${label}: invalid PNG filter`);rowOffset+=size;}
  return {width,height};
}
async function icon(file) {
  const bytes=await readFile(file);assert.ok(bytes.length>=6);assert.equal(bytes.readUInt16LE(0),0);assert.equal(bytes.readUInt16LE(2),1);
  const count=bytes.readUInt16LE(4),directoryEnd=6+16*count;assert.ok(count>0&&directoryEnd<=bytes.length);
  const sizes=[],ranges=[];
  for(let index=0;index<count;index++){
    const entry=6+16*index,width=bytes[entry]||256,height=bytes[entry+1]||256,length=bytes.readUInt32LE(entry+8),offset=bytes.readUInt32LE(entry+12);
    assert.ok(length>0&&offset>=directoryEnd&&offset+length<=bytes.length,`${file.pathname}: broken ICO image offset`);
    assert.ok(ranges.every(([start,end])=>offset+length<=start||offset>=end),`${file.pathname}: overlapping ICO frames`);ranges.push([offset,offset+length]);
    const image=bytes.subarray(offset,offset+length);
    if(image.subarray(0,8).equals(pngSignature))assert.deepEqual(png(image,file.pathname),{width,height});
    else {assert.ok(image.length>=40&&image.readUInt32LE(0)>=40);assert.equal(image.readInt32LE(4),width);assert.equal(image.readInt32LE(8),height*2);assert.ok([1,4,8,24,32].includes(image.readUInt16LE(14)));}
    sizes.push(width);assert.equal(width,height);
  }
  return sizes;
}

test('offline map source files are complete GeoJSON with valid closed land and boundary geometry',async()=>{
  for(const id of ['base-land','base-countries','base-countries-labels','base-cities']){
    const source=offline.sources[id];assert.equal(source?.type,'geojson',id);
    const data=await readJson(publicFile(source.data));assert.equal(data.type,'FeatureCollection');assert.ok(data.features.length,`${id}: empty map`);
    for(const feature of data.features){assert.equal(feature.type,'Feature');geometry(feature.geometry);}
  }
});

test('bundled map glyph ranges are complete and match their published byte counts and checksums',async()=>{
  const directory=new URL('maps/fonts/noto-sans/',publicRoot);
  const manifest=await readJson(new URL('manifest.json',directory));
  assert.equal(manifest.font,'Noto Sans Regular');
  assert.equal(manifest.license,'OFL-1.1');
  assert.ok(new URL(manifest.source).protocol==='https:','font provenance must name its original source');
  const expected=Array.from({length:256},(_,index)=>`${index*256}-${index*256+255}.pbf`).sort();
  const listed=manifest.files.map(item=>item.file).sort();
  assert.deepEqual(listed,expected,'all basic multilingual plane ranges must ship with the application');
  assert.deepEqual((await readdir(directory)).filter(file=>file.endsWith('.pbf')).sort(),listed,'manifest and distributed glyph files must agree');
  let totalBytes=0,totalGlyphs=0;
  for(const entry of manifest.files){
    assert.match(entry.sha256,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(entry.bytes)&&entry.bytes>0,`${entry.file}: invalid byte count`);
    assert.ok(Number.isInteger(entry.glyphCount)&&entry.glyphCount>=0&&entry.glyphCount<=256,`${entry.file}: invalid glyph count`);
    const bytes=await readFile(new URL(entry.file,directory));
    assert.equal(bytes.length,entry.bytes,`${entry.file}: incomplete glyph file`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`${entry.file}: glyph file checksum mismatch`);
    totalBytes+=bytes.length;totalGlyphs+=entry.glyphCount;
  }
  assert.equal(totalBytes,manifest.bytes);
  assert.equal(totalGlyphs,manifest.glyphCount);
});

const spritePath=new URL(offline.sprite).pathname;
async function atlas(ratio) {
  const prefix=`${spritePath}${ratio===2?'@2x':''}`;
  const [entries,bytes]=await Promise.all([readJson(publicFile(`${prefix}.json`)),readFile(publicFile(`${prefix}.png`))]);
  const dimensions=png(bytes,`${prefix}.png`);assert.ok(Object.keys(entries).length,'empty sprite atlas');
  for(const [name,entry] of Object.entries(entries)){
    for(const key of ['x','y','width','height'])assert.ok(Number.isInteger(entry[key])&&entry[key]>=(key==='x'||key==='y'?0:1),`${prefix}: invalid ${name}.${key}`);
    assert.equal(entry.pixelRatio,ratio,`${prefix}: ${name} pixel ratio`);
    assert.ok(entry.x+entry.width<=dimensions.width&&entry.y+entry.height<=dimensions.height,`${prefix}: ${name} is outside the PNG`);
  }
  return entries;
}
const atlases=await Promise.all([atlas(1),atlas(2)]);
test('both sprite resolutions contain complete images with matching logical icon dimensions',()=>{
  const [normal,retina]=atlases;assert.deepEqual(Object.keys(normal).sort(),Object.keys(retina).sort());
  // Odd pixel dimensions may round by half a logical pixel when rasterized.
  for(const [name,entry] of Object.entries(normal))for(const key of ['width','height'])assert.ok(Math.abs(retina[name][key]-entry[key]*2)<=1,`${name}: inconsistent ${key} across resolutions`);
});

// Evaluate only the expression operators used for image selection. Representative
// map feature properties catch missing dynamically selected icons as well as literals.
function evaluate(expression,properties,zoom=0) {
  if(!Array.isArray(expression))return expression;
  const [operator,...args]=expression,ev=value=>evaluate(value,properties,zoom);
  switch(operator){
    case 'get':return properties[args[0]];
    case 'has':return Object.hasOwn(properties,args[0]);
    case 'zoom':return zoom;
    case 'geometry-type':return properties.geometryType;
    case 'literal':return args[0];
    case 'to-string':return String(ev(args[0])??'');
    case 'concat':return args.map(ev).join('');
    case 'coalesce':return args.map(ev).find(value=>value!=null);
    case 'match':{const value=ev(args[0]);for(let i=1;i<args.length-1;i+=2)if((Array.isArray(args[i])?args[i]:[args[i]]).includes(value))return ev(args[i+1]);return ev(args.at(-1));}
    case 'case':for(let i=0;i<args.length-1;i+=2)if(ev(args[i]))return ev(args[i+1]);return ev(args.at(-1));
    case 'step':{const value=ev(args[0]);let result=ev(args[1]);for(let i=2;i<args.length;i+=2)if(value>=args[i])result=ev(args[i+1]);return result;}
    case '==':return ev(args[0])===ev(args[1]);
    case '!=':return ev(args[0])!==ev(args[1]);
    case '<':return ev(args[0])<ev(args[1]);
    case '<=':return ev(args[0])<=ev(args[1]);
    case '>':return ev(args[0])>ev(args[1]);
    case '>=':return ev(args[0])>=ev(args[1]);
    case 'all':return args.every(ev);
    case 'any':return args.some(ev);
    case 'min':return Math.min(...args.map(ev));
    case 'max':return Math.max(...args.map(ev));
    default:assert.fail(`add image-expression coverage for ${operator}`);
  }
}
test('rendered styles use available icons for places, transit, road shields and area patterns',()=>{
  const cases=[];
  for(const kind of ['airport','bus','rail','cafe','hospital','museum','school','park','florist','furniture'])for(const rank of [1,10,25])cases.push({class:kind,subclass:kind,rank,geometryType:'Point',...(kind==='airport'?{iata:'TEST'}:{})});
  for(const kind of ['city','town','village'])for(const capital of [0,2])cases.push({class:kind,capital,geometryType:'Point'});
  for(const network of ['ordinary-road','us-highway','us-interstate','us-state'])for(let length=1;length<=6;length++)cases.push({network,ref_length:length,class:'primary',oneway:1,geometryType:'LineString'});
  cases.push({class:'wetland',geometryType:'Polygon'},{class:'pedestrian',geometryType:'Polygon'},{oneway:-1,geometryType:'LineString'});
  const images=new Set();
  for(const theme of ['light','paper','night'])for(const layer of buildMapStyle({theme,online:true,baseStyle}).layers){
    for(const [key,value] of Object.entries({...layer.layout,...layer.paint}))if(['icon-image','fill-pattern','line-pattern','background-pattern'].includes(key)){
      if(typeof value==='string'&&value)images.add(value);
      for(const properties of cases)for(const zoom of [0,8,12,20])if(zoom>=(layer.minzoom??0)&&zoom<(layer.maxzoom??25)&&(!layer.filter||evaluate(layer.filter,properties,zoom))){const name=evaluate(value,properties,zoom);if(name)images.add(name);}
    }
  }
  for(const name of images)for(const entries of atlases)assert.ok(Object.hasOwn(entries,name),`rendered style references missing icon: ${name}`);
});

test('HTML assets and local module imports resolve from source before dependency preparation',async()=>{
  const html=await readFile(new URL('index.html',publicRoot),'utf8'),packageInfo=await readJson(new URL('package.json',root));
  const prepared=new Set(['vendor/maplibre/maplibre-gl.css','vendor/maplibre/maplibre-gl.mjs','vendor/maplibre/maplibre-gl-shared.mjs','vendor/maplibre/maplibre-gl-worker.mjs']);
  const visited=new Set();let icons=0,styles=0,modules=0;
  async function check(file,module=false){
    const relative=file.href.slice(publicRoot.href.length);
    if(prepared.has(relative)){assert.ok(packageInfo.dependencies['maplibre-gl'],'prepared browser assets need a declared dependency');return;}
    const bytes=await readFile(file);assert.ok(bytes.length,`empty asset: ${relative}`);
    if(!module||visited.has(file.href))return;visited.add(file.href);
    const source=bytes.toString('utf8'),imports=[...source.matchAll(/^\s*(?:import\s+(?:[^'"\n]*?\sfrom\s*)?|export\s+[^'"\n]*?\sfrom\s*)['"]([^'"]+)['"]/gm),...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)];
    for(const match of imports)await check(publicFile(match[1],file),true);
  }
  for(const tag of html.matchAll(/<(?:link|script)\b[^>]*>/g)){
    const attributes=Object.fromEntries([...tag[0].matchAll(/([\w-]+)\s*=\s*['"]([^'"]*)['"]/g)].map(match=>[match[1],match[2]]));
    const reference=attributes.href||attributes.src;if(!reference)continue;
    const file=publicFile(reference);await check(file,attributes.type==='module');
    if(attributes.rel==='icon'){icons++;if(file.pathname.endsWith('.ico'))assert.ok((await icon(file)).includes(16));else{const dimensions=png(await readFile(file),reference);if(attributes.sizes&&attributes.sizes!=='any')assert.equal(attributes.sizes,`${dimensions.width}x${dimensions.height}`);}}
    if(attributes.rel==='stylesheet')styles++;
    if(attributes.type==='module')modules++;
  }
  assert.ok(icons&&styles&&modules,'missing page icon, stylesheet or module entry');
  const nativeSizes=await icon(new URL('desktop/assets/EarthChronicle.ico',root));
  assert.ok(nativeSizes.includes(16)&&nativeSizes.includes(256),'desktop icon needs tray and high-DPI frames');
});

test('redistributed map, desktop and runtime assets include their required license files',async()=>{
  const licenses=['LICENSE','runtime/LICENSE.txt','licenses/WebView2/LICENSE.txt','licenses/WebView2/NOTICE.txt','licenses/maps/OpenFreeMap-LICENSE.md','licenses/maps/OSM-Liberty-LICENSE.md','licenses/maps/Maki-LICENSE.txt','licenses/maps/Noto-OFL.txt','licenses/maps/NotoCJK-OFL.txt'];
  for(const file of licenses){const text=await readFile(new URL(file,root),'utf8');assert.ok(text.trim().length>100,`${file}: missing or truncated license`);}
  const notices=await readFile(new URL('THIRD-PARTY-NOTICES.md',root),'utf8');
  for(const match of notices.matchAll(/\]\(((?:licenses|runtime)\/[^)]+)\)/g))assert.ok((await readFile(new URL(match[1],root))).length,`broken local license reference: ${match[1]}`);
});
