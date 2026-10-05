import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {SRI_LANKA_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod,yearTickLabel} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),records=data.events.filter(e=>e.periodId?.startsWith('lk-')),byId=new Map(records.map(e=>[e.id,e]));
test('Sri Lanka has sourced records across eleven periods and all nine modern provinces',()=>{
 assert.equal(records.length,221);assert.equal(periodsForCountry('LK'),SRI_LANKA_PERIODS);assert.ok(Object.isFrozen(SRI_LANKA_PERIODS));
 assert.equal(SRI_LANKA_PERIODS.filter(p=>!p.navigationOnly).length,11);assert.deepEqual(periodBounds('all',2026,'LK'),[-46049,2026]);
 assert.equal(data.meta.collections.filter(c=>c.countryCode==='LK').reduce((n,c)=>n+c.events,0),records.length);
 const ids=new Set(),titles=new Set(),refs=new Set(),regions=new Set(),sources=new Set(),categories=new Set();
 for(const p of SRI_LANKA_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');if(!p.navigationOnly)assert.ok(records.some(e=>e.periodId===p.id),p.id);}
 for(const e of records){
  assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);refs.add(e.placeId);categories.add(e.category);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=60&&e.locationNote,e.id);assert.equal(periodForEvent(e,'LK')?.id,e.periodId,e.id);
  assert.equal(SRI_LANKA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'LK')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP'])assert.equal(periodForEvent(e,c),null,e.id+':'+c);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'LK',e.id);assert.match(p.regionCode,/^LK-GEO-(29|30|32|33|34|35|36|37|38)$/);regions.add(p.regionCode);
  assert.ok(p.lon>=79&&p.lon<=82&&p.lat>=5&&p.lat<=10,e.id);
  assert.equal(e.title.endsWith('（约）'),e.approximate===true,e.id);
  assert.ok(e.sources.some(s=>s.title===e.sourceTitle&&s.url===e.sourceUrl));for(const s of e.sources){assert.ok(s.title);assert.equal(new URL(s.url).protocol,'https:');sources.add(s.url);}
  if(e.date){assert.equal(e.precision,'day');assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(new Date(e.date+'T00:00:00Z').toISOString().slice(0,10),e.date);assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.equal(refs.size,77);assert.equal(regions.size,9);assert.ok(sources.size>=70);
 for(const c of ['政治','战争','经济','社会','科技','文化','营建','制度','外交','灾害'])assert.ok(categories.has(c),c);
});
test('Sri Lanka civil-date transitions do not overlap or invent dates for boundary years',()=>{
 for(const [date,id]of [['1796-02-15','lk-dutch'],['1796-02-16','lk-british'],['1948-02-03','lk-british'],['1948-02-04','lk-dominion'],['1972-05-21','lk-dominion'],['1972-05-22','lk-first-republic'],['1978-09-06','lk-first-republic'],['1978-09-07','lk-second-republic']]){
  const e={year:Number(date.slice(0,4)),date,periodId:id};assert.equal(periodForEvent(e,'LK')?.id,id,date);
  assert.equal(SRI_LANKA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'LK')).length,1,date);
 }
 for(const year of [1796,1948,1972,1978])assert.equal(periodForEvent({year},'LK'),null);
 assert.equal(periodForEvent({year:1948,date:'1948-02-03',periodId:'lk-dominion'},'LK')?.id,'lk-british');
 assert.equal(periodForEvent({year:1978,date:'1978-02-04',periodId:'lk-second-republic'},'LK')?.id,'lk-first-republic');
 assert.equal(byId.get('lk-1947-ceylon-independence-act-assent').periodId,'lk-british');
 assert.equal(byId.get('lk-1978-executive-presidency-start').periodId,'lk-first-republic');
});
test('Sri Lanka prehistoric BP and BCE chronology use the 1950 epoch and astronomical years',()=>{
 const fa=byId.get('lk-bce46050-fahien-rainforest-hunting'),bat=byId.get('lk-bce34050-batadomba-foraging');
 assert.equal(fa.year,-46049);assert.equal(bat.year,-34049);assert.equal(yearTickLabel(fa.year),'前46050');assert.equal(yearTickLabel(bat.year),'前34050');
 assert.match(fa.summary,/48000.*34000/);assert.match(fa.summary,/1950/);assert.match(bat.summary,/1950/);
 for(const e of records.filter(e=>e.year<0)){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.approximate,true);}
 assert.deepEqual(data.meta.coverage,[-46049,2026]);assert.equal(periodBounds('all',2026,'CN')[0],-17999);
 assert.equal(places.get('lk-fahien').lat,6+38/60+55/3600);assert.equal(places.get('lk-fahien').lon,80+12/60+55/3600);
});
test('Sri Lanka epigraphy preserves uncertain royal years and distinguishes findspot from ordinance venue',()=>{
 for(const [id,year,key]of [['lk-1150-mankanai-service-land',1150,'in03228'],['lk-1170-kayts-maritime-ordinance',1170,'in03229'],['lk-1190-galpota-tax-proclamation',1190,'in03081'],['lk-1191-panduwasnuwara-general-donation',1191,'in03227'],['lk-1344-gadaladeniya-temple-charter',1344,'in03166'],['lk-1476-gadaladeniya-land-service',1476,'in03154']]){
  const e=byId.get(id);assert.equal(e.year,year,id);assert.equal(e.date,null,id);assert.equal(e.precision,'year');assert.ok(e.sources.some(s=>s.url.includes(key)),id);
 }
 assert.match(byId.get('lk-1191-panduwasnuwara-general-donation').summary,/1191.*1192/);
 assert.match(byId.get('lk-1190-galpota-tax-proclamation').summary,/自我陈述/);
 assert.match(byId.get('lk-1170-kayts-maritime-ordinance').locationNote,/奈纳蒂武/);
 assert.equal(byId.get('lk-1344-gadaladeniya-temple-charter').placeId,'lk-pilimatalawa');
});
test('Sri Lanka coastal administrations and regional kingdoms preserve coexistence',()=>{
 const kandy=SRI_LANKA_PERIODS.find(p=>p.id==='lk-kandy');assert.equal(kandy.start,1469);assert.equal(kandy.endBefore,'1815-03-02');
 assert.equal(periodForEvent({year:1815,date:'1815-03-01',periodId:'lk-kandy'},'LK')?.id,'lk-kandy');
 assert.equal(periodForEvent({year:1815,date:'1815-03-02',periodId:'lk-kandy'},'LK')?.id,'lk-british');
 const royal=byId.get('lk-1693-kandy-throne-gift'),coast=byId.get('lk-1658-jaffna-dutch-capture');
 assert.equal(royal.periodId,'lk-kandy');assert.equal(coast.periodId,'lk-dutch');
 assert.match(byId.get('lk-1796-colombo-british-takeover').summary,/康提仍/);
 assert.match(byId.get('lk-1505-portuguese-first-arrival').summary,/1506/);
 for(const e of [royal,coast])for(const p of SRI_LANKA_PERIODS.filter(p=>!p.navigationOnly))assert.equal(eventMatchesPeriod(e,p.id,'LK'),e.periodId===p.id);
});
test('Sri Lanka signing, opening and certification remain separate from other project stages',()=>{
 assert.equal(byId.get('lk-1865-colombo-ambepussa-public-rail').date,'1865-10-02');assert.match(byId.get('lk-1865-colombo-ambepussa-public-rail').summary,/1864.*12月27/);
 assert.equal(byId.get('lk-1974-jaffna-campus-establishment').date,'1974-08-01');assert.equal(byId.get('lk-1979-jaffna-university-autonomy').date,'1979-01-01');
 assert.equal(byId.get('lk-1958-employees-provident-fund').date,'1958-06-01');assert.equal(byId.get('lk-1950-central-bank-operations').date,'1950-08-28');
 assert.equal(byId.get('lk-2024-presidential-election').date,'2024-09-21');assert.match(byId.get('lk-2024-presidential-election').summary,/就职/);
 assert.match(byId.get('lk-2016-malaria-free-certification').summary,/输入性/);assert.match(byId.get('lk-2019-measles-elimination-verification').summary,/输入病例/);
 assert.match(byId.get('lk-2023-imf-eff-board-approval').summary,/分期/);assert.match(byId.get('lk-2009-government-war-end-announcement').summary,/无法独立/);
});
test('Sri Lanka modern reference points distinguish cross-border engineering and overseas procedures',()=>{
 for(const [id,lat,lon,adm]of [['lk-ambepussa',7.2507,80.1723,36],['lk-inginiyagala',7.2233,81.541,35],['lk-udawalawa',6.45,80.83333,35],['lk-pilimatalawa',7.2689,80.5441,29],['lk-panduwasnuwara',7.5984,80.1025,32],['lk-kayts',9.7,79.85,38]]){
  const p=places.get(id);assert.equal(p.lat,lat,id);assert.equal(p.lon,lon,id);assert.equal(p.regionCode,'LK-GEO-'+adm,id);assert.ok(p.sources.some(s=>s.url.startsWith('https://www.geonames.org/')),id);
 }
 assert.match(byId.get('lk-1955-un-membership').locationNote,/纽约/);
 assert.match(byId.get('lk-2019-measles-elimination-verification').locationNote,/新德里/);
 assert.match(byId.get('lk-2023-imf-eff-board-approval').locationNote,/华盛顿/);
 assert.match(byId.get('lk-2025-ditwah-cyclone-floods').summary,/不是|不能将其解释为/);
});
test('Sri Lanka country, region, city, period and year filtering retain recorded durations',()=>{
 for(const e of records){
  const p=places.get(e.placeId),filter={countryCode:'LK',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,filter,places),true,e.id);assert.equal(eventMatches(e,{...filter,year:e.year-1},places),false,e.id);
  assert.equal(eventMatches(e,{...filter,countryCode:'IN'},places),false,e.id);
  const otherPeriod=e.periodId==='lk-first-republic'?'lk-second-republic':'lk-first-republic';assert.equal(eventMatches(e,{...filter,period:otherPeriod},places),false,e.id);
  assert.equal(eventMatches(e,{...filter,year:e.endYear??e.year+1},places),!!e.endYear,e.id);
 }
});

