import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {eventYearGroups} from '../public/history-index.js';
import {eventMatchesPeriod,periodForEvent} from '../public/history-navigation.js';

const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p]));
const qing=data.events.filter(e=>e.id.startsWith('qing-'));

test('Qing records retain verified date precision and independent event sources',()=>{
  assert.ok(qing.length>=60);
  const sources=new Set();
  for(const e of qing){
    assert.equal(e.era,'清',e.id);assert.ok(places.has(e.placeId),e.id);
    assert.ok(e.title&&e.summary.length>=70&&e.locationNote,e.id);assert.ok(CATEGORIES.includes(e.category),e.id);
    assert.ok(Number.isInteger(e.year)&&e.year>=1636&&e.year<=1911,e.id);
    if(e.date){
      assert.match(e.date,/^\d{4}-\d{2}(?:-\d{2})?$/,e.id);assert.equal(Number(e.date.slice(0,4)),e.year,e.id);
      const full=e.date.length===7?e.date+'-01':e.date;
      assert.equal(new Date(full).toISOString().slice(0,10),full,e.id);
      assert.ok(full>='1636-01-01'&&full<'1912-01-01',e.id);
      assert.equal(e.precision,e.date.length===7?'month':'day',e.id);
    }else assert.equal(e.precision,'year',e.id);
    if(e.endYear!=null)assert.ok(Number.isInteger(e.endYear)&&e.endYear>=e.year&&e.endYear<=1911,e.id);
    assert.ok(e.sources?.length,e.id);
    for(const s of [{title:e.sourceTitle,url:e.sourceUrl},...e.sources]){
      assert.ok(s.title,e.id);const u=new URL(s.url);assert.ok(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password,e.id);sources.add(u.href);
    }
    assert.equal(eventMatchesPeriod(e,'qing'),true,e.id);assert.equal(eventMatchesPeriod(e,'modern'),e.year>=1840,e.id);
    assert.equal(eventMatchesPeriod(e,'republic'),false,e.id);assert.equal(eventMatchesPeriod(e,'prc'),false,e.id);
  }
  assert.ok(sources.size>=50);
  for(const c of ['政治','军事','外交','战争','制度','经济','科技','文化','灾害'])assert.ok(qing.some(e=>e.category===c),c);
  const years=eventYearGroups(qing,1636,1911).map(g=>g.year);
  for(const y of [1636,1644,1683,1689,1729,1757,1796,1839,1840,1842,1851,1860,1866,1872,1881,1895,1900,1905,1911])assert.ok(years.includes(y),String(y));
});

test('the 1911 election and 1912 abdication follow the establishment-day boundary without duplication',()=>{
  for(const [id,day,period] of [
    ['qing-1911-sun-provisional-president-election','1911-12-29','qing'],
    ['roc-1912-nanjing-provisional-government','1912-01-01','republic'],
    ['roc-1912-qing-abdication','1912-02-12','republic']
  ]){
    const e=data.events.find(e=>e.id===id);assert.ok(e,id);assert.equal(e.date,day,id);
    assert.equal(periodForEvent(e).id,period,id);
    assert.equal(eventMatchesPeriod(e,'qing'),period==='qing',id);
    assert.equal(eventMatchesPeriod(e,'republic'),period==='republic',id);
    assert.equal(eventMatchesPeriod(e,'modern'),true,id);
  }
});

test('multi-year wars and disasters appear only in active years while navigation counts their start once',()=>{
  for(const [id,start,end] of [['qing-1840-first-opium-war',1840,1842],['qing-1904-russo-japanese-war',1904,1905],['qing-1876-north-china-famine',1876,1879]]){
    const e=data.events.find(e=>e.id===id);assert.ok(e,id);assert.equal(e.endYear,end);
    for(let year=start-1;year<=end+1;year++)assert.equal(eventMatches(e,{countryCode:'CN',period:'modern',scope:'year',year},places),year>=start&&year<=end,id+':'+year);
    assert.deepEqual(eventYearGroups([e],1840,1911).map(g=>g.year),[start]);
    assert.equal(eventMatches(e,{countryCode:'CN',period:'republic',scope:'all',year:start},places),false,id);
  }
});

test('new county and overseas records use actual place filters rather than political affiliation',()=>{
  const battle=data.events.find(e=>e.id==='roc-1937-pingxingguan-battle');assert.ok(battle);
  for(const query of ['灵丘','平型关','大同市']){
    assert.equal(eventMatches(battle,{countryCode:'CN',period:'republic',region:'CN-14',city:'lingqiu',year:1937,scope:'year',query},places),true,query);
    assert.equal(eventMatches(battle,{countryCode:'CN',period:'republic',year:1938,scope:'year',query},places),false,query);
  }
  for(const [id,country] of [['qing-1895-shimonoseki-treaty','JP'],['qing-1905-tongmenghui-founded','JP'],['roc-1942-yenangyaung-relief','MM']]){
    const e=data.events.find(e=>e.id===id);assert.ok(e,id);assert.equal(places.get(e.placeId).countryCode,country,id);
    const filter={year:e.year,scope:'year',period:'all'};
    assert.equal(eventMatches(e,{...filter,countryCode:'CN'},places),false,id);
    assert.equal(eventMatches(e,{...filter,countryCode:country},places),true,id);
    assert.equal(eventMatches(e,{...filter,countryCode:'all'},places),true,id);
  }
});
