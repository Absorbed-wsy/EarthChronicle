import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {HISTORY_PERIODS,JAPAN_PERIODS,KOREA_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p]));
const korea=data.events.filter(e=>e.periodId?.startsWith('kr-'));

test('Korean corpus covers independent chronology, all geographic regions and diverse sourced topics',()=>{
  assert.equal(periodsForCountry('KR'),KOREA_PERIODS);assert.equal(periodsForCountry('CN'),HISTORY_PERIODS);assert.equal(periodsForCountry('JP'),JAPAN_PERIODS);
  assert.ok(korea.length>=454);assert.ok(Object.isFrozen(KOREA_PERIODS));assert.equal(new Set(KOREA_PERIODS.map(p=>p.id)).size,KOREA_PERIODS.length);
  const specific=KOREA_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,10);
  for(const p of KOREA_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');}
  for(const p of specific)assert.ok(korea.some(e=>e.periodId===p.id),p.id);
  const sources=new Set(),regions=new Set(),titles=new Set();
  for(const e of korea){
    assert.ok(!titles.has(e.title),e.id);titles.add(e.title);assert.ok(e.summary.length>=45&&e.locationNote,e.id);
    assert.ok(CATEGORIES.includes(e.category),e.id);assert.equal(periodForEvent(e,'KR')?.id,e.periodId,e.id);
    assert.equal(periodForEvent(e,'CN'),null,e.id);assert.equal(periodForEvent(e,'JP'),null,e.id);
    assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'KR')).length,1,e.id);
    const p=places.get(e.placeId);assert.equal(p?.countryCode,'KR',e.id);assert.match(p.regionCode,/^KR-\d{2}$/,e.id);regions.add(p.regionCode);
    assert.ok(p.regionName&&Number.isFinite(p.lon)&&Number.isFinite(p.lat),e.id);assert.ok(Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90,e.id);
    assert.ok(Number.isInteger(e.year)&&e.year>=-5999&&e.year<=Number(data.meta.reviewedThrough.slice(0,4)),e.id);
    assert.equal(new URL(e.sourceUrl).protocol,'https:',e.id);assert.ok(e.sourceTitle,e.id);sources.add(e.sourceUrl);
    assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle),e.id);
    if(e.date){assert.equal(new Date(e.date).toISOString().slice(0,10),e.date,e.id);assert.equal(Number(e.date.slice(0,4)),e.year,e.id);assert.equal(e.precision,'day',e.id);assert.ok(e.date<=data.meta.reviewedThrough,e.id);}else assert.equal(e.precision,'year',e.id);
  }
  assert.equal(regions.size,17);assert.ok(sources.size>=350);
  for(const category of ['政治','战争','外交','经济','社会','科技','文化','灾害','建都','营建','制度'])assert.ok(korea.some(e=>e.category===category),category);
  for(const [code,count]of [['CN',3117],['JP',1101],['KR',korea.length]])assert.equal(data.meta.collections.filter(c=>c.countryCode===code).reduce((n,c)=>n+c.events,0),count,code);
});

test('Korean modern transitions partition events within the same year without duplicates',()=>{
  for(const [before,after,oldId,newId]of [
    ['1897-10-11','1897-10-12','kr-joseon','kr-empire'],
    ['1910-08-28','1910-08-29','kr-empire','kr-colonial'],
    ['1945-08-14','1945-08-15','kr-colonial','kr-liberation'],
    ['1948-08-14','1948-08-15','kr-liberation','kr-republic'],
  ]){
    for(const [date,id]of [[before,oldId],[after,newId]]){const e={year:Number(date.slice(0,4)),date};assert.equal(periodForEvent(e,'KR')?.id,id,date);assert.deepEqual(KOREA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'KR')).map(p=>p.id),[id]);}
    const year=Number(after.slice(0,4));assert.equal(periodForEvent({year},'KR'),null);assert.equal(periodForEvent({year,periodId:newId},'KR')?.id,newId);
    assert.equal(periodForEvent({year,date:before,periodId:newId},'KR')?.id,oldId);
  }
  const byId=new Map(korea.map(e=>[e.id,e]));
  assert.equal(byId.get('kr-1948-first-constitution').periodId,'kr-liberation');assert.equal(byId.get('kr-1948-republic-government').periodId,'kr-republic');
  assert.equal(byId.get('kr-1910-annexation-effective').date,'1910-08-29');assert.equal(byId.get('kr-1897-korean-empire').date,'1897-10-12');
});