test('Sri Lanka archaeological stages keep ranges, BCE conversion and uncertain building function',()=>{
 const early=byId.get('lk-bce900-anuradhapura-iron-age-settlement'),wall=byId.get('lk-bce350-anuradhapura-expansion-rampart'),hall=byId.get('lk-400-anuradhapura-columned-hall');
 assert.equal(yearTickLabel(early.year),'前900');assert.equal(yearTickLabel(wall.year),'前350');
 assert.equal(early.periodId,'lk-early');assert.equal(wall.periodId,'lk-anuradhapura');
 assert.match(early.summary,/900.*510/);assert.match(wall.summary,/360.*190/);assert.match(hall.summary,/300.*500/);
 assert.match(hall.summary,/可能.*世俗/);assert.match(hall.summary,/不能直接命名/);
 for(const e of [early,wall,hall]){assert.equal(e.date,null);assert.equal(e.approximate,true);assert.ok(e.sources.some(s=>s.title.includes('ASW2')));}
});
test('Sri Lanka regnal calendars, reused stones and later copper copies retain their uncertainty',()=>{
 for(const id of ['lk-910-kiribath-dispensary-protection','lk-912-padaviya-irrigated-estates','lk-920-kassapa-monastic-accounts','lk-970-mihintale-service-accounting']){
  const e=byId.get(id);assert.equal(e.approximate,true);assert.equal(e.date,null);assert.ok(e.sources.some(s=>s.url==='https://books.lakdiva.org.lk/culavamsa/vol_1.html'),id);
 }
 const road=byId.get('lk-1137-dimbulagala-cave-path'),hospital=byId.get('lk-925-council-pillar-hospital-ginger'),copy=byId.get('lk-1787-lankatilaka-copper-confirmation');
 assert.match(road.summary,/早已失位/);assert.match(hospital.locationNote,/原址.*未明/);assert.equal(hospital.periodId,'lk-anuradhapura');
 assert.equal(copy.periodId,'lk-kandy');assert.match(copy.summary,/不把抄入的1344年/);assert.equal(copy.approximate,true);
});
test('Sri Lanka repayment, maintenance and grain interest are different historical acts',()=>{
 const journeys=byId.get('lk-550-ambagaswewa-debt-service'),freedom=byId.get('lk-515-periyakadu-debt-release'),support=byId.get('lk-600-abhayagiri-servitor-maintenance'),grain=byId.get('lk-350-thonigala-grain-interest');
 assert.match(journeys.summary,/一百次.*行程/);assert.match(journeys.summary,/不能改写为.*钱币/);
 assert.match(freedom.summary,/个人债役/);assert.match(support.summary,/供养.*而非赎身/);
 assert.match(grain.summary,/本金.*利息/);assert.match(grain.summary,/不把.*现代银行/);
 for(const e of [journeys,freedom,support,grain])assert.equal(e.precision,'year');
});
test('Sri Lanka modern reference records disambiguate homonyms and accept non-city geography',()=>{
 for(const [id,adm,gid]of [['lk-lahugala',37,1237863],['lk-alutnuwara',33,1251780],['lk-ambagamuwa',29,1251637],['lk-mahiyanganaya',35,11992093],['lk-kumbukkandanwala',29,11987058],['lk-madawala-kandy',29,8355348],['lk-batalagodawewa',32,1250202],['lk-nilagama',29,1233049],['lk-maradanmaduwa',30,1236077],['lk-ritigala',30,1228569]]){
  const p=places.get(id);assert.equal(p.regionCode,'LK-GEO-'+adm,id);assert.ok(p.sources.some(s=>s.url==='https://www.geonames.org/'+gid+'/'),id);
  assert.match(p.description,/参考点/);
 }
 for(const e of records)if(e.locationNote.startsWith('以现代阿努拉德普勒城区'))assert.equal(e.placeId,'lk-anuradhapura',e.id);
 assert.match(byId.get('lk-1380-sagama-minister-endowment').summary,/不误标/);
 assert.notEqual(byId.get('lk-1271-polonnaruwa-lankatilaka-restoration').placeId,byId.get('lk-1344-lankatilaka-bilingual-charters').placeId);
});
test('Sri Lanka multilingual and coexistence records do not borrow the wrong date or polity',()=>{
 const galle=byId.get('lk-1410-galle-trilingual-inscription'),lanka=byId.get('lk-1344-lankatilaka-bilingual-charters'),compact=byId.get('lk-1480-alutnuwara-mutual-compact'),amnesty=byId.get('lk-1478-dedigama-amnesty');
 assert.equal(galle.date,null);assert.equal(galle.approximate,true);assert.match(galle.summary,/1409年2月15日.*南京/);
 for(const key of ['in03150','in03151','in03152'])assert.ok(galle.sources.some(s=>s.url.includes(key)));
 assert.ok(galle.sources.some(s=>s.url.startsWith('https://slncu.lk/')));
 assert.equal(lanka.year,1344);assert.match(lanka.summary,/1266年.*1344年/);
 assert.equal(compact.periodId,'lk-kandy');assert.equal(amnesty.periodId,'lk-regional');
 assert.equal(byId.get('lk-1513-gadaladeniya-amnesty-compact').periodId,'lk-regional');
 assert.equal(byId.get('lk-1543-kandy-service-remission').periodId,'lk-kandy');
 assert.equal(byId.get('lk-1359-lankatilaka-village-grants').date,null);
});
