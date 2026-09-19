import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {eventMatchesPeriod} from '../public/history-navigation.js';

const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const prc=data.events.filter(event=>event.id.startsWith('prc-'));
test('modern historical records have unique identities, valid dates, locations and traceable sources',()=>{
  assert.ok(prc.length>=250,'the modern corpus should retain broad coverage');
  const places=new Map(data.places.map(place=>[place.id,place]));assert.equal(places.size,data.places.length);
  assert.equal(new Set(data.events.map(event=>event.id)).size,data.events.length);
  const cutoff=data.meta.reviewedThrough;assert.match(cutoff,/^\d{4}-\d{2}-\d{2}$/);
  for(const place of data.places){
    assert.ok(place.name&&Number.isFinite(place.lon)&&Number.isFinite(place.lat),place.id);
    assert.ok(Math.abs(place.lon)<=180&&Math.abs(place.lat)<=90,place.id);assert.match(place.countryCode,/^[A-Z]{2}$/);
  }
  const sources=new Set();
  for(const event of prc){
    assert.ok(event.title&&event.summary.length>=30,event.id);assert.ok(places.has(event.placeId),event.id);
    assert.ok(CATEGORIES.includes(event.category),event.id);assert.ok(event.locationNote,event.id);
    assert.ok(Number.isInteger(event.year)&&event.year>=1949&&event.year<=Number(cutoff.slice(0,4)),event.id);
    if(event.endYear!=null)assert.ok(Number.isInteger(event.endYear)&&event.endYear>=event.year&&event.endYear<=Number(cutoff.slice(0,4)),event.id);
    if(event.date){
      assert.match(event.date,/^\d{4}-\d{2}(?:-\d{2})?$/,event.id);assert.equal(Number(event.date.slice(0,4)),event.year,event.id);assert.ok(event.date<=cutoff,event.id);
      const full=event.date.length===7?`${event.date}-01`:event.date;
      assert.equal(new Date(full).toISOString().slice(0,10),full,event.id);assert.equal(event.precision,event.date.length===7?'month':'day',event.id);
    }else assert.equal(event.precision,'year',event.id);
    for(const source of [{title:event.sourceTitle,url:event.sourceUrl},...(event.sources||[])]){
      assert.ok(source.title,event.id);const url=new URL(source.url);assert.ok(['https:','http:'].includes(url.protocol),event.id);assert.ok(!url.username&&!url.password,event.id);sources.add(url.href);
    }
  }
  assert.ok(sources.size>=60,'the corpus needs independent event-specific source pages');
  for(const category of ['政治','军事','外交','经济','社会','科技','文化','灾害'])assert.ok(prc.some(event=>event.category===category),category);
  const latest=Math.max(...prc.map(event=>event.year));
  for(let year=1949;year<=latest;year++)assert.ok(prc.some(event=>event.year===year),`missing year ${year}`);
});
test('published catalogue hashes cover the complete shipped corpus and recognize previous databases',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
  const rows=[['history-meta','main',data.meta],...data.places.map(p=>['place',p.id,p]),...data.events.map(e=>['history-event',e.id,e])].map(([kind,id,payload])=>({kind,id,payload:JSON.stringify(payload)})).sort((a,b)=>a.kind<b.kind?-1:a.kind>b.kind?1:a.id<b.id?-1:a.id>b.id?1:0);
  assert.equal(catalog.sha256,createHash('sha256').update(JSON.stringify(rows)).digest('hex'));
  assert.ok(catalog.previous.includes('c4209070175244df19fb34167b9085b90c2b69ce2f15da72c15328a2dee0910c'));
  assert.ok(catalog.previous.includes('14b1b717d6bf01848d063df5f5409f170a3a8c73ca7bcadc1dd75af9622dcd10'));
  assert.ok(catalog.previous.includes('21b7d69fb23e82742dac95d9ae2aa5794df951a70fe78b0f31e3942e9072181a'));
  assert.ok(catalog.previous.includes('1ccd9f27e3bdc0ec9495299d97ebbd89862041c026dcf30c77419bd92ee3602c'));
  assert.ok(catalog.previous.includes('664df38f32679d800e608a0ca48f9a4afb876525c9c2e9acc37b45cb8a42bafc'));
  assert.ok(catalog.previous.includes('d2913cd04254221347954a7c79cfad5af95c728acc5784df2882b32a1029b056'));
  assert.ok(catalog.previous.includes('ef969fc86106235dc6dc377c57159dea05cfbfe61ca161f43e937a914ce488c7'));
  assert.ok(catalog.previous.includes('b8452c6a1ab7735974ebc934e87151f5827f75107f1c1242659e65f7bf48f4b0'));
  assert.ok(catalog.previous.includes('60ec7007097c44d8831175bf067ad385341f917f5d373ff5e14419e6db790003'));
  assert.ok(catalog.previous.includes('3d6fb5033b3391733c81aa79e44b852f93a0b62237f73c399bf7d2f42485b2f3'));
  assert.ok(catalog.previous.includes('5c1654f9511519a4da2f13b92c4af0f51af5aa84dfe0b5d61e7bb86f2198a7d7'));
});

