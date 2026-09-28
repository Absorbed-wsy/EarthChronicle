import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {INDIA_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),records=data.events.filter(e=>e.periodId?.startsWith('in-')),byId=new Map(records.map(e=>[e.id,e]));
test('India has attributed, sourced and geographically anchored records across all periods',()=>{
 assert.equal(periodsForCountry('IN'),INDIA_PERIODS);assert.equal(records.length,236);assert.equal(INDIA_PERIODS.filter(p=>!p.navigationOnly).length,18);assert.deepEqual(periodBounds('all',2026,'IN'),[-19999,2026]);assert.ok(Object.isFrozen(INDIA_PERIODS));
 const ids=new Set(),titles=new Set(),sources=new Set(),regions=new Set(),categories=new Set();
 for(const p of INDIA_PERIODS){assert.ok(Object.isFrozen(p));if(!p.navigationOnly){assert.equal(new URL(p.sourceURL).protocol,'https:');assert.ok(records.some(e=>e.periodId===p.id),p.id);}}
 for(const e of records){assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);sources.add(e.sourceUrl);categories.add(e.category);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);assert.equal(periodForEvent(e,'IN')?.id,e.periodId,e.id);assert.equal(INDIA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'IN')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN','LA','KH','TH','MM'])assert.equal(periodForEvent(e,c),null,e.id);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'IN',e.id);assert.ok(p.regionName&&p.regionCode&&p.lon>=68&&p.lon<=98&&p.lat>=7&&p.lat<=37,e.id);regions.add(p.regionCode);
  assert.equal(new URL(e.sourceUrl).protocol,'https:');assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));
  if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full);assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.ok(sources.size>=120);assert.ok(regions.size>=24);for(const c of ['政治','战争','经济','科技','文化','营建','制度'])assert.ok(categories.has(c),c);
 assert.equal(data.meta.collections.filter(p=>p.countryCode==='IN').reduce((n,p)=>n+p.events,0),236);
});
test('India independence and republican transitions use effective civil dates without overlap',()=>{
 for(const [date,id]of [['1858-09-01','in-company'],['1858-09-02','in-british'],['1947-08-14','in-british'],['1947-08-15','in-dominion'],['1950-01-25','in-dominion'],['1950-01-26','in-republic']]){
  const e={year:Number(date.slice(0,4)),date,periodId:id};assert.equal(periodForEvent(e,'IN')?.id,id,date);
 }
 for(const year of [1858,1947,1950])assert.equal(periodForEvent({year},'IN'),null);
 assert.equal(byId.get('in-1858-government-india-act').periodId,'in-company');assert.equal(byId.get('in-1858-crown-government-act-commences').date,'1858-09-02');assert.equal(byId.get('in-1858-queen-proclamation-allahabad').placeId,'in-prayagraj');
 assert.equal(byId.get('in-1853-india-first-passenger-rail').date,'1853-04-16');assert.equal(byId.get('in-1927-congress-simon-boycott').placeId,'in-chennai');assert.equal(byId.get('in-1930-salt-law-broken-dandi').placeId,'in-dandi');
 assert.equal(byId.get('in-1948-gandhi-assassinated').date,'1948-01-30');assert.equal(byId.get('in-2005-rti-act-main-commencement').date,'2005-10-12');assert.equal(byId.get('in-2014-mars-orbiter-mars-arrival').placeId,'in-bengaluru');
 assert.equal(byId.get('in-1947-india-dominion-independence').date,'1947-08-15');assert.equal(byId.get('in-1950-republic-founded').date,'1950-01-26');
});
test('India records filter by modern reference place and year without cross-country leakage',()=>{
 for(const e of records){const p=places.get(e.placeId),filters={countryCode:'IN',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,filters,places),true,e.id);assert.equal(eventMatches(e,{...filters,year:e.year-1},places),false);assert.equal(eventMatches(e,{...filters,year:(e.endYear??e.year)+1},places),false);assert.equal(eventMatches(e,{...filters,countryCode:'CN',period:'all'},places),false);
 }
 assert.equal(places.get('in-sriharikota').regionCode,'IN-GEO-02');assert.equal(byId.get('in-2023-chandrayaan-three').placeId,'in-sriharikota');
 assert.equal(byId.get('in-1192-tarain-ghurid-victory').placeId,'new-delhi');assert.match(byId.get('in-1192-tarain-ghurid-victory').locationNote,/不是战场/);
 assert.equal(data.events.filter(e=>e.placeId==='new-delhi'&&!e.periodId?.startsWith('in-')).length>=1,true);
});