test('Korean annual map and place scopes preserve foreign-subject records only in broad geography',()=>{
  for(const e of korea){const p=places.get(e.placeId),filter={countryCode:'KR',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
    assert.equal(eventMatches(e,filter,places),true,e.id);for(const year of [e.year-1,(e.endYear??e.year)+1])assert.equal(eventMatches(e,{...filter,year},places),false,e.id);
    assert.equal(eventMatches(e,{...filter,query:p.name},places),true,e.id);assert.equal(eventMatches(e,{...filter,countryCode:'CN',period:'all'},places),false,e.id);
    assert.equal(eventMatches(e,{...filter,scope:'all',year:2026},places),true,e.id);
  }
  const oldForeign=data.events.filter(e=>places.get(e.placeId)?.countryCode==='KR'&&periodForEvent(e,'CN'));
  assert.equal(oldForeign.length,5);for(const e of oldForeign){assert.equal(periodForEvent(e,'KR'),null,e.id);assert.equal(eventMatches(e,{countryCode:'KR',period:'all',scope:'all'},places),true,e.id);}
});

test('Korean ancient dates, distinct printing editions and technical outcomes remain explicit',()=>{
  const byId=new Map(korea.map(e=>[e.id,e]));
  assert.deepEqual(periodBounds('all',2026,'KR'),[-5999,2026]);
  assert.equal(byId.get('kr--3999-amsa-settlement').date,null);assert.match(byId.get('kr--3999-amsa-settlement').title,/约公元前4000年/);
  assert.match(byId.get('kr-640-cheomseongdae').locationNote,/代表约年/);
  for(const id of ['kr-42-garak-traditional-foundation','kr-1443-hunminjeongeum-created','kr-1446-hunminjeongeum-haerye','kr-1485-gyeongguk-daejeon'])assert.equal(byId.get(id).date,null,id);
  assert.equal(byId.get('kr-1377-jikji-metal-type').placeId,'kr-cheongju');assert.equal(byId.get('kr-1378-jikji-woodblock').placeId,'kr-yeoju');
  assert.match(byId.get('kr-2021-nuri-first-test').summary,/未进入目标轨道/);assert.equal(byId.get('kr-2022-nuri-orbit-success').date,'2022-06-21');
  assert.match(byId.get('kr-1636-byeongja-namhansanseong').summary,/京畿道广州/);
  // Same translated era name in two countries must not adopt array order as ownership.
  assert.equal(periodForEvent({year:-100,era:'史前与早期'},'KR')?.id,'kr-early');
  assert.equal(periodForEvent({year:-100,era:'史前与早期'},'JP')?.id,'jp-early');
  assert.equal(periodForEvent({year:-100,era:'史前与早期'},'CN'),null);
});


test('Korean regional additions distinguish homonyms, editions, repairs and civic procedures',()=>{
  const byId=new Map(korea.map(e=>[e.id,e]));
  assert.equal(byId.get('kr-930-gochang-andong-battle').placeId,'kr-andong');
  assert.notEqual(byId.get('kr-930-gochang-andong-battle').placeId,'kr-gochang');
  assert.match(byId.get('kr-751-bulguksa-traditional-project').summary,/742年/);
  assert.match(byId.get('kr-1363-bongjeong-roof-repair').summary,/不是.*首次建造/);
  assert.match(byId.get('kr-675-maesoseong').locationNote,/尚未确证/);
  assert.equal(byId.get('kr-1610-donguibogam-manuscript').year,1610);
  assert.equal(byId.get('kr-1613-donguibogam-first-print').year,1613);
  assert.equal(byId.get('kr-1884-post-directorate-established').date,'1884-04-22');
  assert.equal(byId.get('kr-1933-hangul-orthography').date,'1933-10-29');
  assert.equal(byId.get('kr-2012-yeosu-expo-open').date,'2012-05-12');
  assert.equal(byId.get('kr-2008-family-register-system').date,'2008-01-01');
  for(const id of ['kr-524-bongpyeong-stele','kr-868-cheolgam-stupa','kr-1232-cheoinseong','kr-1882-imo-military-mutiny','kr-1894-donghak-gobu'])assert.equal(byId.get(id).date,null,id);
  const masan=byId.get('kr-1960-masan-election-protest');assert.equal(masan.placeId,'kr-changwon');
  assert.equal(eventMatches(masan,{countryCode:'KR',scope:'all',query:'马山'},places),true);
  assert.equal(eventMatches(byId.get('kr-1919-jeam-ri-massacre'),{countryCode:'KR',scope:'all',query:'提岩里'},places),true);
  assert.equal(byId.get('kr-2024-emergency-martial-law').date,'2024-12-03');
  assert.equal(byId.get('kr-2024-yoon-impeachment-vote').date,'2024-12-14');
  assert.equal(byId.get('kr-2025-yoon-removal-decision').date,'2025-04-04');
  assert.equal(byId.get('kr-2025-nuri-fourth-launch').date,'2025-11-27');
});

test('Korean institutional stages and same-name academies retain verified dates and sites',()=>{
  const byId=new Map(korea.map(e=>[e.id,e]));
  for(const [id,suffix]of [
    ['kr-1572-oksan-academy','E0038725'],['kr-1574-dosan-academy','E0015677'],
    ['kr-1604-dodong-academy-rebuilt','E0015559'],['kr-1634-donam-academy','E0013025'],
  ])assert.ok(byId.get(id).sourceUrl.endsWith(suffix),id);
  assert.equal(byId.get('kr-1614-byeongsan-ryu-shrine').date,null);
  assert.equal(byId.get('kr-1176-myeonghakso-resistance').placeId,'kr-daejeon');
  assert.equal(places.get('kr-gunwi').regionCode,'KR-27');
  assert.equal(byId.get('kr-1971-kais-founded-seoul').placeId,'seoul');
  assert.equal(byId.get('kr-1989-kaist-daejeon-campus').placeId,'kr-daejeon');
  assert.equal(byId.get('kr-1950-bank-of-korea-founded').date,'1950-06-12');
  assert.ok(!byId.get('kr-1950-bank-of-korea-founded').sourceUrl.includes('E0058159'));
  assert.equal(byId.get('kr-1899-seoul-tram-open').date,'1899-05-17');
  assert.equal(byId.get('kr-1978-kori-first-reactor-completed').date,'1978-04-29');
  assert.equal(byId.get('kr-2003-cheonggyecheon-project-start').date,'2003-07-01');
  assert.equal(byId.get('kr-2005-cheonggyecheon-open').date,'2005-10-01');
  assert.equal(byId.get('kr-2017-park-removal-decision').date,'2017-03-10');
});

test('Korean local histories distinguish archaeological estimates, war calendars and sustained disasters',()=>{
  const byId=new Map(korea.map(e=>[e.id,e]));
  assert.match(byId.get('kr-548-jeokseong-stele').locationNote,/545至550年/);
  assert.equal(byId.get('kr-941-heungbeopsa-jingong-stele').placeId,'kr-wonju');
  assert.equal(byId.get('kr-1596-im-monghak-uprising').placeId,'buyeo');
  assert.equal(byId.get('kr-1597-chilcheonryang-defeat').placeId,'kr-geoje');
  for(const id of ['kr-1592-geumsan-volunteer-battles','kr-1593-haengju-defense','kr-1597-chilcheonryang-defeat'])assert.equal(byId.get(id).date,null,id);
  assert.match(byId.get('kr-1612-daeheungsa-two-buddhas').summary,/后来制作/);
  assert.match(byId.get('kr-1934-imsin-stele-discovery').summary,/552、612或732/);
  const famine=byId.get('kr-1670-gyeongsin-famine');assert.equal(famine.endYear,1671);
  assert.equal(eventMatches(famine,{countryCode:'KR',period:'kr-joseon',scope:'year',year:1671},places),true);
  assert.equal(eventMatches(famine,{countryCode:'KR',period:'kr-joseon',scope:'year',year:1672},places),false);
  assert.equal(byId.get('kr-1950-banknotes-first-issue').placeId,'kr-daegu');
  assert.equal(byId.get('kr-1953-hwan-currency-reform').date,'1953-02-17');
  assert.equal(byId.get('kr-1962-won-currency-reform').date,'1962-06-10');
  assert.equal(byId.get('kr-1959-typhoon-sarah').date,'1959-09-17');
  assert.equal(byId.get('kr-2002-typhoon-rusa-gangneung').date,'2002-08-31');
  assert.equal(byId.get('kr-2003-gwangan-bridge-formal-opening').date,'2003-01-06');
  assert.equal(byId.get('kr-2017-pohang-earthquake').date,'2017-11-15');
  assert.ok(!places.get('kr-pyeongtaek').aliases.includes('唐津'));
});

test('Korean chronological audit preserves estimate ranges, original locations and partial reforms',()=>{
  const byId=new Map(korea.map(e=>[e.id,e]));
  const early=byId.get('kr--5999-dongsam-shell-midden');assert.equal(early.date,null);assert.match(early.locationNote,/代表约年/);
  assert.equal(eventMatches(early,{countryCode:'KR',period:'kr-early',scope:'year',year:-5999},places),true);
  assert.deepEqual(periodBounds('kr-early',2026,'KR'),[-5999,-56]);
  assert.match(byId.get('kr--4699-osanri-lower-settlement').summary,/4800至4670/);
  assert.equal(byId.get('kr-642-daeya-fortress-fall').placeId,'kr-hapcheon');
  assert.match(byId.get('kr-689-sinmun-dalgubeol-capital-plan').summary,/未能实施/);
  assert.equal(byId.get('kr-1469-sangwonsa-bell-moved').placeId,'kr-pyeongchang');assert.match(byId.get('kr-1469-sangwonsa-bell-moved').summary,/铸造及安放地点不明/);
  assert.equal(byId.get('kr-1017-jeongtosa-hongbeop-stele').placeId,'kr-chungju');
  assert.equal(byId.get('kr-1606-taebaeksan-archive-established').placeId,'kr-bonghwa');
  assert.equal(byId.get('kr-1457-danjong-yeongwol-death').placeId,'kr-yeongwol');
  assert.match(byId.get('kr-1801-state-nobi-emancipation').summary,/私奴婢仍存在/);
  assert.match(byId.get('kr-1791-sinhae-commercial-reform').summary,/并非全部贸易自由化/);
  assert.equal(byId.get('kr-1814-jasan-eobo-compiled').placeId,'kr-heuksando');assert.match(byId.get('kr-1814-jasan-eobo-compiled').title,/约1814年/);
  assert.equal(byId.get('kr-1940-forced-name-registration').date,'1940-02-11');
  assert.equal(byId.get('kr-1920-yu-gwansun-prison-death').date,'1920-09-28');
  assert.equal(byId.get('kr-1950-nogunri-killings').placeId,'kr-yeongdong');assert.equal(byId.get('kr-1950-nogunri-killings').date,'1950-07-26');
  assert.equal(byId.get('kr-1960-daegu-february-demonstration').date,'1960-02-28');
  assert.equal(byId.get('kr-1972-july-fourth-joint-statement').date,'1972-07-04');
  for(const id of ['kr-1983-mongchontoseong-excavation','kr-2001-pungnap-preservation-plan','kr-1995-daepyeong-salvage-excavation'])assert.equal(byId.get(id).periodId,'kr-republic',id);
});