test('period collection counts and boundary labels agree with the exact-date navigation',()=>{
  for(const collection of data.meta.collections){
    const records=data.events.filter(event=>eventMatchesPeriod(event,collection.id));
    assert.equal(records.length,collection.events,collection.id);
  }
  for(const event of data.events.filter(event=>event.year===1949)){
    assert.equal(event.era,event.date<'1949-10-01'?'中华民国':'中华人民共和国',event.id);
  }
});

test('county records have coherent geographic metadata and remain discoverable by their parent city',()=>{
  const places=new Map(data.places.map(place=>[place.id,place]));
  const countyPlaces=data.places.filter(place=>['county','site'].includes(place.adminLevel));
  const countyEvents=data.events.filter(event=>['county','site'].includes(places.get(event.placeId)?.adminLevel));
  assert.ok(countyPlaces.length>0);assert.ok(countyEvents.length>0);
  assert.equal(data.meta.countyCoverage.places,countyPlaces.length);
  assert.equal(data.meta.countyCoverage.events,countyEvents.length);
  assert.equal(data.meta.countyCoverage.placesWithMultipleEvents,countyPlaces.filter(place=>countyEvents.filter(event=>event.placeId===place.id).length>=2).length);
  for(const place of countyPlaces){
    assert.equal(place.countryCode,'CN',place.id);assert.match(place.regionCode,/^CN-(?:\d{2}|HK|MO)$/,place.id);
    assert.ok(typeof place.parentCity==='string'&&place.parentCity.trim(),place.id);
    assert.ok(place.description,place.id);
  }
  for(const event of countyEvents){
    const place=places.get(event.placeId);
    assert.equal(eventMatches(event,{year:event.year,scope:'year',countryCode:'CN',region:place.regionCode,city:place.id,query:place.parentCity},places),true,event.id);
    assert.equal(eventMatches(event,{year:(event.endYear??event.year)+1,scope:'year',countryCode:'CN',query:place.parentCity},places),false,event.id);
  }
});

test('local history includes distinct periods at the same county without leaking other years into the map filter',()=>{
  const places=new Map(data.places.map(place=>[place.id,place]));
  for(const placeId of ['yiwu','jinzhai','pingyao','kunshan']){
    assert.ok(places.has(placeId),placeId);
    const events=prc.filter(event=>event.placeId===placeId).sort((a,b)=>a.year-b.year);
    const first=events[0],last=events.at(-1);
    assert.ok(events.length>=2,placeId);assert.ok(last.year-first.year>=10,placeId);
    const all=prc.filter(event=>eventMatches(event,{countryCode:'CN',city:placeId,scope:'all',year:first.year},places));
    const annual=prc.filter(event=>eventMatches(event,{countryCode:'CN',city:placeId,scope:'year',year:first.year},places));
    assert.equal(all.length,events.length,placeId);assert.ok(annual.some(event=>event.id===first.id),placeId);
    assert.equal(annual.some(event=>event.id===last.id),false,placeId);
  }
});
