import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches,yearLabel} from '../public/domain.js';
import {HISTORY_PERIODS,eventMatchesPeriod,yearTickLabel} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p]));
const ancient=data.events.filter(e=>e.year<1368||e.periodId==='ming');
test('ancient corpus covers every selectable pre-Qing period with valid geography and traceable sources',()=>{
 for(const p of HISTORY_PERIODS.filter(p=>!p.navigationOnly&&p.start<1636))assert.ok(ancient.some(e=>eventMatchesPeriod(e,p.id)),p.id);
 for(const e of ancient){
  assert.ok(Number.isInteger(e.year)&&e.year>=-769,e.id);assert.ok(places.has(e.placeId),e.id);
  assert.ok(e.title&&e.summary.length>=60&&e.locationNote,e.id);assert.ok(CATEGORIES.includes(e.category),e.id);
  assert.ok(e.sourceTitle&&/^https?:$/.test(new URL(e.sourceUrl).protocol),e.id);
  assert.equal(e.precision,'year',e.id);assert.equal(e.date,null,e.id);
  const owners=HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id));
  assert.equal(owners.length,1,e.id);assert.equal(owners[0].id,e.periodId,e.id);
 }
});
test('ancient annual, geographic and dynasty filters do not leak adjacent-year or concurrent-regime events',()=>{
 for(const e of ancient){
  const local=places.get(e.placeId).countryCode==='CN';
  const f={countryCode:local?'CN':'all',city:e.placeId,period:local?e.periodId:'all',scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true,e.id);
  if(!local){assert.equal(eventMatches(e,{...f,countryCode:'CN'},places),false,e.id);assert.equal(eventMatches(e,{...f,countryCode:places.get(e.placeId).countryCode},places),true,e.id);}
  assert.equal(eventMatches(e,{...f,year:e.year-1},places),false,e.id);
  assert.equal(eventMatches(e,{...f,year:e.year+1},places),false,e.id);
  assert.equal(eventMatches(e,{...f,city:'not-the-same-city'},places),false,e.id);
 }
 for(const id of ['qin-bce221-unification','three-kingdoms-220-wei','two-jin-280-wu-fall','sui-589-chen-fall','tang-618-foundation','five-dynasties-907-liang','song-1279-yashan','ming-1644-beijing-fall']){
  const e=data.events.find(e=>e.id===id);assert.ok(e,id);
  assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id)).length,1,id);
 }
});
test('BCE records use astronomical storage while showing historical year names',()=>{
 for(const [id,year,label] of [['spring-autumn-warring-bce770-eastward',-769,'770'],['qin-bce221-unification',-220,'221'],['western-han-bce202-capital',-201,'202']]){
  assert.equal(data.events.find(e=>e.id===id)?.year,year,id);
  assert.equal(yearLabel(year),`公元前 ${label} 年`);assert.equal(yearTickLabel(year),`前${label}`);
 }
 assert.equal(yearLabel(0),'公元前 1 年');assert.equal(yearLabel(1),'1 年');
});
test('old local catalogues remain eligible for canonical ancient-history upgrades',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
 assert.ok(catalog.previous.includes('0a1cd2c8af6da6e546ffb6ff3af46c93a5cdad6aec5a5a4e3147e0191bcee5af'));
 assert.ok(catalog.previous.includes('42a6120313196a1e4a2d5df8ca69687f03d3b82a03928a98ef3e761ea3b05106'));
 assert.ok(catalog.previous.includes('eb1e423b2b1b2e2e33465ada7eee0b53f4047178a15063e5df92d79b242b4d72'));
 assert.ok(catalog.previous.includes('0b5e6625656dd3cf35e476746f8c7f378b53c0441a558eef351977901b716ea3'));
 assert.ok(catalog.previous.includes('396405b7a4f022f481b41b703555abb7db10706455d5fec0573a88a31beb3009'));
 assert.ok(catalog.previous.includes('ea424be1c9129aa9a9a15a6f4f8b052646c47f5edf2437ce3fcd34f126d249be'));
 assert.ok(catalog.previous.includes('8b569d9d761e4d9f42dc03dd303ceb96bc5c9cde1b3926567e1b1f197d7d9893'));
 assert.ok(catalog.previous.includes('75005f2d31c5bd78a657bd1bf778447e871bb7cbc64d7c199747dca2fc640f38'));
 assert.ok(catalog.previous.includes('08ea3b077a2627cf5e20704098ed1dc1d4c15c550ccb81f7ab0010e4b6e218a7'));
 assert.ok(catalog.previous.includes('78db00dc2ebdee4b1805192441f3bc4f8c764f9b462351151a862434b63a5956'));
 assert.ok(catalog.previous.includes('3dd9bf1ee880d57b6e78d51a915e00f6c77bc13996554b0c6f33ac3de571aa6e'));
 assert.equal(new Set(catalog.previous).size,catalog.previous.length);
});

test('construction and canonical-text milestones retain distinct years and dynasty ownership',()=>{
 for(const [first,last,place] of [['liao-1056-yingxian-tower','jin-1195-yingxian-extension','yingxian'],['eastern-han-175-xiping-start','eastern-han-183-xiping-completion','luoyang'],['song-976-yuelu-foundation','song-1015-yuelu-plaque','changsha']]){
  const a=data.events.find(e=>e.id===first),b=data.events.find(e=>e.id===last);
  assert.ok(a&&b);assert.equal(a.placeId,place);assert.equal(b.placeId,place);assert.ok(a.year<b.year);
  assert.equal(eventMatches(b,{countryCode:'CN',city:place,period:'all',scope:'year',year:a.year},places),false);
 }
});
