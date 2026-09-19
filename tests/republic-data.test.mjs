import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {eventYearGroups} from '../public/history-index.js';
import {eventMatchesPeriod} from '../public/history-navigation.js';

const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p]));
const republic=data.events.filter(e=>eventMatchesPeriod(e,'republic'));

test('Republic records retain real date precision, traceable sources and the establishment-day boundary',()=>{
  const added=republic.filter(e=>e.id.startsWith('roc-'));
  assert.ok(added.length>=90);
  const urls=new Set();
  for(const e of added){
    assert.equal(e.era,'中华民国',e.id);assert.ok(places.has(e.placeId),e.id);
    assert.ok(e.title&&e.summary.length>=70&&e.locationNote,e.id);assert.ok(CATEGORIES.includes(e.category),e.id);
    assert.ok(Number.isInteger(e.year)&&e.year>=1912&&e.year<=1949,e.id);
    if(e.date){
      assert.match(e.date,/^\d{4}-\d{2}(?:-\d{2})?$/,e.id);assert.equal(Number(e.date.slice(0,4)),e.year,e.id);
      const day=e.date.length===7?e.date+'-01':e.date;
      assert.equal(new Date(day).toISOString().slice(0,10),day,e.id);
      assert.ok(day>='1912-01-01'&&day<'1949-10-01',e.id);
      assert.equal(e.precision,e.date.length===7?'month':'day',e.id);
    }else{assert.equal(e.precision,'year',e.id);assert.ok(e.year<1949,e.id);}
    if(e.endYear!=null)assert.ok(Number.isInteger(e.endYear)&&e.endYear>=e.year&&e.endYear<=1949,e.id);
    assert.ok(e.sources?.length,e.id);
    for(const s of [{title:e.sourceTitle,url:e.sourceUrl},...e.sources]){
      assert.ok(s.title,e.id);const u=new URL(s.url);assert.ok(['https:','http:'].includes(u.protocol),e.id);assert.ok(!u.username&&!u.password,e.id);urls.add(u.href);
    }
    assert.equal(eventMatchesPeriod(e,'prc'),false,e.id);
  }
  assert.ok(urls.size>=70,'event-specific sources must not collapse into a single general chronology');
  for(const category of ['政治','军事','外交','经济','社会','科技','文化','灾害'])assert.ok(added.some(e=>e.category===category),category);
});

test('Republic years remain navigable and actual cross-year disasters stay visible only in their duration',()=>{
  const groups=eventYearGroups(republic,1912,1949);
  for(let year=1912;year<=1949;year++)assert.ok(groups.some(g=>g.year===year),`missing year ${year}`);
  const famine=data.events.find(e=>e.id==='roc-1942-henan-famine');assert.ok(famine);
  for(const [year,wanted] of [[1941,false],[1942,true],[1943,true],[1944,false]]){
    assert.equal(eventMatches(famine,{countryCode:'CN',period:'republic',scope:'year',year},places),wanted);
  }
  const founding=data.events.find(e=>e.id==='roc-1912-nanjing-provisional-government');assert.equal(founding.date,'1912-01-01');
  assert.equal(eventMatchesPeriod(founding,'qing'),false);
});

test('county events stay discoverable by place and parent city while the map keeps a single year',()=>{
  for(const [id,year,region,parent] of [['haiyuan',1920,'CN-64','中卫市'],['jingyang',1932,'CN-61','咸阳市'],['maoxian',1933,'CN-51','阿坝藏族羌族自治州'],['shiping',1936,'CN-53','红河哈尼族彝族自治州']]){
    const filter={countryCode:'CN',period:'republic',scope:'year',year,region,city:id,query:parent};
    const matches=data.events.filter(e=>eventMatches(e,filter,places));assert.equal(matches.length,1,id);
    assert.equal(data.events.some(e=>eventMatches(e,{...filter,year:year+1},places)),false,id);
    assert.equal(data.events.some(e=>eventMatches(e,{...filter,period:'prc'},places)),false,id);
  }
});
